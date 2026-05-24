import {
  evaluateHostedOperationalReleaseGate,
  type HostedOperationalReleaseGateDecision,
  type HostedOperationalReleaseGateEvidence
} from "./contracts.js";
import {
  planHostedNodeContainerDeployment,
  type HostedNodeContainerDeploymentPlan,
  type HostedNodeContainerDeploymentSecretRefs
} from "./app.js";
import {
  planHostedGitHubAppDeployment,
  type HostedGitHubAppDeploymentPlan,
  type HostedGitHubAppReleaseGateSummary
} from "./github-app.js";

export interface HostedProviderAdapterRefs {
  secretManager: string;
  queue: string;
  compactReportStore: string;
  workerSandbox: string;
  checkRunPublisher: string;
  logDrain: string;
  metrics: string;
  rollback: string;
  incidentResponse: string;
}

export interface HostedProviderBindingInput {
  environment: string;
  providerRefs: HostedProviderAdapterRefs;
  rawPrivateKey?: string;
  rawWebhookSecret?: string;
  rawInstallationToken?: string;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedProviderBindingPlan {
  readyToBindProviders: boolean;
  blockedReasons: string[];
  environment: string;
  adapters: {
    secretManager: {
      ref: string;
      storesRawSecretsInPlan: false;
    };
    queue: {
      ref: string;
      durable: true;
      idempotent: true;
    };
    compactReportStore: {
      ref: string;
      persistsRawSource: false;
      persistsRawDiffs: false;
      persistsSecrets: false;
      persistsCustomerPayloads: false;
    };
    workerSandbox: {
      ref: string;
      readOnly: true;
      shell: "disabled";
      networkAccess: "disabled";
      cleanupRequired: true;
    };
    checkRunPublisher: {
      ref: string;
      writesChecks: true;
      createsPrComments: false;
    };
  };
  observability: {
    logs: {
      ref: string;
      redacted: true;
      includesRawWebhookPayloads: false;
      includesSecrets: false;
    };
    metrics: {
      ref: string;
      required: true;
    };
  };
  operational: {
    rollback: {
      ref: string;
      required: true;
    };
    incidentResponse: {
      ref: string;
      required: true;
    };
  };
  privacy: HostedStagingPrivacy;
}

export interface HostedStagingDeploymentInput {
  appName: string;
  environment: string;
  publicBaseUrl: string;
  homepageUrl: string;
  containerImageDigest: string;
  commitSha: string;
  scannerVersion: string;
  evaluatedAt: string;
  releaseNotes: string;
  secretRefs: HostedNodeContainerDeploymentSecretRefs;
  providerRefs: HostedProviderAdapterRefs;
  evidence: HostedOperationalReleaseGateEvidence[];
  rawPrivateKey?: string;
  rawWebhookSecret?: string;
  rawInstallationToken?: string;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedStagingDeploymentPlan {
  readyForStagingExposure: boolean;
  blockedReasons: string[];
  environment: string;
  nodeContainer: HostedNodeContainerDeploymentPlan;
  providerBinding: HostedProviderBindingPlan;
  releaseGate: HostedOperationalReleaseGateDecision;
  githubApp: HostedGitHubAppDeploymentPlan;
  executionOrder: Array<
    | "bind_provider_adapters"
    | "deploy_node_container_roles"
    | "configure_github_app_webhook"
    | "run_webhook_replay"
    | "run_worker_cleanup_probe"
    | "verify_check_run_publication"
    | "record_release_gate_evidence"
  >;
  privacy: HostedStagingPrivacy;
}

export interface HostedGitHubAppPromotionInput extends HostedStagingDeploymentInput {
  stagingDeploymentVerified: boolean;
  stagingCheckRunPublished: boolean;
  stagingRollbackVerified: boolean;
}

export interface HostedGitHubAppPromotionPlan {
  readyForProductionGitHubApp: boolean;
  blockedReasons: string[];
  production: HostedStagingDeploymentPlan;
  stagingGates: {
    deploymentVerified: boolean;
    checkRunPublished: boolean;
    rollbackVerified: boolean;
  };
  privacy: HostedStagingPrivacy;
}

export interface HostedStagingPrivacy {
  includesPrivateKey: false;
  includesWebhookSecret: false;
  includesInstallationToken: false;
  includesRawWebhookPayload: false;
  includesUntrustedPrText: false;
  includesRawSource: false;
  includesRawDiffs: false;
  includesSecrets: false;
  includesCustomerPayloads: false;
  includesPrivateUrls: false;
}

const providerRefPrefixes: Record<keyof HostedProviderAdapterRefs, string> = {
  secretManager: "secret-manager:",
  queue: "queue:",
  compactReportStore: "store:",
  workerSandbox: "sandbox:",
  checkRunPublisher: "github-checks:",
  logDrain: "logs:",
  metrics: "metrics:",
  rollback: "rollback:",
  incidentResponse: "runbook:"
};

export function planHostedProviderBinding(
  input: HostedProviderBindingInput
): HostedProviderBindingPlan {
  const blockedReasons = [
    ...providerRefBlockedReasons(input.providerRefs),
    ...rawInputBlockedReasons(input)
  ];

  return {
    readyToBindProviders: blockedReasons.length === 0,
    blockedReasons,
    environment: input.environment,
    adapters: {
      secretManager: {
        ref: safeProviderRef(input.providerRefs.secretManager, "secret-manager:"),
        storesRawSecretsInPlan: false
      },
      queue: {
        ref: safeProviderRef(input.providerRefs.queue, "queue:"),
        durable: true,
        idempotent: true
      },
      compactReportStore: {
        ref: safeProviderRef(input.providerRefs.compactReportStore, "store:"),
        persistsRawSource: false,
        persistsRawDiffs: false,
        persistsSecrets: false,
        persistsCustomerPayloads: false
      },
      workerSandbox: {
        ref: safeProviderRef(input.providerRefs.workerSandbox, "sandbox:"),
        readOnly: true,
        shell: "disabled",
        networkAccess: "disabled",
        cleanupRequired: true
      },
      checkRunPublisher: {
        ref: safeProviderRef(input.providerRefs.checkRunPublisher, "github-checks:"),
        writesChecks: true,
        createsPrComments: false
      }
    },
    observability: {
      logs: {
        ref: safeProviderRef(input.providerRefs.logDrain, "logs:"),
        redacted: true,
        includesRawWebhookPayloads: false,
        includesSecrets: false
      },
      metrics: {
        ref: safeProviderRef(input.providerRefs.metrics, "metrics:"),
        required: true
      }
    },
    operational: {
      rollback: {
        ref: safeProviderRef(input.providerRefs.rollback, "rollback:"),
        required: true
      },
      incidentResponse: {
        ref: safeProviderRef(input.providerRefs.incidentResponse, "runbook:"),
        required: true
      }
    },
    privacy: hostedStagingPrivacy()
  };
}

export function planHostedStagingDeployment(
  input: HostedStagingDeploymentInput
): HostedStagingDeploymentPlan {
  const providerBinding = planHostedProviderBinding({
    environment: input.environment,
    providerRefs: input.providerRefs,
    rawPrivateKey: input.rawPrivateKey,
    rawWebhookSecret: input.rawWebhookSecret,
    rawInstallationToken: input.rawInstallationToken,
    rawSource: input.rawSource,
    rawDiff: input.rawDiff,
    secretValues: input.secretValues,
    customerPayload: input.customerPayload
  });
  const nodeContainer = planHostedNodeContainerDeployment({
    environment: input.environment,
    publicBaseUrl: input.publicBaseUrl,
    containerImageDigest: input.containerImageDigest,
    secretRefs: input.secretRefs,
    queueRef: input.providerRefs.queue,
    compactReportStoreRef: input.providerRefs.compactReportStore,
    workerSandboxRef: input.providerRefs.workerSandbox,
    checkRunPublisherRef: input.providerRefs.checkRunPublisher,
    rawPrivateKey: input.rawPrivateKey,
    rawWebhookSecret: input.rawWebhookSecret,
    rawInstallationToken: input.rawInstallationToken,
    rawSource: input.rawSource,
    rawDiff: input.rawDiff,
    secretValues: input.secretValues,
    customerPayload: input.customerPayload
  });
  const releaseGate = evaluateHostedOperationalReleaseGate({
    commitSha: input.commitSha,
    scannerVersion: input.scannerVersion,
    deploymentTarget: input.environment,
    evaluatedAt: input.evaluatedAt,
    evidence: input.evidence,
    releaseNotes: input.releaseNotes,
    containerImageDigest: input.containerImageDigest,
    rawSource: input.rawSource,
    rawDiff: input.rawDiff,
    secretValues: input.secretValues,
    customerPayload: input.customerPayload
  });
  const githubApp = planHostedGitHubAppDeployment({
    appName: input.appName,
    homepageUrl: input.homepageUrl,
    webhookUrl: nodeContainer.endpoints.webhookUrl,
    environment: input.environment,
    containerImageDigest: input.containerImageDigest,
    secretRefs: {
      appId: input.secretRefs.githubAppId,
      privateKey: input.secretRefs.githubAppPrivateKey,
      webhookSecret: input.secretRefs.githubWebhookSecret
    },
    releaseGate: githubReleaseGateSummary(releaseGate),
    rawPrivateKey: input.rawPrivateKey,
    rawWebhookSecret: input.rawWebhookSecret
  });
  const blockedReasons = [
    ...prefixBlockedReasons("node_container", nodeContainer.blockedReasons),
    ...prefixBlockedReasons("provider_binding", providerBinding.blockedReasons),
    ...releaseGateBlockedReasons(releaseGate),
    ...prefixBlockedReasons("github_app", githubApp.blockedReasons)
  ];

  return {
    readyForStagingExposure: blockedReasons.length === 0,
    blockedReasons,
    environment: input.environment,
    nodeContainer,
    providerBinding,
    releaseGate,
    githubApp,
    executionOrder: [
      "bind_provider_adapters",
      "deploy_node_container_roles",
      "configure_github_app_webhook",
      "run_webhook_replay",
      "run_worker_cleanup_probe",
      "verify_check_run_publication",
      "record_release_gate_evidence"
    ],
    privacy: hostedStagingPrivacy()
  };
}

export function planHostedGitHubAppPromotion(
  input: HostedGitHubAppPromotionInput
): HostedGitHubAppPromotionPlan {
  const productionReleaseGate =
    input.stagingDeploymentVerified && input.stagingCheckRunPublished && input.stagingRollbackVerified
      ? input.evidence
      : input.evidence.filter((evidence) => evidence.id !== "release_cleanup");
  const production = planHostedStagingDeployment({
    ...input,
    evidence: productionReleaseGate
  });
  const blockedReasons = [
    ...(input.stagingDeploymentVerified ? [] : ["staging_deployment_not_verified"]),
    ...(input.stagingCheckRunPublished ? [] : ["staging_check_run_not_published"]),
    ...(input.stagingRollbackVerified ? [] : ["staging_rollback_not_verified"]),
    ...prefixBlockedReasons("production:github_app", production.githubApp.blockedReasons)
  ];

  return {
    readyForProductionGitHubApp: blockedReasons.length === 0,
    blockedReasons,
    production,
    stagingGates: {
      deploymentVerified: input.stagingDeploymentVerified,
      checkRunPublished: input.stagingCheckRunPublished,
      rollbackVerified: input.stagingRollbackVerified
    },
    privacy: hostedStagingPrivacy()
  };
}

function providerRefBlockedReasons(providerRefs: HostedProviderAdapterRefs): string[] {
  const reasons: string[] = [];
  for (const [key, prefix] of Object.entries(providerRefPrefixes) as Array<
    [keyof HostedProviderAdapterRefs, string]
  >) {
    const value = providerRefs[key].trim();
    if (!value) {
      reasons.push(`missing_provider_ref:${key}`);
    } else if (!value.startsWith(prefix)) {
      reasons.push(`invalid_provider_ref:${key}`);
    }
  }

  return reasons;
}

function rawInputBlockedReasons(input: HostedProviderBindingInput): string[] {
  const reasons: string[] = [];
  for (const key of ["rawPrivateKey", "rawWebhookSecret", "rawInstallationToken"] as const) {
    if (typeof input[key] === "string" && input[key].trim()) {
      reasons.push(`raw_secret_material:${key}`);
    }
  }
  for (const key of ["rawSource", "rawDiff"] as const) {
    if (typeof input[key] === "string" && input[key].trim()) {
      reasons.push(`raw_source_material:${key}`);
    }
  }
  if (Array.isArray(input.secretValues) && input.secretValues.some((value) => value.trim())) {
    reasons.push("raw_secret_material:secretValues");
  }
  if (input.customerPayload !== undefined && input.customerPayload !== null) {
    reasons.push("raw_customer_payload:customerPayload");
  }

  return reasons;
}

function releaseGateBlockedReasons(decision: HostedOperationalReleaseGateDecision): string[] {
  return [
    ...decision.missingEvidenceIds.map((id) => `release_gate:missing:${id}`),
    ...decision.failedEvidenceIds.map((id) => `release_gate:failed:${id}`),
    ...decision.staleEvidenceIds.map((id) => `release_gate:stale:${id}`),
    ...decision.exceptionEvidenceIds.map((id) => `release_gate:exception:${id}`),
    ...decision.releaseNotesForbiddenClaims.map((claim) => `release_gate:claim:${claim}`),
    ...(decision.containerImageDigestRecorded ? [] : ["release_gate:missing_container_digest"])
  ];
}

function githubReleaseGateSummary(
  decision: HostedOperationalReleaseGateDecision
): HostedGitHubAppReleaseGateSummary {
  return {
    shouldExposeHostedEnvironment: decision.shouldExposeHostedEnvironment,
    blocked: decision.blocked,
    containerImageDigestRecorded: decision.containerImageDigestRecorded,
    missingEvidenceIds: decision.missingEvidenceIds,
    failedEvidenceIds: decision.failedEvidenceIds,
    staleEvidenceIds: decision.staleEvidenceIds,
    exceptionEvidenceIds: decision.exceptionEvidenceIds,
    releaseNotesCompliant: decision.releaseNotesCompliant
  };
}

function prefixBlockedReasons(prefix: string, reasons: string[]): string[] {
  return reasons.map((reason) => `${prefix}:${reason}`);
}

function safeProviderRef(value: string, prefix: string): string {
  const ref = value.trim();
  return ref.startsWith(prefix) ? ref : "";
}

function hostedStagingPrivacy(): HostedStagingPrivacy {
  return {
    includesPrivateKey: false,
    includesWebhookSecret: false,
    includesInstallationToken: false,
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesPrivateUrls: false
  };
}
