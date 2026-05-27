#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";

const USER_AGENT = "ai-saas-guard-cross-project-discovery";
const DEFAULT_OUTPUT = ".local/cross-project-discovery/latest.json";
const DEFAULT_SUMMARY = ".local/cross-project-discovery/summary.md";

const REQUIRED_CHECKS = [
  {
    id: "tiybai-blog-pagestow",
    label: "TIYBAI PageStow resource post",
    url: "https://www.tiybai.com/blog/save-browser-context-without-cloud-sync",
    patterns: ["PageStow homepage", "https://plugin.tiybai.com/", "TIYBAI Toolbox"]
  },
  {
    id: "tiybai-blog-ai-saas-guard",
    label: "TIYBAI ai-saas-guard resource post",
    url: "https://www.tiybai.com/blog/launch-checks-for-ai-built-saas-apps",
    patterns: ["ai-saas-guard npm package", "https://github.com/zr9959/ai-saas-guard", "TIYBAI JSON Formatter"]
  },
  {
    id: "tiybai-blog-sitemap",
    label: "TIYBAI blog sitemap",
    url: "https://www.tiybai.com/sitemap-blog.xml",
    patterns: ["save-browser-context-without-cloud-sync", "launch-checks-for-ai-built-saas-apps"]
  },
  {
    id: "tiybai-content-sitemap",
    label: "TIYBAI content sitemap",
    url: "https://www.tiybai.com/sitemap-content.xml",
    patterns: ["save-browser-context-without-cloud-sync", "launch-checks-for-ai-built-saas-apps"]
  },
  {
    id: "tiybai-feed",
    label: "TIYBAI RSS feed",
    url: "https://www.tiybai.com/feed.xml",
    patterns: ["save-browser-context-without-cloud-sync", "launch-checks-for-ai-built-saas-apps"]
  },
  {
    id: "tiybai-llms",
    label: "TIYBAI llms.txt",
    url: "https://www.tiybai.com/llms.txt",
    patterns: ["PageStow: https://plugin.tiybai.com/", "ai-saas-guard: https://git.tiybai.com/", "PawMiles: https://shop.tiybai.com/"]
  },
  {
    id: "pagestow-home",
    label: "PageStow homepage",
    url: "https://plugin.tiybai.com/",
    patterns: ["Related TIYBAI projects", "ai-saas-guard", "PawMiles"]
  },
  {
    id: "pagestow-privacy",
    label: "PageStow privacy footer",
    url: "https://plugin.tiybai.com/privacy",
    patterns: ["More from TIYBAI", "ai-saas-guard", "PawMiles"]
  },
  {
    id: "pagestow-support",
    label: "PageStow support footer",
    url: "https://plugin.tiybai.com/support",
    patterns: ["More from TIYBAI", "ai-saas-guard", "PawMiles"]
  },
  {
    id: "pagestow-sitemap",
    label: "PageStow sitemap",
    url: "https://plugin.tiybai.com/sitemap.xml",
    patterns: ["https://plugin.tiybai.com/", "https://plugin.tiybai.com/privacy", "https://plugin.tiybai.com/support"]
  },
  {
    id: "pagestow-llms",
    label: "PageStow llms.txt",
    url: "https://plugin.tiybai.com/llms.txt",
    patterns: ["Related TIYBAI Projects", "TIYBAI: https://www.tiybai.com/", "PawMiles: https://shop.tiybai.com/"]
  },
  {
    id: "pagestow-ai",
    label: "PageStow ai.txt",
    url: "https://plugin.tiybai.com/ai.txt",
    patterns: ["Related TIYBAI projects", "ai-saas-guard: https://www.npmjs.com/package/ai-saas-guard"]
  },
  {
    id: "ai-saas-guard-readme",
    label: "ai-saas-guard GitHub README",
    url: "https://raw.githubusercontent.com/zr9959/ai-saas-guard/main/README.md",
    patterns: ["Related TIYBAI Tools", "https://plugin.tiybai.com/", "AI Metadata Generator"]
  },
  {
    id: "pawmiles-robots",
    label: "PawMiles robots.txt",
    url: "https://shop.tiybai.com/robots.txt",
    patterns: ["Sitemap: https://shop.tiybai.com/sitemap.xml"]
  },
  {
    id: "pawmiles-sitemap",
    label: "PawMiles sitemap",
    url: "https://shop.tiybai.com/sitemap.xml",
    patterns: ["sitemap_products", "sitemap_collections", "sitemap_blogs"]
  }
];

const OPTIONAL_CHECKS = [
  {
    id: "pawmiles-footer-link",
    label: "PawMiles live TIYBAI footer link",
    url: "https://shop.tiybai.com/",
    patterns: ["A TIYBAI project", "https://www.tiybai.com/"]
  }
];

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    summaryMarkdown: DEFAULT_SUMMARY
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    index += 1;
    if (key === "output") {
      options.output = value;
    } else if (key === "summary-markdown") {
      options.summaryMarkdown = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    "Usage: node scripts/cross-project-discovery-check.mjs [options]",
    "",
    "Options:",
    `  --output <path>             JSON output path. Default: ${DEFAULT_OUTPUT}`,
    `  --summary-markdown <path>   Markdown summary path. Default: ${DEFAULT_SUMMARY}`
  ].join("\n");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/plain,text/html,application/xml,application/json;q=0.9,*/*;q=0.1"
    }
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    finalUrl: response.url,
    text
  };
}

async function checkPage(check, required) {
  try {
    const response = await fetchText(check.url);
    const missingPatterns = check.patterns.filter((pattern) => !response.text.includes(pattern));
    return {
      id: check.id,
      label: check.label,
      url: check.url,
      finalUrl: response.finalUrl,
      status: response.status,
      required,
      ok: response.ok && missingPatterns.length === 0,
      missingPatterns
    };
  } catch (error) {
    return {
      id: check.id,
      label: check.label,
      url: check.url,
      finalUrl: null,
      status: null,
      required,
      ok: false,
      error: error.message,
      missingPatterns: check.patterns
    };
  }
}

async function checkRedirect() {
  try {
    const response = await fetch("https://git.tiybai.com/", {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow"
    });
    return {
      id: "git-tiybai-redirect",
      label: "git.tiybai.com redirect",
      url: "https://git.tiybai.com/",
      finalUrl: response.url,
      status: response.status,
      required: true,
      ok: response.ok && response.url.startsWith("https://github.com/zr9959/ai-saas-guard")
    };
  } catch (error) {
    return {
      id: "git-tiybai-redirect",
      label: "git.tiybai.com redirect",
      url: "https://git.tiybai.com/",
      finalUrl: null,
      status: null,
      required: true,
      ok: false,
      error: error.message
    };
  }
}

async function checkNpm() {
  try {
    const response = await fetch("https://registry.npmjs.org/ai-saas-guard/latest", {
      headers: { "user-agent": USER_AGENT, accept: "application/json" }
    });
    const body = await response.json();
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    return {
      id: "npm-latest-metadata",
      label: "npm latest metadata",
      url: "https://registry.npmjs.org/ai-saas-guard/latest",
      finalUrl: response.url,
      status: response.status,
      required: false,
      ok: response.ok,
      version: body.version ?? null,
      keywords,
      expectedFutureKeywordsPresent: keywords.includes("tiybai") && keywords.includes("launch-risk")
    };
  } catch (error) {
    return {
      id: "npm-latest-metadata",
      label: "npm latest metadata",
      url: "https://registry.npmjs.org/ai-saas-guard/latest",
      finalUrl: null,
      status: null,
      required: false,
      ok: false,
      error: error.message
    };
  }
}

function renderSummary(snapshot) {
  const requiredFailures = snapshot.checks.filter((check) => check.required && !check.ok);
  const optionalWarnings = snapshot.checks.filter((check) => !check.required && !check.ok);
  const npm = snapshot.checks.find((check) => check.id === "npm-latest-metadata");

  const lines = [
    "# Cross-Project Discovery Check",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    `Required checks: ${snapshot.requiredPassed}/${snapshot.requiredTotal} passing`,
    `Optional warnings: ${optionalWarnings.length}`,
    ""
  ];

  if (requiredFailures.length > 0) {
    lines.push("## Required Failures", "");
    for (const check of requiredFailures) {
      lines.push(`- ${check.label}: status=${check.status ?? "n/a"} url=${check.url}`);
      if (check.missingPatterns?.length > 0) {
        lines.push(`  Missing: ${check.missingPatterns.join(", ")}`);
      }
      if (check.error) {
        lines.push(`  Error: ${check.error}`);
      }
    }
    lines.push("");
  }

  if (optionalWarnings.length > 0 || npm) {
    lines.push("## Notes", "");
    for (const check of optionalWarnings) {
      lines.push(`- ${check.label}: optional signal not present yet.`);
    }
    if (npm) {
      lines.push(`- npm latest version: ${npm.version ?? "unknown"}. Future discovery keywords present: ${npm.expectedFutureKeywordsPresent ? "yes" : "no"}.`);
    }
    lines.push("");
  }

  lines.push("## Checks", "");
  lines.push("| Check | Required | Status | Final URL |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of snapshot.checks) {
    lines.push(`| ${check.label} | ${check.required ? "yes" : "no"} | ${check.ok ? "pass" : "review"} | ${check.finalUrl ?? check.url} |`);
  }

  return `${lines.join("\n")}\n`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const pageChecks = await Promise.all([
    ...REQUIRED_CHECKS.map((check) => checkPage(check, true)),
    ...OPTIONAL_CHECKS.map((check) => checkPage(check, false)),
    checkRedirect(),
    checkNpm()
  ]);

  const required = pageChecks.filter((check) => check.required);
  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    privacy: {
      readsPublicEndpointsOnly: true,
      readsSecrets: false,
      modifiesFiles: false,
      publishesPackages: false,
      pushesShopify: false,
      usesReddit: false
    },
    requiredTotal: required.length,
    requiredPassed: required.filter((check) => check.ok).length,
    checks: pageChecks
  };

  const summary = renderSummary(snapshot);
  await writeJson(options.output, snapshot);
  await writeText(options.summaryMarkdown, summary);
  process.stdout.write(summary);

  if (snapshot.requiredPassed !== snapshot.requiredTotal) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`cross-project-discovery-check: ${error.message}\n`);
  process.exitCode = 1;
});
