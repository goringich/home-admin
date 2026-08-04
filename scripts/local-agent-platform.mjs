function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function number(value) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function normalizeTask(value) {
  if (!isRecord(value)) return {};
  return {
    task_id: text(value.task_id),
    state: text(value.state),
    status: text(value.status),
    trace_id: text(value.trace_id),
    repository_id: text(value.repository_id),
    executor: text(value.executor),
    generated_at: text(value.generated_at),
  };
}

function normalizeQueue(value) {
  const counts = isRecord(value.counts)
    ? Object.fromEntries(
      Object.entries(value.counts).flatMap(([key, entry]) => (
        Number.isFinite(entry) ? [[key, Number(entry)]] : []
      )),
    )
    : {};
  return {
    active_leases: number(value.active_leases),
    authority: text(value.authority),
    counts,
    dead_letter_depth: number(value.dead_letter_depth),
    generated_at: text(value.generated_at),
    queue_depth: number(value.queue_depth),
    stale_leases: number(value.stale_leases),
  };
}

function normalizeRoles(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([role, entry]) => (
      isRecord(entry) ? [[role, {
        evidence_class: text(entry.evidence_class),
        model: text(entry.model),
        status: text(entry.status),
      }]] : []
    )),
  );
}

export function normalizeLocalAgentPlatform(input, now = new Date()) {
  const payload = isRecord(input) ? input : {};
  const required = ["schema_version", "authority", "source", "generated_at", "observed_at", "expires_at", "freshness_state", "verification_status"];
  const missing = required.filter((key) => !payload[key]);
  const nestedChecks = {
    source: Array.isArray(payload.source) && payload.source.every((item) => typeof item === "string"),
    queue_health: isRecord(payload.queue_health),
    latest_run: isRecord(payload.latest_run),
    gateway_health: isRecord(payload.gateway_health),
    running_tasks: Array.isArray(payload.running_tasks) && payload.running_tasks.every(isRecord),
    task_lifecycle: isRecord(payload.task_lifecycle),
    sandbox_status: isRecord(payload.sandbox_status),
    verification_results: isRecord(payload.verification_results),
    benchmark_trends: Array.isArray(payload.benchmark_trends) && payload.benchmark_trends.every(isRecord),
    agent_success_rate: Number.isFinite(payload.agent_success_rate) && payload.agent_success_rate >= 0 && payload.agent_success_rate <= 1,
    stale_evidence: Array.isArray(payload.stale_evidence) && payload.stale_evidence.every(isRecord),
    blocked_promotions: Array.isArray(payload.blocked_promotions) && payload.blocked_promotions.every((item) => typeof item === "string"),
    role_champions: isRecord(payload.role_champions),
    challengers: isRecord(payload.challengers),
    analysis_pack: isRecord(payload.analysis_pack),
  };
  const invalid = Object.entries(nestedChecks).flatMap(([key, valid]) => (valid ? [] : [key]));
  const expiresAt = Date.parse(String(payload.expires_at || ""));
  const stale = Number.isFinite(expiresAt) && expiresAt <= now.getTime();
  const malformed = missing.length > 0
    || invalid.length > 0
    || !Number.isFinite(Date.parse(String(payload.generated_at || "")))
    || !Number.isFinite(expiresAt)
    || payload.schema_version !== "2026-07-16.atlas-local-agent-platform.v1";
  if (malformed) {
    return {
      status: "malformed",
      schemaVersion: String(payload.schema_version || "missing"),
      authority: String(payload.authority || "unavailable"),
      freshnessState: "unavailable",
      verificationStatus: "rejected",
      missingFields: [...new Set([...missing, ...invalid])],
      queueHealth: {},
      latestRun: {},
      gatewayHealth: {},
      runningTasks: [],
      taskLifecycle: {},
      sandboxStatus: {},
      verificationResults: {},
      benchmarkTrends: [],
      agentSuccessRate: 0,
      staleEvidence: [],
      blockedPromotions: [],
      roleChampions: {},
      challengers: {},
      analysisPack: {},
    };
  }
  return {
    status: stale ? "stale" : "available",
    schemaVersion: payload.schema_version,
    authority: payload.authority,
    source: payload.source.map(text),
    generatedAt: text(payload.generated_at),
    observedAt: text(payload.observed_at),
    expiresAt: text(payload.expires_at),
    freshnessState: stale ? "stale" : String(payload.freshness_state),
    verificationStatus: String(payload.verification_status),
    missingFields: [],
    queueHealth: normalizeQueue(payload.queue_health),
    latestRun: normalizeTask(payload.latest_run),
    gatewayHealth: {
      backend: text(payload.gateway_health.backend),
      checked_at: text(payload.gateway_health.checked_at),
      gateway: text(payload.gateway_health.gateway),
      loopback_only: payload.gateway_health.loopback_only === true,
    },
    runningTasks: payload.running_tasks.map(normalizeTask),
    taskLifecycle: normalizeTask(payload.task_lifecycle),
    sandboxStatus: {
      main_worktree_modified: payload.sandbox_status.main_worktree_modified === true,
      sandbox: text(payload.sandbox_status.sandbox),
      status: text(payload.sandbox_status.status),
    },
    verificationResults: {
      passed: typeof payload.verification_results.passed === "boolean" ? payload.verification_results.passed : undefined,
      status: text(payload.verification_results.status),
    },
    benchmarkTrends: payload.benchmark_trends.map((entry) => ({
      pass_rate: number(entry.pass_rate),
      passed: number(entry.passed),
      samples: number(entry.samples),
    })),
    agentSuccessRate: Number(payload.agent_success_rate),
    staleEvidence: payload.stale_evidence.map((entry) => ({
      count: number(entry.count),
      id: text(entry.id),
      state: text(entry.state),
    })),
    blockedPromotions: payload.blocked_promotions.map(text),
    roleChampions: normalizeRoles(payload.role_champions),
    challengers: normalizeRoles(payload.challengers),
    analysisPack: {
      freshness_state: text(payload.analysis_pack.freshness_state),
      generated_at: text(payload.analysis_pack.generated_at),
      path: text(payload.analysis_pack.path),
    },
  };
}
