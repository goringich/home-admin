import { safeProjectionText } from "./codex-orchestrator-projection.mjs";

export const SERVICE_PLACEMENT_SCHEMA = "2026-07-15.ai-os-placement.v1";

function placementList(value, limit = 8) {
  return Array.isArray(value)
    ? value.map((item) => safeProjectionText(item, 120)).filter(Boolean).slice(0, limit)
    : [];
}

function safeFailure(value) {
  const failure = value && typeof value === "object" ? value : {};
  return {
    id: safeProjectionText(failure.id, 120),
    severity: safeProjectionText(failure.severity, 40),
    detail: safeProjectionText(failure.detail, 240),
  };
}

export function sanitizeServicePlacementProjection(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const schemaVersion = safeProjectionText(source.schema_version, 80);
  const safety = source.safety && typeof source.safety === "object" ? source.safety : {};
  const trusted = schemaVersion === SERVICE_PLACEMENT_SCHEMA
    && safety.atlas_read_only_projection === true
    && safety.secrets_exported === false
    && safety.raw_prompts_exported === false;
  const missing = Object.keys(source).length === 0;

  if (!trusted) {
    return {
      schemaVersion,
      generatedAt: "",
      status: missing ? "missing" : "invalid",
      trusted: false,
      controller: {
        authoritativeHost: "",
        automaticStatefulFailover: false,
        sshIsNotServiceHealth: true,
      },
      hosts: [],
      services: [],
      activePublicProductionHosts: [],
      lastStatelessFailoverTest: { status: "missing", generatedAt: "", runId: "", artifactPath: "" },
      nextExactAction: missing
        ? "Refresh the sanitized placement export."
        : "Placement export failed schema or safety validation; refresh it before using it in Atlas.",
    };
  }

  const hosts = Array.isArray(source.hosts) ? source.hosts.map((host) => ({
    hostId: safeProjectionText(host?.host_id, 80),
    availability: safeProjectionText(host?.availability || "unknown", 40),
    healthFreshness: safeProjectionText(host?.health_freshness || "unknown", 40),
    connectivity: safeProjectionText(host?.connectivity || "unknown", 40),
    lastSeen: safeProjectionText(host?.last_seen, 80),
    powerClass: safeProjectionText(host?.power_class, 40),
    costClass: safeProjectionText(host?.cost_class, 40),
    capabilities: placementList(host?.capabilities),
    failure: safeFailure(host?.failure),
  })) : [];
  const services = Array.isArray(source.services) ? source.services.map((service) => ({
    serviceId: safeProjectionText(service?.service_id, 120),
    serviceClass: safeProjectionText(service?.service_class, 80),
    public: Boolean(service?.public),
    stateful: Boolean(service?.stateful),
    authoritativeWriter: safeProjectionText(service?.authoritative_writer, 80),
    configuredHost: safeProjectionText(service?.configured_host, 80),
    activeHost: safeProjectionText(service?.active_host, 80),
    preferredHosts: placementList(service?.preferred_hosts),
    fallbackHosts: placementList(service?.fallback_hosts),
    placementStatus: safeProjectionText(service?.placement_status || "unknown", 100),
    lastFailover: safeProjectionText(service?.last_failover, 80),
    splitBrainRisk: safeProjectionText(service?.split_brain_risk || "unknown", 40),
    failure: safeFailure(service?.failure),
  })) : [];

  return {
    schemaVersion,
    generatedAt: safeProjectionText(source.generated_at, 80),
    status: safeProjectionText(source.status || "unknown", 40),
    trusted: true,
    controller: {
      authoritativeHost: safeProjectionText(source.controller?.authoritative_host, 80),
      automaticStatefulFailover: Boolean(source.controller?.automatic_stateful_failover),
      sshIsNotServiceHealth: Boolean(source.controller?.ssh_is_not_service_health),
    },
    hosts,
    services,
    activePublicProductionHosts: placementList(source.active_public_production_hosts),
    lastStatelessFailoverTest: {
      status: safeProjectionText(source.last_stateless_failover_test?.status || "missing", 40),
      generatedAt: safeProjectionText(source.last_stateless_failover_test?.generated_at, 80),
      runId: safeProjectionText(source.last_stateless_failover_test?.run_id, 160),
      artifactPath: safeProjectionText(source.last_stateless_failover_test?.artifact_path, 200),
    },
    nextExactAction: safeProjectionText(source.next_exact_action, 300),
  };
}
