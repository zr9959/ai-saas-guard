#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT = ".local/metrics/latest.json";
const DEFAULT_JSONL = ".local/metrics/snapshots.jsonl";
const USER_AGENT = "ai-saas-guard-metrics-snapshot";

const LIMITATIONS = [
  "GitHub traffic is limited to the 14-day GitHub traffic window exposed by the GitHub REST API.",
  "npm downloads are downloads, not unique human users, and may include CI, bots, retries, and caches.",
  "These platform analytics are not design-partner feedback and should not be treated as product validation."
];

const PRIVACY = {
  usesHiddenCliTelemetry: false,
  includesIpAddresses: false,
  includesUserIdentities: false,
  includesCustomerData: false,
  includesSecrets: false
};

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    jsonl: DEFAULT_JSONL
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

    if (key === "repo") {
      options.repo = value;
    } else if (key === "package") {
      options.packageName = value;
    } else if (key === "output") {
      options.output = value;
    } else if (key === "jsonl") {
      options.jsonl = value;
    } else if (key === "fixture-dir") {
      options.fixtureDir = value;
    } else if (key === "generated-at") {
      options.generatedAt = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.help) {
    return options;
  }

  if (!options.repo || !/^[^/]+\/[^/]+$/.test(options.repo)) {
    throw new Error("Provide --repo as owner/name.");
  }
  if (!options.packageName) {
    throw new Error("Provide --package with the npm package name.");
  }

  return options;
}

function usage() {
  return [
    "Usage: node scripts/metrics-snapshot.mjs --repo owner/name --package package-name [options]",
    "",
    "Options:",
    `  --output <path>       JSON snapshot path. Default: ${DEFAULT_OUTPUT}`,
    `  --jsonl <path>        Append-only JSONL history path. Default: ${DEFAULT_JSONL}`,
    "  --fixture-dir <path>  Read test fixtures instead of live GitHub/npm APIs.",
    "  --generated-at <iso>  Override generatedAt for deterministic tests."
  ].join("\n");
}

function toNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function toStringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function dateOnly(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value.slice(0, 10);
}

function normalizeTraffic(raw, key) {
  const daily = Array.isArray(raw?.[key]) ? raw[key] : [];
  return {
    total: toNumber(raw?.count),
    uniques: toNumber(raw?.uniques),
    daily: daily.map((entry) => ({
      date: dateOnly(entry.timestamp),
      count: toNumber(entry.count),
      uniques: toNumber(entry.uniques)
    }))
  };
}

function normalizeTopPaths(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((entry) => ({
      path: toStringOrNull(entry.path),
      title: toStringOrNull(entry.title),
      count: toNumber(entry.count),
      uniques: toNumber(entry.uniques)
    }))
    .filter((entry) => entry.path !== null)
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function normalizeTopReferrers(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((entry) => ({
      referrer: toStringOrNull(entry.referrer),
      count: toNumber(entry.count),
      uniques: toNumber(entry.uniques)
    }))
    .filter((entry) => entry.referrer !== null)
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function normalizeNpmDaily(raw) {
  const downloads = Array.isArray(raw?.downloads) ? raw.downloads : [];
  return downloads.map((entry) => ({
    date: dateOnly(entry.day),
    downloads: toNumber(entry.downloads)
  }));
}

function buildSnapshot({ generatedAt, repo, packageName, sources }) {
  const latestVersion = sources.npmMeta?.["dist-tags"]?.latest ?? null;

  return {
    schemaVersion: 1,
    generatedAt,
    repository: repo,
    packageName,
    privacy: PRIVACY,
    limitations: LIMITATIONS,
    github: {
      defaultBranch: toStringOrNull(sources.repo.default_branch),
      stars: toNumber(sources.repo.stargazers_count),
      forks: toNumber(sources.repo.forks_count),
      watchers: toNumber(sources.repo.subscribers_count),
      openIssues: toNumber(sources.repo.open_issues_count),
      views: normalizeTraffic(sources.views, "views"),
      clones: normalizeTraffic(sources.clones, "clones"),
      topPaths: normalizeTopPaths(sources.paths),
      topReferrers: normalizeTopReferrers(sources.referrers)
    },
    npm: {
      latestVersion,
      modifiedAt: sources.npmMeta?.time?.modified ?? null,
      downloads: {
        lastWeek: toNumber(sources.npmLastWeek.downloads),
        lastWeekRange: {
          start: sources.npmLastWeek.start ?? null,
          end: sources.npmLastWeek.end ?? null
        },
        lastMonth: toNumber(sources.npmLastMonth.downloads),
        lastMonthRange: {
          start: sources.npmLastMonth.start ?? null,
          end: sources.npmLastMonth.end ?? null
        },
        recentDaily: normalizeNpmDaily(sources.npmRangeLastMonth)
      }
    }
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readFixtureSources(fixtureDir) {
  return {
    repo: await readJson(resolve(fixtureDir, "repo.json")),
    views: await readJson(resolve(fixtureDir, "views.json")),
    clones: await readJson(resolve(fixtureDir, "clones.json")),
    paths: await readJson(resolve(fixtureDir, "paths.json")),
    referrers: await readJson(resolve(fixtureDir, "referrers.json")),
    npmLastWeek: await readJson(resolve(fixtureDir, "npm-last-week.json")),
    npmLastMonth: await readJson(resolve(fixtureDir, "npm-last-month.json")),
    npmRangeLastMonth: await readJson(resolve(fixtureDir, "npm-range-last-month.json")),
    npmMeta: await readJson(resolve(fixtureDir, "npm-meta.json"))
  };
}

function encodeRepoPath(repo) {
  return repo.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function encodeNpmPackage(packageName) {
  return encodeURIComponent(packageName);
}

async function fetchJson(url, options = {}) {
  const headers = {
    accept: "application/json",
    "user-agent": USER_AGENT
  };

  if (options.githubToken) {
    headers.authorization = `Bearer ${options.githubToken}`;
    headers["x-github-api-version"] = "2022-11-28";
    headers.accept = "application/vnd.github+json";
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function readLiveSources({ repo, packageName }) {
  const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("Set GH_TOKEN or GITHUB_TOKEN so GitHub traffic endpoints can be read.");
  }

  const repoPath = encodeRepoPath(repo);
  const npmPackage = encodeNpmPackage(packageName);
  const githubOptions = { githubToken };

  return {
    repo: await fetchJson(`https://api.github.com/repos/${repoPath}`, githubOptions),
    views: await fetchJson(`https://api.github.com/repos/${repoPath}/traffic/views`, githubOptions),
    clones: await fetchJson(`https://api.github.com/repos/${repoPath}/traffic/clones`, githubOptions),
    paths: await fetchJson(`https://api.github.com/repos/${repoPath}/traffic/popular/paths`, githubOptions),
    referrers: await fetchJson(`https://api.github.com/repos/${repoPath}/traffic/popular/referrers`, githubOptions),
    npmLastWeek: await fetchJson(`https://api.npmjs.org/downloads/point/last-week/${npmPackage}`),
    npmLastMonth: await fetchJson(`https://api.npmjs.org/downloads/point/last-month/${npmPackage}`),
    npmRangeLastMonth: await fetchJson(`https://api.npmjs.org/downloads/range/last-month/${npmPackage}`),
    npmMeta: await fetchJson(`https://registry.npmjs.org/${npmPackage}`)
  };
}

async function writeSnapshot(path, snapshot) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}

async function appendSnapshot(path, snapshot) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(snapshot)}\n`);
}

function printSummary(snapshot) {
  const summary = {
    generatedAt: snapshot.generatedAt,
    repository: snapshot.repository,
    packageName: snapshot.packageName,
    github: {
      stars: snapshot.github.stars,
      openIssues: snapshot.github.openIssues,
      views: snapshot.github.views.total,
      viewUniques: snapshot.github.views.uniques,
      clones: snapshot.github.clones.total,
      cloneUniques: snapshot.github.clones.uniques
    },
    npm: {
      latestVersion: snapshot.npm.latestVersion,
      downloadsLastWeek: snapshot.npm.downloads.lastWeek,
      downloadsLastMonth: snapshot.npm.downloads.lastMonth
    }
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const sources = options.fixtureDir
    ? await readFixtureSources(options.fixtureDir)
    : await readLiveSources({ repo: options.repo, packageName: options.packageName });

  const snapshot = buildSnapshot({
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repo: options.repo,
    packageName: options.packageName,
    sources
  });

  await writeSnapshot(options.output, snapshot);
  await appendSnapshot(options.jsonl, snapshot);
  printSummary(snapshot);
}

main().catch((error) => {
  process.stderr.write(`metrics-snapshot: ${error.message}\n`);
  process.exitCode = 1;
});
