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
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
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
