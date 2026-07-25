const QUALITY_FIELDS = Object.freeze([
  { path: ["generated_at"], weight: 1 },
  { path: ["host_health"], weight: 2 },
  { path: ["fast_model"], weight: 1 },
  { path: ["balanced_model"], weight: 1 },
  { path: ["heavy_model"], weight: 1 },
  { path: ["planning_model"], weight: 1 },
  { path: ["embedding_model"], weight: 1 },
  { path: ["model_evolution"], weight: 4 },
  { path: ["agent_routing"], weight: 8 },
  { path: ["latest_hermes"], weight: 4 },
  { path: ["ai_lab"], weight: 10 },
  { path: ["eval_status"], weight: 2 },
  { path: ["knowledge_graph_status"], weight: 2 },
  { path: ["context_pack_status"], weight: 2 },
  { path: ["rag_e2e_eval_status"], weight: 2 },
  { path: ["local_model_rag_entrypoint_status"], weight: 2 },
  { path: ["codex_context_entrypoint_status"], weight: 2 },
  { path: ["local_gpu_live_bench_status"], weight: 4 },
  { path: ["active_runs"], weight: 3 },
  { path: ["latest_run_reports"], weight: 3 },
  { path: ["goal_capsules"], weight: 2 },
]);

export const LOCAL_CODEX_LAB_SCHEMA = "2026-07-25.local-codex-lab.v1";
const MAX_SOURCE_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_QUALITY_DRIFT_MS = 6 * 60 * 60 * 1000;
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const REQUIRED_CORE_FIELDS = Object.freeze([
  "generated_at",
  "host_health",
  "fast_model",
  "balanced_model",
  "ai_lab",
  "agent_routing",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapPayload(value) {
  if (!isObject(value)) return {};
  if (isObject(value.payload) && !value.generated_at && !value.ai_lab && !value.agent_routing) {
    return value.payload;
  }
  return value;
}

function meaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function valueAt(payload, fieldPath) {
  return fieldPath.reduce((value, key) => (isObject(value) ? value[key] : undefined), payload);
}

export function localCodexLabQuality(payload) {
  const safePayload = unwrapPayload(payload);
  return QUALITY_FIELDS.reduce(
    (score, field) => score + (meaningful(valueAt(safePayload, field.path)) ? field.weight : 0),
    0,
  );
}

function generatedAtMs(payload) {
  const timestamp = Date.parse(String(payload.generated_at || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function localCodexLabCompatible(payload) {
  const safePayload = unwrapPayload(payload);
  return safePayload.schema_version === LOCAL_CODEX_LAB_SCHEMA
    && safePayload.safe_to_expose === true
    && generatedAtMs(safePayload) > 0
    && REQUIRED_CORE_FIELDS.every((field) => meaningful(safePayload[field]));
}

export function selectLocalCodexLabRecord(records, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const candidates = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record.path === "string" && isObject(record.payload))
    .map((record, index) => {
      const payload = unwrapPayload(record.payload);
      return {
        path: record.path,
        payload,
        qualityScore: localCodexLabQuality(payload),
        generatedAtMs: generatedAtMs(payload),
        priority: index,
      };
    })
    .filter((record) => localCodexLabCompatible(record.payload))
    .filter((record) => Number.isFinite(nowMs)
      && record.generatedAtMs <= nowMs + FUTURE_CLOCK_TOLERANCE_MS
      && nowMs - record.generatedAtMs <= MAX_SOURCE_AGE_MS);

  const freshestGeneratedAtMs = Math.max(0, ...candidates.map((record) => record.generatedAtMs));
  const eligible = candidates.filter(
    (record) => freshestGeneratedAtMs - record.generatedAtMs <= MAX_QUALITY_DRIFT_MS,
  );

  eligible.sort((left, right) =>
    right.qualityScore - left.qualityScore ||
    right.generatedAtMs - left.generatedAtMs ||
    left.priority - right.priority,
  );

  return eligible[0] || { path: "", payload: {}, qualityScore: 0, generatedAtMs: 0, priority: 0 };
}
