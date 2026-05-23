export const HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS = {
  contents: "read",
  pull_requests: "read",
  checks: "write",
  metadata: "read"
} as const;

export const HOSTED_GITHUB_APP_EVENTS = [
  "pull_request",
  "installation",
  "installation_repositories"
] as const;

export type HostedGitHubAppPermissionName =
  keyof typeof HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS;

export type HostedGitHubAppPermissionValue = "read" | "write" | "none";

export type HostedGitHubAppEvent = (typeof HOSTED_GITHUB_APP_EVENTS)[number];

export interface HostedGitHubAppReleaseGateSummary {
  shouldExposeHostedEnvironment: boolean;
  blocked: boolean;
  containerImageDigestRecorded: boolean;
  missingEvidenceIds?: string[];
  failedEvidenceIds?: string[];
  staleEvidenceIds?: string[];
  exceptionEvidenceIds?: string[];
  releaseNotesCompliant?: boolean;
}

export interface HostedGitHubAppSecretRefs {
  appId: string;
  privateKey: string;
  webhookSecret: string;
}

export interface HostedGitHubAppDeploymentInput {
  appName: string;
  homepageUrl: string;
  webhookUrl: string;
  environment: string;
  containerImageDigest: string;
  secretRefs: HostedGitHubAppSecretRefs;
  releaseGate: HostedGitHubAppReleaseGateSummary;
  setupUrl?: string;
  callbackUrl?: string;
  requestedPermissions?: Record<string, HostedGitHubAppPermissionValue>;
  requestedEvents?: string[];
  rawPrivateKey?: string;
  rawWebhookSecret?: string;
}

export interface HostedGitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: {
    url: string;
    active: true;
  };
  redirect_url?: string;
  setup_url?: string;
  public: false;
  default_permissions: typeof HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS;
  default_events: HostedGitHubAppEvent[];
}

export interface HostedGitHubAppDeploymentPlan {
  readyToCreateGitHubApp: boolean;
  blockedReasons: string[];
  environment: string;
  containerImageDigest: string;
  manifest: HostedGitHubAppManifest;
  requiredSecretRefs: string[];
  deploymentSteps: string[];
  privacy: {
    includesPrivateKey: false;
    includesWebhookSecret: false;
    includesClientSecret: false;
    includesCustomerPayloads: false;
  };
}

export function planHostedGitHubAppDeployment(
  input: HostedGitHubAppDeploymentInput
): HostedGitHubAppDeploymentPlan {
  const blockedReasons = [
    ...releaseGateBlockedReasons(input.releaseGate),
    ...containerDigestBlockedReasons(input.containerImageDigest),
    ...urlBlockedReasons("homepage_url", input.homepageUrl),
    ...urlBlockedReasons("webhook_url", input.webhookUrl),
    ...optionalUrlBlockedReasons("setup_url", input.setupUrl),
    ...optionalUrlBlockedReasons("callback_url", input.callbackUrl),
    ...secretRefBlockedReasons(input.secretRefs),
    ...rawSecretInputBlockedReasons(input),
    ...permissionBlockedReasons(input.requestedPermissions),
    ...eventBlockedReasons(input.requestedEvents)
  ];

  const manifest: HostedGitHubAppManifest = {
    name: input.appName.trim() || "AI SaaS Guard Hosted",
    url: input.homepageUrl,
    hook_attributes: {
      url: input.webhookUrl,
      active: true
    },
    ...(input.callbackUrl ? { redirect_url: input.callbackUrl } : {}),
    ...(input.setupUrl ? { setup_url: input.setupUrl } : {}),
    public: false,
    default_permissions: HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS,
    default_events: [...HOSTED_GITHUB_APP_EVENTS]
  };

  return {
    readyToCreateGitHubApp: blockedReasons.length === 0,
    blockedReasons,
    environment: input.environment,
    containerImageDigest: input.containerImageDigest,
    manifest,
    requiredSecretRefs: safeSecretRefs(input.secretRefs),
    deploymentSteps: [
      "Create the GitHub App from the generated least-privilege manifest.",
      "Store the App ID, private key, and webhook secret in the platform secret manager.",
      "Deploy webhook ingress and scan worker containers with the recorded image digest.",
      "Run the hosted operational release gate against the deployed artifact before exposure."
    ],
    privacy: {
      includesPrivateKey: false,
      includesWebhookSecret: false,
      includesClientSecret: false,
      includesCustomerPayloads: false
    }
  };
}

function releaseGateBlockedReasons(gate: HostedGitHubAppReleaseGateSummary): string[] {
  return gate.shouldExposeHostedEnvironment &&
    !gate.blocked &&
    gate.containerImageDigestRecorded &&
    gate.releaseNotesCompliant !== false
    ? []
    : ["release_gate_blocked"];
}

function containerDigestBlockedReasons(containerImageDigest: string): string[] {
  return /^sha256:[a-f0-9]{64}$/i.test(containerImageDigest)
    ? []
    : ["invalid_container_image_digest"];
}

function urlBlockedReasons(name: string, value: string): string[] {
  return isSafeHttpsUrl(value) ? [] : [`invalid_${name}`];
}

function optionalUrlBlockedReasons(name: string, value?: string): string[] {
  if (!value) {
    return [];
  }

  return urlBlockedReasons(name, value);
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isUnsafeHostedHostname(url.hostname);
  } catch {
    return false;
  }
}

function isUnsafeHostedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isUnsafeIpv4Hostname(normalized) ||
    isUnsafeIpv6Hostname(normalized)
  );
}

function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}

function isUnsafeIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return false;
  }

  if (!parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function isUnsafeIpv6Hostname(hostname: string): boolean {
  return (
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:")
  );
}

function secretRefBlockedReasons(secretRefs: HostedGitHubAppSecretRefs): string[] {
  const reasons: string[] = [];
  for (const key of ["appId", "privateKey", "webhookSecret"] as const) {
    const value = secretRefs[key];
    if (!value.trim()) {
      reasons.push(`missing_secret_ref:${key}`);
      continue;
    }

    if (looksLikeRawSecretMaterial(value)) {
      reasons.push(`raw_secret_material:${key}`);
    }
  }

  return reasons;
}

function rawSecretInputBlockedReasons(input: HostedGitHubAppDeploymentInput): string[] {
  const reasons: string[] = [];
  for (const key of ["rawPrivateKey", "rawWebhookSecret"] as const) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      reasons.push(`raw_secret_material:${key}`);
    }
  }

  return reasons;
}

function looksLikeRawSecretMaterial(value: string): boolean {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----|whsec_|gh[opurs]_|github_pat_/i.test(value);
}

function permissionBlockedReasons(
  requestedPermissions: Record<string, HostedGitHubAppPermissionValue> | undefined
): string[] {
  if (!requestedPermissions) {
    return [];
  }

  const reasons: string[] = [];
  for (const permission of Object.keys(requestedPermissions).sort()) {
    if (!(permission in HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS)) {
      reasons.push(`permission_not_allowed:${permission}`);
      continue;
    }

    const requiredValue =
      HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS[permission as HostedGitHubAppPermissionName];
    if (requestedPermissions[permission] !== requiredValue) {
      reasons.push(`permission_not_allowed:${permission}`);
    }
  }

  return reasons;
}

function eventBlockedReasons(requestedEvents: string[] | undefined): string[] {
  if (!requestedEvents) {
    return [];
  }

  const allowedEvents = new Set<string>(HOSTED_GITHUB_APP_EVENTS);
  return [...new Set(requestedEvents)]
    .filter((event) => !allowedEvents.has(event))
    .sort()
    .map((event) => `event_not_allowed:${event}`);
}

function safeSecretRefs(secretRefs: HostedGitHubAppSecretRefs): string[] {
  return [secretRefs.appId, secretRefs.privateKey, secretRefs.webhookSecret].filter(
    (value) => value.trim() && !looksLikeRawSecretMaterial(value)
  );
}
