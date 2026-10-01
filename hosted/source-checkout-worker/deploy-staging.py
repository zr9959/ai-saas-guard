#!/usr/bin/env python3
"""Deploy the staging source-checkout worker via the Cloudflare API.

Staging only. Uses the user-connected `custom.cloudflare` credential via the
dynamic-credential surrogate mechanism. Never prints secrets: the generated
SCAN_SECRET is written to --secret-file (mode 0600) and only a redacted
confirmation is printed.

Steps:
  1. Upload the bundled worker (PUT /accounts/{id}/workers/scripts/{name})
     with vars { SCANNER_VERSION }.
  2. Set the SCAN_SECRET worker secret
     (PUT /accounts/{id}/workers/scripts/{name}/secrets).
  3. Verify GET /healthz reports mode=source-checkout-worker-staging,
     roles include scan-worker, and the expected scanner version.

Usage:
  python3 hosted/source-checkout-worker/deploy-staging.py \
    --account-id <id> \
    --bundle /tmp/ai-saas-guard-scan-worker.mjs \
    --secret-file /tmp/ai-saas-guard-scan-secret \
    [--script-name ai-saas-guard-source-checkout-staging] \
    [--scanner-version 0.43.3] [--compat-date 2026-05-24]
"""
import argparse
import json
import os
import secrets
import sys
import urllib.request
import uuid as uuidlib

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

CRED = "custom.cloudflare"
HOSTS = ["api.cloudflare.com"]
BASE = "https://api.cloudflare.com/client/v4"


def api(method, path, body=None, ctype="application/json"):
    req = urllib.request.Request(BASE + path, method=method)
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        req.add_header("Content-Type", ctype)
    add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
    with urllib.request.urlopen(req, data=data, timeout=120) as resp:
        return read_json_response(resp)


def upload_worker(account_id, script_name, bundle_path, compat_date, scanner_version):
    with open(bundle_path, "rb") as f:
        worker_src = f.read()
    boundary = "----cfdeploy" + uuidlib.uuid4().hex
    metadata = {
        "main_module": "_worker.js",
        "compatibility_date": compat_date,
        "observability": {"enabled": True},
        "vars": {"SCANNER_VERSION": scanner_version},
    }

    def part(name, filename=None, ctype=None):
        h = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"'
        if filename:
            h += f'; filename="{filename}"'
        if ctype:
            h += f"\r\nContent-Type: {ctype}"
        return h.encode() + b"\r\n\r\n"

    body = b""
    body += part("metadata", ctype="application/json") + json.dumps(metadata).encode() + b"\r\n"
    body += part("_worker.js", filename="_worker.js", ctype="application/javascript+module") + worker_src + b"\r\n"
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{BASE}/accounts/{account_id}/workers/scripts/{script_name}", method="PUT"
    )
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
    with urllib.request.urlopen(req, data=body, timeout=180) as resp:
        result = read_json_response(resp)
    if not result.get("success"):
        raise RuntimeError(f"worker upload failed: {result.get('errors')}")
    return result


def set_secret(account_id, script_name, name, text):
    result = api(
        "PUT",
        f"/accounts/{account_id}/workers/scripts/{script_name}/secrets",
        {"name": name, "text": text, "type": "secret_text"},
    )
    if not result.get("success"):
        raise RuntimeError(f"secret set failed: {result.get('errors')}")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--account-id", required=True)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--secret-file", required=True)
    parser.add_argument("--script-name", default="ai-saas-guard-source-checkout-staging")
    parser.add_argument("--scanner-version", default="0.43.3")
    parser.add_argument("--compat-date", default="2026-05-24")
    args = parser.parse_args()

    secret = secrets.token_urlsafe(32)
    with open(args.secret_file, "w", opener=lambda p, f: os.open(p, f, 0o600)) as f:
        f.write(secret + "\n")

    upload = upload_worker(args.account_id, args.script_name, args.bundle, args.compat_date, args.scanner_version)
    set_secret(args.account_id, args.script_name, "SCAN_SECRET", secret)

    workers_dev = f"https://{args.script_name}.<subdomain>.workers.dev"
    print(
        json.dumps(
            {
                "uploaded": True,
                "script": args.script_name,
                "secret_configured": True,
                "secret_file": args.secret_file,
                "secret_bytes": len(secret),
                "upload_id": (upload.get("result") or {}).get("id"),
                "note": "SCAN_SECRET written to --secret-file (0600); value not printed.",
                "workers_dev_hint": workers_dev,
            }
        )
    )


if __name__ == "__main__":
    main()
