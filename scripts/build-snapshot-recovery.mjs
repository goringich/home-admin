import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unavailableAiCompanyMissionControl } from "./ai-company-mission-control.mjs";
import { normalizeCodexAudit } from "./codex-audit.mjs";
import {
  normalizeCommercialSummary,
  normalizeRevenueAutopilot,
} from "./commercial-summary.mjs";
import { normalizeCommercialBilling } from "./commercial-billing.mjs";
import { normalizeCommercialLaunchObservability } from "./commercial-launch-observability.mjs";
import { normalizeLocalAgentPlatform } from "./local-agent-platform.mjs";
import { sanitizeServicePlacementProjection } from "./service-placement-projection.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const builderPath = process.env.ATLAS_SNAPSHOT_BUILDER || path.join(rootDir, "scripts", "build-snapshot.mjs");
const outputPath = process.env.ATLAS_SNAPSHOT_OUTPUT || path.join(rootDir, "public", "snapshot.json");
const recoveryStatePath = process.env.ATLAS_SNAPSHOT_RECOVERY_STATE
  || path.join(os.homedir(), ".local", "state", "project-atlas", "snapshot-recovery.json");

function sourceMeta() {
  return { path: "", generatedAt: "", modifiedAt: "", modifiedAtMs: 0 };
}

function boundedMessage(value, limit = 700) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function emptyAiLab(generatedAt) {
  return {
    generatedAt,
    status: "unavailable",
    source: sourceMeta(),
    control: {
      tokenBudgetTier: "unknown",
      retrievalSources: [],
      excludedSources: [],
      selectedAgentRoute: {
        routeId: "",
        routeLabel: "unavailable",
        selectedAgent: "",
        defaultContextBudget: "unknown",
        localCloudDecision: { mode: "unavailable", reason: "snapshot recovery fallback" },
      },
      sandboxStatus: {
        backend: "unknown",
        mode: "unavailable",
        permissionTier: "unknown",
        rawConversationMirrorsAllowed: false,
        hostHealth: "unavailable",
      },
      activeRuns: [],
      latestRunReports: [],
      tokenWasteMarkers: {
        filesScanned: 0,
        repeatedHealthGateCount: 0,
        bridgeNoiseFiles: 0,
        filesWithNoAssistantReply: 0,
        highWasteCapsulesPath: "",
      },
      goalCapsules: [],
      nextBestAction: "Repair the canonical Atlas snapshot builder.",
    },
    groups: { codexControlLab: [], scientificVisualLab: [] },
    scientificTools: { generatedAt, inventory: [], installed: [], missing: [], launchers: [] },
    prepareFlow: {
      endpoint: "/api/ai-lab/prepare",
      toolInventoryEndpoint: "/api/ai-lab/tool-inventory",
      launcherEndpoint: "/api/ai-lab/launch",
      executionPolicy: "disabled_while_snapshot_unavailable",
      launcherIds: [],
    },
  };
}

function emptyLocalCodexLab(generatedAt) {
  const source = sourceMeta();
  return {
    generatedAt,
    hostHealth: "unavailable",
    source,
    serviceStatus: {
      unit: "",
      enabled: null,
      activeState: "unknown",
      healthStatus: "unavailable",
      reportedHealthStatus: "unavailable",
      freshness: "unavailable",
      evidenceSource: "snapshot_recovery_fallback",
      updatedAt: generatedAt,
      healthUrl: "",
    },
    modelRouting: {
      fast: "",
      balanced: "",
      heavy: "",
      planning: "",
      embedding: "",
      evolution: {
        status: "unavailable",
        generatedAt,
        mode: "unavailable",
        evalPath: "",
        winners: {},
        promotionCandidates: {},
        promoted: {},
        sanitized: true,
      },
      source,
    },
    retrievalPolicy: { priorityOrder: [], denylistedClasses: [], denylistedFiles: 0, source },
    tokenEfficiency: {
      filesScanned: 0,
      longGoalRuns: 0,
      bridgeNoiseFiles: 0,
      repeatedHealthGateCount: 0,
      filesWithNoAssistantReply: 0,
      source,
    },
    openclawReliability: {
      warningCount: 0,
      status: "unavailable",
      classifications: {},
      recommendedActions: ["Repair the canonical Atlas snapshot builder."],
      source,
    },
    repoIntel: { targetCount: 0, safeTargets: [], targets: [], source },
    research: {
      runCount: 0,
      sourceCardCount: 0,
      providers: [],
      sourceDomains: [],
      latestRun: {},
      paths: {},
      freshness: {},
      source,
    },
    memory: {
      workspaceFocus: "snapshot recovery",
      activeGoalCount: 0,
      activeGoalIds: [],
      latestRunId: "",
      latestTask: "",
      hostHealth: "unavailable",
      highlights: [],
      sourcePaths: {},
      source,
    },
    tokenEconomy: {
      contextBudgetsPath: "",
      tokenWasteMetricsPath: "",
      runSummariesPath: "",
      freshness: {},
      source,
    },
    failureAwareObservability: {
      hostHealth: "unavailable",
      safeMode: "unknown",
      openclawWarningCount: 0,
      latestRunFailures: ["snapshot_builder_failed"],
      sourcePaths: {},
      source,
    },
    activeRuns: [],
    latestRunReports: [],
    sharedRunReports: [],
    codexOrchestratorBridge: {
      status: "unavailable",
      available: false,
      fixCommand: "",
      endpoints: { status: "", queue: "", recentRuns: "", dispatch: "", enqueue: "" },
      scripts: { prepare: "", dispatch: "" },
      projectRegistry: "",
      operationPolicy: "",
      runtimeRoot: "",
      reportRoot: "",
      queueCounts: { queued: 0, running: 0, done: 0, failed: 0 },
      queue: [],
      running: [],
      recentRuns: [],
      latestRunReports: [],
      failedVerification: [],
      dirtyAfterRun: [],
      nextExactAction: "Repair the canonical Atlas snapshot builder.",
      source,
    },
    knowledgeGraphStatus: {
      status: "unavailable",
      scope: "",
      generatedAt,
      nodeCount: 0,
      edgeCount: 0,
      durationMs: 0,
      sanitized: true,
    },
    contextPackStatus: {
      status: "unavailable",
      generatedAt,
      scope: "",
      agent: "",
      taskHash: "",
      contextBudget: "unknown",
      hybridStatus: "unavailable",
      hybridMatchCount: 0,
      repoIntelStatus: "unavailable",
      repoCandidateCount: 0,
      goalCount: 0,
      runSummaryCount: 0,
      verificationCommandCount: 0,
      sourceRegistryHitCount: 0,
      sanitized: true,
    },
    ragE2eEvalStatus: {
      status: "unavailable",
      scope: "",
      limit: 0,
      budget: "unknown",
      fixtureCount: 0,
      hitAt1: 0,
      hitAt3: 0,
      mrr: 0,
      sanitized: true,
    },
    localModelRagEntrypointStatus: {
      status: "unavailable",
      generatedAt,
      taskHash: "",
      scope: "",
      model: "",
      mode: "unavailable",
      graphMatchCount: 0,
      sourceRegistryHitCount: 0,
      dryRun: true,
      sanitized: true,
    },
    codexContextEntrypointStatus: {
      status: "unavailable",
      generatedAt,
      scope: "",
      taskHash: "",
      sourceRegistryHitCount: 0,
      graphMatchCount: 0,
      sanitized: true,
    },
    localGpuLiveBenchStatus: {
      status: "unavailable",
      generatedAt,
      model: "",
      numCtx: 0,
      numPredict: 0,
      processorLine: "",
      metrics: {
        status: "unavailable",
        elapsedSec: 0,
        promptEvalCount: 0,
        promptEvalSec: 0,
        evalCount: 0,
        evalSec: 0,
        tokensPerSec: 0,
      },
      gpuSummary: {
        status: "unavailable",
        sampleCount: 0,
        gpuUtilAvgPct: 0,
        gpuUtilMaxPct: 0,
        memUtilAvgPct: 0,
        memUtilMaxPct: 0,
        memUsedAvgMib: 0,
        memUsedMaxMib: 0,
        powerAvgW: 0,
        powerMaxW: 0,
        tempMaxC: 0,
        pstates: [],
      },
      offloadRecommendations: {
        status: "unavailable",
        fast: "",
        balanced: "",
        heavy: "",
        rankedCount: 0,
        sanitized: true,
      },
      sanitized: true,
    },
    evalStatus: { status: "unavailable", matched_spec_ids: [], spec_count: 0, specs: [] },
    latestHermes: {
      status: "unavailable",
      runtime_state: "missing",
      state_reason: "snapshot_builder_failed",
      selected_runtime: "",
      requested_runtime: "",
      fallback_used: false,
      fallback_target: "",
      policy_allowed: false,
      delegation_status: "unavailable",
      preflight_completed: false,
      preflight_mode_resolved: "",
      hermes_installed: false,
      hermes_binary: "",
      runtime_policy_path: "",
      worker_manifest_path: "",
      workers_dir: "",
      skip_reason: "snapshot_builder_failed",
      saved_context_chars_estimated: 0,
      failed_roles: [],
      planned_worker_models: {},
    },
    agentRouting: {
      source_path: "",
      default_route: "",
      default_context_budget: "unknown",
      agents: [],
      routes: [],
      status: "unavailable",
    },
    tokenCostPlaceholders: {
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      cost_usd: null,
    },
    failedChecks: ["snapshot_builder_failed"],
    nextBestAction: "Repair the canonical Atlas snapshot builder.",
    goalCapsules: [],
    runSummaries: [],
    aiLab: emptyAiLab(generatedAt),
  };
}

function emptyLocalAiControl(generatedAt) {
  const source = sourceMeta();
  return {
    generatedAt,
    host: { hostname: "", overall: "unavailable", safe_mode: null, top_issue: "snapshot_builder_failed" },
    ollamaVersion: "",
    recommendations: {},
    roleMap: {},
    models: [],
    activeModels: [],
    cleanup: {
      keep: [],
      "keep-but-manual": [],
      "candidate-for-removal": [],
      "unknown-needs-test": [],
    },
    gemma4: { recommended_tag: "", tags: {}, reason: "snapshot unavailable" },
    runtimes: [],
    blockers: ["snapshot_builder_failed"],
    atlas: {
      status: "degraded",
      health: "unavailable",
      build_exists: true,
      processes: [],
      repo_dirty: null,
      repo_error: "snapshot_builder_failed",
    },
    openclaw: { overview: {}, channels: [], agents: [] },
    security: { summary: { critical: 0, warn: 0, info: 0 }, findings: [] },
    terminalCompletion: {
      contract: {},
      latestRun: { status: "unavailable" },
      dormantComponents: {
        status: "unavailable",
        component_count: 0,
        decisions: { activate: 0, retire: 0, defer: 0 },
        components: [],
      },
      source,
    },
    source,
  };
}

function emptyAiTelemetry() {
  const missing = { status: "missing" };
  const guardrail = { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} };
  return {
    generatedAt: "",
    retrievalQuality: missing,
    codeContextSearch: missing,
    skillRegistry: { status: "missing", source_count: 0, installed_count: 0, entries: [] },
    skillUsage: { status: "missing", total: 0, by_skill: [] },
    codexProductivity: missing,
    tokenContextWaste: missing,
    modelRouting: missing,
    toolUsage: missing,
    aiResponse: missing,
    aiResponseUsage: missing,
    promptCacheEfficiency: missing,
    costByModel: { status: "missing", entries: [] },
    costByGoal: { status: "missing", entries: [] },
    tokensPerVerifiedRun: missing,
    budgetDrift: missing,
    research: missing,
    memory: missing,
    tokenGovernor: missing,
    hermesRuntime: { status: "missing", state: "missing", installed: false, fallback_used: false, state_counts: [] },
    agentTrace: missing,
    cacheLedger: missing,
    redundantWork: missing,
    tokenEconomy: missing,
    accountAnalytics: missing,
    tokenEconomyReport: missing,
    failureAwareObservability: missing,
    guardrailEvents: guardrail,
    aiActivityExplorer: {
      status: "missing",
      overview: { status: "missing" },
      trends: { status: "missing" },
      explore: { status: "missing" },
      guardrails: guardrail,
    },
    recentEvents: [],
    source: sourceMeta(),
  };
}

function fallbackSnapshot(reason) {
  const generatedAt = new Date().toISOString();
  const localAgentBase = normalizeLocalAgentPlatform(null);
  const firstMoneySummary = normalizeCommercialSummary(null, Date.now());
  const revenueAutopilot = normalizeRevenueAutopilot(null, Date.now());
  const commercialBilling = normalizeCommercialBilling(null);
  const commercialLaunch = normalizeCommercialLaunchObservability({
    summary: firstMoneySummary,
    revenue: revenueAutopilot,
    billing: commercialBilling,
  }, Date.now());
  const source = sourceMeta();
  const localAiControl = emptyLocalAiControl(generatedAt);
  return {
    generatedAt,
    focusProjectIds: [],
    summary: {
      totalRepos: 0,
      focusRepos: 0,
      dirtyRepos: 0,
      deployConfigured: 0,
      activeTasks: 0,
      blockedTasks: 0,
      completedTasks: 0,
      weeklyVelocity: 0,
      deployPulse: [],
      domainCounts: {},
    },
    system: {
      systemStatus: "degraded",
      overall: "unavailable",
      safeMode: true,
      hyprlandOnline: false,
      topIssue: "Atlas canonical snapshot builder failed; serving fail-soft recovery snapshot.",
      gpuNote: "",
      gpu: { temperature: 0, memoryUsed: 0, memoryTotal: 0, utilization: 0 },
      diskRootPercent: 0,
    },
    hostAudit: {
      generatedAt,
      hostname: "",
      kernel: "",
      os: "",
      overall: "unavailable",
      safeMode: true,
      hyprlandOnline: false,
      topIssue: "snapshot_builder_failed",
      issueBundlePath: "",
      watchdogReason: reason,
      gpu: { temperature: 0, memoryUsed: 0, memoryTotal: 0, utilization: 0, raw: "", note: "" },
      disk: { rootPercent: 0, root: "", boot: "" },
      hyprland: { instances: "" },
      services: [],
      modelRoles: {},
      activeModels: [],
      gemma4: localAiControl.gemma4,
      openclawSecurity: { critical: 0, warn: 0, info: 0 },
      codexOrchestrator: null,
      atlas: localAiControl.atlas,
      repos: [],
      blockers: ["snapshot_builder_failed"],
      sourcePaths: { localAiControl: "", healthGate: "", bundle: "" },
      healthGate: {},
      source,
    },
    hostPlacement: { ...sanitizeServicePlacementProjection({}), source },
    projects: [],
    tasks: [],
    recentCommits: [],
    localCodexLab: emptyLocalCodexLab(generatedAt),
    localAiControl,
    localAgentPlatform: {
      ...localAgentBase,
      status: "unavailable",
      freshnessState: "unavailable",
      verificationStatus: "unknown",
      missingFields: ["canonical_snapshot"],
      sourceArtifact: source,
      readOnly: true,
      commandGateway: "unavailable",
    },
    aiCompany: unavailableAiCompanyMissionControl("snapshot_builder_failed"),
    codexAudit: {
      ...normalizeCodexAudit(null, null, Date.now()),
      source,
      exporterSource: source,
    },
    aiTelemetry: emptyAiTelemetry(),
    commercialReadiness: {
      generatedAt,
      overallStatus: "unavailable",
      hostHealth: "unavailable",
      blockedByHostHealth: true,
      score: 0,
      targetProduct: { id: "unknown", title: "unknown", path: "", monetization_label: "technical-only", money_path: [] },
      targetProducts: [],
      monetizationLabel: "technical-only",
      moneyPath: [],
      topMoneyBlockers: ["snapshot_builder_failed"],
      topOwnerBlockers: [],
      nextMoneyAction: "Repair the canonical Atlas snapshot builder.",
      monetizationStatus: {},
      monetizationPriorityPath: "",
      firstMoneyContractPath: "",
      firstMoney: {
        status: "missing",
        primary_offer: {},
        readiness: { current_state: "missing", reasons: ["snapshot_builder_failed"] },
        fulfillment_steps: [],
        verified_blockers: ["snapshot_builder_failed"],
        owner_required_blockers: [],
        aggregate_funnel_counters: { status: "missing", counters: {} },
        active_experiment: {},
        next_exact_revenue_action: "",
      },
      firstMoneySummary,
      revenueAutopilot,
      revenueAutopilotSource: source,
      summary: { implemented: 0, scaffolded: 0, missing: 1, dirtyFocusRepos: 0, highRiskBlockers: 1 },
      nextAction: "Repair the canonical Atlas snapshot builder.",
      highRiskBlockers: ["snapshot_builder_failed"],
      checks: [],
      atlasExport: { safe_to_expose: true, section_label: "Commercial Readiness", endpoint_hint: "/api/commercial-readiness", source_path: "" },
      focusRepos: [],
      source,
      productIntelSource: source,
      productOperatingStandard: null,
      productOperatingStandardSource: source,
      commercialBilling,
      commercialLaunch,
    },
    operationPolicy: {
      status: "not_evaluated",
      decision: "not_evaluated",
      mode: "observe",
      enforcement: "record_only",
      reasons: ["snapshot_builder_failed"],
      requiredChecks: [],
      evidenceFreshness: "unavailable",
      source,
    },
    administration: {
      status: "unavailable",
      schemaVersion: "missing",
      sourceOfTruth: [],
      contract: {},
      surfaces: [],
      source,
    },
    recovery: {
      status: "fallback",
      reason,
      canonical_builder: builderPath,
    },
  };
}

function readExistingSnapshot() {
  try {
    const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function writeRecoveryState(payload) {
  try {
    fs.mkdirSync(path.dirname(recoveryStatePath), { recursive: true });
    fs.writeFileSync(recoveryStatePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error(`Atlas snapshot recovery state write failed: ${boundedMessage(error instanceof Error ? error.message : error)}`);
  }
}

const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, [builderPath], {
  cwd: rootDir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 120_000,
});

if (result.status === 0 && readExistingSnapshot()) {
  writeRecoveryState({
    status: "canonical",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    builder_exit_code: 0,
    output_path: outputPath,
  });
  process.stdout.write(result.stdout || "");
  process.exit(0);
}

const reason = boundedMessage(result.stderr || result.stdout || result.error?.message || `builder_exit_${result.status}`);
const existing = readExistingSnapshot();
if (existing) {
  writeRecoveryState({
    status: "preserved_previous",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    builder_exit_code: result.status,
    reason,
    output_path: outputPath,
  });
  console.error(`Atlas snapshot builder failed; preserving previous snapshot: ${reason}`);
  process.exit(0);
}

try {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(fallbackSnapshot(reason), null, 2)}\n`, "utf8");
  writeRecoveryState({
    status: "fallback_written",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    builder_exit_code: result.status,
    reason,
    output_path: outputPath,
  });
  console.error(`Atlas snapshot builder failed; fail-soft fallback written: ${reason}`);
  process.exit(0);
} catch (error) {
  console.error(`Atlas snapshot recovery failed: ${boundedMessage(error instanceof Error ? error.message : error)}`);
  process.exit(1);
}
