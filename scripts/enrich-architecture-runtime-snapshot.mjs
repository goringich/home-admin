import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const atlasRoot = fileURLToPath(new URL("..", import.meta.url));
const universePath = path.join(atlasRoot, "public", "architecture-universe.json");
const snapshotPath = path.join(atlasRoot, "public", "snapshot.json");

function readJson(targetPath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(targetPath, "utf8")); } catch { return fallback; }
}

function idSafe(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
}

function healthyStatus(value) {
  const raw = String(value || "unknown").toLowerCase();
  if (["ok", "healthy", "active", "available", "online", "ready", "selected"].some((token) => raw.includes(token))) return "verified_current";
  if (["failed", "risk", "critical", "offline"].some((token) => raw.includes(token))) return "conflicting";
  if (["stale", "degraded", "attention", "partial"].some((token) => raw.includes(token))) return "stale";
  return "unknown";
}

const universe = readJson(universePath, null);
const snapshot = readJson(snapshotPath, null);
if (!universe || !snapshot) {
  console.log("Architecture runtime enrichment skipped: universe or snapshot missing");
  process.exit(0);
}

const nodes = new Map((universe.nodes || []).map((node) => [node.id, node]));
const edges = new Map((universe.edges || []).map((edge) => [`${edge.from}|${edge.to}|${edge.kind}`, edge]));

function addNode(node) {
  if (!node?.id) return;
  const previous = nodes.get(node.id) || {};
  nodes.set(node.id, { lifecycle_status: "observed", live_status: "unknown", layer: 10, group: "runtime", purpose: "Observed Atlas runtime entity.", ...previous, ...node, metadata: { ...(previous.metadata || {}), ...(node.metadata || {}) } });
}

function addEdge(from, to, kind, meta = {}) {
  if (!from || !to || from === to) return;
  const edge = { from, to, kind, ...meta };
  edges.set(`${from}|${to}|${kind}`, edge);
}

const placement = snapshot.hostPlacement || {};
for (const host of placement.hosts || []) {
  const id = `host:${idSafe(host.hostId)}`;
  addNode({
    id,
    label: host.hostId,
    kind: "host",
    group: "host",
    layer: 10,
    lifecycle_status: "observed",
    live_status: healthyStatus(`${host.availability} ${host.healthFreshness} ${host.connectivity}`),
    purpose: `Compute host. Availability ${host.availability || "unknown"}; connectivity ${host.connectivity || "unknown"}.`,
    origin: "atlas_host_placement",
    metadata: {
      availability: host.availability || "unknown",
      freshness: host.healthFreshness || "unknown",
      connectivity: host.connectivity || "unknown",
      last_seen: host.lastSeen || "",
      power_class: host.powerClass || "unknown",
      cost_class: host.costClass || "unknown",
      capabilities: host.capabilities || [],
      failure: host.failure || {},
    },
  });
  addEdge("personal_os", id, "runs_on", { origin: "atlas_host_placement" });
}

for (const service of placement.services || []) {
  const id = `service:${idSafe(service.serviceId)}`;
  addNode({
    id,
    label: service.serviceId,
    kind: "service",
    group: service.public ? "public_service" : "local_service",
    layer: service.serviceClass?.includes("model") ? 7 : 10,
    lifecycle_status: service.placementStatus || "observed",
    live_status: healthyStatus(`${service.placementStatus} ${service.splitBrainRisk}`),
    purpose: `${service.serviceClass || "service"}; configured on ${service.configuredHost || "unknown"}, active on ${service.activeHost || "unknown"}.`,
    origin: "atlas_host_placement",
    metadata: {
      public: Boolean(service.public),
      stateful: Boolean(service.stateful),
      authoritative_writer: service.authoritativeWriter || "",
      configured_host: service.configuredHost || "",
      active_host: service.activeHost || "",
      preferred_hosts: service.preferredHosts || [],
      fallback_hosts: service.fallbackHosts || [],
      split_brain_risk: service.splitBrainRisk || "unknown",
      last_failover: service.lastFailover || "",
      failure: service.failure || {},
    },
  });
  if (service.activeHost) addEdge(id, `host:${idSafe(service.activeHost)}`, "active_on", { origin: "atlas_host_placement" });
  if (service.configuredHost) addEdge(id, `host:${idSafe(service.configuredHost)}`, "configured_on", { origin: "atlas_host_placement" });
  for (const host of service.preferredHosts || []) addEdge(id, `host:${idSafe(host)}`, "prefers_host", { origin: "atlas_host_placement" });
  for (const host of service.fallbackHosts || []) addEdge(id, `host:${idSafe(host)}`, "fallback_host", { origin: "atlas_host_placement" });
}

const localAi = snapshot.localAiControl || {};
if (localAi.host?.hostname) {
  const hostId = `host:${idSafe(localAi.host.hostname)}`;
  addNode({
    id: hostId,
    label: localAi.host.hostname,
    kind: "host",
    group: "host",
    layer: 10,
    lifecycle_status: "observed",
    live_status: healthyStatus(localAi.host.overall),
    purpose: localAi.host.top_issue || "Current LOCAL AI OS host.",
    origin: "atlas_local_ai_control",
    metadata: { safe_mode: localAi.host.safe_mode, overall: localAi.host.overall || "unknown" },
  });
}

for (const runtime of localAi.runtimes || []) {
  const id = `runtime:${idSafe(runtime.id || runtime.label)}`;
  addNode({
    id,
    label: runtime.label || runtime.id,
    kind: "runtime",
    group: "ai_runtime",
    layer: 7,
    lifecycle_status: "observed",
    live_status: healthyStatus(runtime.status),
    purpose: runtime.detail || "Observed local AI runtime.",
    origin: "atlas_local_ai_control",
    metadata: { endpoint: runtime.endpoint || "", status: runtime.status || "unknown" },
  });
  addEdge("model_router", id, "routes_to", { origin: "atlas_local_ai_control" });
}

for (const model of localAi.models || []) {
  const id = `model:${idSafe(model.name || model.id)}`;
  addNode({
    id,
    label: model.name || model.id,
    kind: "model",
    group: model.active ? "active_model" : "local_model",
    layer: 7,
    lifecycle_status: model.classification || "observed",
    live_status: model.active ? "verified_current" : "verified_source_only",
    purpose: `${model.family || "model"} ${model.parameter_size || ""} ${model.quantization || ""}`.trim(),
    origin: "atlas_local_ai_control",
    metadata: {
      model_id: model.id || "",
      family: model.family || "",
      parameter_size: model.parameter_size || "",
      quantization: model.quantization || "",
      size_bytes: model.size_bytes || 0,
      roles: model.roles || [],
      active: Boolean(model.active),
      classification: model.classification || "unknown",
      reason: model.reason || "",
      modified_at: model.modified_at || model.modified || "",
    },
  });
  addEdge("model_router", id, "selects_model", { origin: "atlas_local_ai_control" });
  for (const role of model.roles || []) {
    const roleId = `role:${idSafe(role)}`;
    addNode({ id: roleId, label: role, kind: "role", group: "model_role", layer: 7, lifecycle_status: "observed", live_status: "verified_source_only", purpose: "Model-routing role.", origin: "atlas_local_ai_control" });
    addEdge(roleId, id, "served_by", { origin: "atlas_local_ai_control" });
  }
}

for (const [role, modelName] of Object.entries(localAi.roleMap || {})) {
  if (!modelName) continue;
  const roleId = `role:${idSafe(role)}`;
  const modelId = `model:${idSafe(modelName)}`;
  addNode({ id: roleId, label: role, kind: "role", group: "model_role", layer: 7, lifecycle_status: "observed", live_status: "verified_current", purpose: "Current model-routing role mapping.", origin: "atlas_local_ai_control" });
  if (nodes.has(modelId)) addEdge(roleId, modelId, "currently_routed_to", { origin: "atlas_local_ai_control" });
}

for (const agent of localAi.openclaw?.agents || []) {
  const id = `agent:${idSafe(agent.id || agent.label)}`;
  addNode({
    id,
    label: agent.label || agent.id,
    kind: "agent",
    group: "agent",
    layer: 7,
    lifecycle_status: "observed",
    live_status: healthyStatus(agent.active),
    purpose: "OpenClaw/local AI agent from current sanitized Atlas state.",
    origin: "atlas_local_ai_control",
    metadata: { bootstrap: agent.bootstrap || "", sessions: agent.sessions || "", active: agent.active || "", store: agent.store || "" },
  });
  addEdge("openclaw", id, "hosts_agent", { origin: "atlas_local_ai_control" });
}

const agentRouting = snapshot.localCodexLab?.agentRouting || {};
for (const agent of agentRouting.agents || []) {
  const id = `agent-route:${idSafe(agent.id)}`;
  addNode({
    id,
    label: agent.label || agent.id,
    kind: "agent",
    group: "agent_route",
    layer: 7,
    lifecycle_status: agentRouting.status || "observed",
    live_status: agent.availability?.command ? "verified_source_only" : "unknown",
    purpose: agent.why || agent.kind || "Agent-routing candidate.",
    origin: "atlas_agent_routing",
    metadata: { kind: agent.kind || "", preferred_model: agent.preferred_model || "", command: agent.availability?.command || "" },
  });
  addEdge("local_agent", id, "routes_to_agent", { origin: "atlas_agent_routing" });
}
for (const route of agentRouting.routes || []) {
  const id = `agent-policy:${idSafe(route.id)}`;
  addNode({
    id,
    label: route.label || route.id,
    kind: "routing_policy",
    group: "agent_route",
    layer: 7,
    lifecycle_status: agentRouting.status || "observed",
    live_status: "verified_source_only",
    purpose: `Context ${route.context_budget || "unknown"}; sandbox ${route.sandbox_mode || "unknown"}; permission ${route.permission_tier || "unknown"}.`,
    origin: "atlas_agent_routing",
    metadata: { preferred_agents: route.preferred_agents || [], context_budget: route.context_budget || "", sandbox_mode: route.sandbox_mode || "", permission_tier: route.permission_tier || "" },
  });
  for (const agent of route.preferred_agents || []) addEdge(id, `agent-route:${idSafe(agent)}`, "prefers_agent", { origin: "atlas_agent_routing" });
}

for (const entry of snapshot.aiTelemetry?.skillRegistry?.entries || []) {
  const id = `skill:${idSafe(entry.id || entry.title)}`;
  addNode({
    id,
    label: entry.title || entry.id,
    kind: "skill",
    group: "skill",
    layer: 7,
    lifecycle_status: entry.installed ? "installed" : "registered",
    live_status: entry.installed ? "verified_current" : "verified_source_only",
    purpose: "Registered AI skill surfaced by Atlas telemetry.",
    origin: "atlas_ai_telemetry",
    metadata: { installed: Boolean(entry.installed), source_path: entry.source_path || "", installed_path: entry.installed_path || "" },
  });
  addEdge("local_agent", id, "uses_skill", { origin: "atlas_ai_telemetry" });
}

const known = new Set(nodes.keys());
const edgeList = [...edges.values()].filter((edge) => known.has(edge.from) && known.has(edge.to));
const degree = new Map();
for (const edge of edgeList) {
  degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
  degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
}
const nodeList = [...nodes.values()].map((node) => ({ ...node, degree: degree.get(node.id) || 0 }));
universe.nodes = nodeList;
universe.edges = edgeList;
universe.groups = nodeList.reduce((acc, node) => { acc[node.group] = (acc[node.group] || 0) + 1; return acc; }, {});
universe.kinds = nodeList.reduce((acc, node) => { acc[node.kind] = (acc[node.kind] || 0) + 1; return acc; }, {});
universe.coverage = {
  ...(universe.coverage || {}),
  host_nodes: nodeList.filter((node) => node.kind === "host").length,
  service_nodes: nodeList.filter((node) => node.kind === "service" || node.kind === "runtime").length,
  model_nodes: nodeList.filter((node) => node.kind === "model").length,
  agent_nodes: nodeList.filter((node) => node.kind === "agent").length,
  skill_nodes: nodeList.filter((node) => node.kind === "skill").length,
  total_nodes: nodeList.length,
  total_edges: edgeList.length,
  live_gap_nodes: nodeList.filter((node) => !["verified_live", "verified_current", "not_applicable"].includes(node.live_status)).length,
};
universe.runtime_snapshot_enriched_at = new Date().toISOString();
fs.writeFileSync(universePath, `${JSON.stringify(universe, null, 2)}\n`, "utf8");
console.log(`Architecture runtime snapshot: hosts=${universe.coverage.host_nodes} services=${universe.coverage.service_nodes} models=${universe.coverage.model_nodes} agents=${universe.coverage.agent_nodes} skills=${universe.coverage.skill_nodes}`);
