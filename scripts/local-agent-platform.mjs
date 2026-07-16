export function normalizeLocalAgentPlatform(input, now = new Date()) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const required = ["schema_version", "authority", "source", "generated_at", "observed_at", "expires_at", "freshness_state", "verification_status"];
  const missing = required.filter((key) => !payload[key]);
  const expiresAt = Date.parse(String(payload.expires_at || ""));
  const stale = Number.isFinite(expiresAt) && expiresAt <= now.getTime();
  const malformed = missing.length > 0 || payload.schema_version !== "2026-07-16.atlas-local-agent-platform.v1" || !Array.isArray(payload.source);
  if (malformed) {
    return {
      status: "malformed",
      schemaVersion: String(payload.schema_version || "missing"),
      authority: String(payload.authority || "unavailable"),
      freshnessState: "unavailable",
      verificationStatus: "rejected",
      missingFields: missing,
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
    source: payload.source,
    generatedAt: payload.generated_at,
    observedAt: payload.observed_at,
    expiresAt: payload.expires_at,
    freshnessState: stale ? "stale" : String(payload.freshness_state),
    verificationStatus: String(payload.verification_status),
    missingFields: [],
    queueHealth: payload.queue_health || {},
    latestRun: payload.latest_run || {},
    gatewayHealth: payload.gateway_health || {},
    runningTasks: Array.isArray(payload.running_tasks) ? payload.running_tasks : [],
    taskLifecycle: payload.task_lifecycle || {},
    sandboxStatus: payload.sandbox_status || {},
    verificationResults: payload.verification_results || {},
    benchmarkTrends: Array.isArray(payload.benchmark_trends) ? payload.benchmark_trends : [],
    agentSuccessRate: Number(payload.agent_success_rate || 0),
    staleEvidence: Array.isArray(payload.stale_evidence) ? payload.stale_evidence : [],
    blockedPromotions: Array.isArray(payload.blocked_promotions) ? payload.blocked_promotions : [],
    roleChampions: payload.role_champions || {},
    challengers: payload.challengers || {},
    analysisPack: payload.analysis_pack || {},
  };
}
