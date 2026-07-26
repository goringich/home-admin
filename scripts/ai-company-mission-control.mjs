const AVAILABILITY = new Set(["available", "partial", "unavailable"]);
const FRESHNESS = new Set(["fresh", "stale", "unknown", "unavailable"]);
const VERIFICATION = new Set([
  "verified",
  "partially_verified",
  "unverified",
  "rejected",
  "unknown",
]);
const DATA_CLASSES = new Set(["real", "fixture", "unknown", "unavailable"]);

const COMMON_FIELDS = [
  "status", "created_at", "updated_at", "actor", "schema_version", "revision",
  "data_class", "mission_id", "task_id", "attempt_id", "run_id", "portfolio_id",
  "workstream_id",
];

const ENTITY_FIELDS = {
  portfolios: [
    ...COMMON_FIELDS, "portfolio_id", "title", "expected_value", "actual_cost", "score",
    "priority_score", "priority_reason", "next_best_mission_id", "risk", "cost",
  ],
  missions: [
    ...COMMON_FIELDS, "mission_id", "title", "work_status", "implementation_status",
    "deployment_status", "outcome_status", "confidence", "expected_value", "actual_cost",
    "objective", "target_metric", "target_value", "deadline", "budget_limit", "risk_limit",
    "progress", "critical_path", "blockers", "owner_decisions", "outcome_contract",
  ],
  workstreams: [...COMMON_FIELDS, "workstream_id", "name", "logical_key"],
  tasks: [
    ...COMMON_FIELDS, "task_id", "title", "logical_key", "plan_version", "critical_path",
    "owner_gate", "acceptance_criteria", "required_evidence", "retry_policy", "timeout_policy",
  ],
  dependencies: [
    ...COMMON_FIELDS, "task_id", "depends_on_task_id", "dependency_type", "plan_version",
  ],
  attempts: [
    ...COMMON_FIELDS, "attempt_id", "parent_attempt_id", "attempt_number", "worker_id",
    "started_at", "finished_at", "heartbeat_at", "lease_expires_at",
  ],
  runs: [
    ...COMMON_FIELDS, "run_id", "executor", "external_run_id", "started_at", "finished_at",
  ],
  evidence: [
    ...COMMON_FIELDS, "evidence_id", "evidence_type", "source", "path_or_reference", "sha256",
    "command", "exit_code", "started_at", "finished_at", "environment", "producer",
    "verified_by", "freshness", "summary",
  ],
  verifications: [
    ...COMMON_FIELDS, "verification_id", "evidence_id", "verifier", "producer", "independent",
    "reason", "checks",
  ],
  approvals: [
    ...COMMON_FIELDS, "approval_id", "approval_type", "requested_action", "reason",
    "expected_benefit", "risk", "cost", "reversibility", "rollback", "evidence_ids",
    "alternatives", "expires_at", "requester", "decided_at", "decided_by", "decision_reason",
  ],
  economics: [
    ...COMMON_FIELDS, "cost_id", "model", "input_tokens", "cached_tokens", "output_tokens",
    "reasoning_tokens", "model_cost", "runtime_duration", "estimated_gpu_cost",
    "human_attention_events", "budget_limit", "actual_cost", "expected_value", "realized_value",
    "currency", "source_ref", "observed_at", "budget_variance",
  ],
  incidents: [
    ...COMMON_FIELDS, "incident_id", "severity", "summary", "impact", "recovery",
  ],
  decisions: [
    ...COMMON_FIELDS, "decision_id", "decision_type", "question", "decision", "rationale",
    "alternatives", "decided_by", "decided_at",
  ],
  outcomes: [
    ...COMMON_FIELDS, "outcome_id", "metric", "baseline", "target", "observed", "measured_at",
    "source_ref", "summary",
  ],
  offers: [...COMMON_FIELDS, "offer_id", "name", "value_proposition", "price_amount", "currency"],
  leads: [...COMMON_FIELDS, "lead_id", "display_name", "source", "external_ref_hash"],
  opportunities: [
    ...COMMON_FIELDS, "opportunity_id", "lead_id", "offer_id", "stage", "expected_value", "probability",
  ],
  experiments: [
    ...COMMON_FIELDS, "experiment_id", "offer_id", "hypothesis", "baseline", "target", "result",
  ],
  orders: [
    ...COMMON_FIELDS, "order_id", "opportunity_id", "offer_id", "amount", "currency", "payment_state",
  ],
  deliveries: [
    ...COMMON_FIELDS, "delivery_id", "order_id", "delivery_type", "reference", "delivered_at",
  ],
  payments: [
    ...COMMON_FIELDS, "payment_id", "order_id", "amount", "currency", "provider_ref_hash", "observed_at",
  ],
  customerFeedback: [
    ...COMMON_FIELDS, "feedback_id", "order_id", "rating", "summary", "source_ref_hash",
  ],
};


function safeValue(value, depth = 0) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (depth >= 3) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => safeValue(item, depth + 1));
  if (!value || typeof value !== "object") return null;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (/prompt|response|transcript|secret|cookie|credential/i.test(key)) continue;
    result[key] = safeValue(item, depth + 1);
  }
  return result;
}


function projectRecord(record, fields) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const projected = {};
  for (const field of new Set(fields)) {
    if (Object.hasOwn(record, field)) projected[field] = safeValue(record[field]);
  }
  return projected;
}


function sectionContainer(payload, names) {
  for (const name of names) {
    const value = payload?.[name];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}


function sectionItems(payload, names, fields) {
  const container = sectionContainer(payload, names);
  const raw = Array.isArray(container)
    ? container
    : Array.isArray(container?.items)
      ? container.items
      : Array.isArray(container?.records)
        ? container.records
        : [];
  return raw.slice(0, 20_000).map((record) => projectRecord(record, fields)).filter(Boolean);
}


function allowed(value, choices, fallback) {
  return choices.has(value) ? value : fallback;
}


function generatedFreshness(generatedAt, nowMs, maxAgeMs, fallback) {
  const generatedMs = Date.parse(String(generatedAt || ""));
  if (!Number.isFinite(generatedMs)) return fallback;
  return nowMs - generatedMs > maxAgeMs ? "stale" : "fresh";
}


function inferDataClass(records) {
  const classes = new Set(records.map((item) => item?.data_class).filter(Boolean));
  if (classes.size === 1 && classes.has("fixture")) return "fixture";
  if (classes.has("real")) return "real";
  return "unknown";
}


function normalizeState(rawState, records, generatedAt, options) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : 15 * 60 * 1000;
  const explicitFreshness = allowed(rawState?.freshness, FRESHNESS, "unknown");
  return {
    availability: allowed(
      rawState?.availability,
      AVAILABILITY,
      records.length ? "available" : "unavailable",
    ),
    freshness: generatedFreshness(generatedAt, nowMs, maxAgeMs, explicitFreshness),
    verification: allowed(rawState?.verification, VERIFICATION, "unknown"),
    dataClass: allowed(
      rawState?.data_class ?? rawState?.dataClass,
      DATA_CLASSES,
      inferDataClass(records),
    ),
  };
}


export function unavailableAiCompanyMissionControl(reason = "source_missing") {
  const emptyOperations = {
    offers: [], leads: [], opportunities: [], experiments: [], orders: [], deliveries: [],
    payments: [], customerFeedback: [],
    counters: { offers: null, leads: null, opportunities: null, experiments: null, orders: null, deliveries: null, payments: null, feedback: null },
    state: { availability: "unavailable", freshness: "unavailable", verification: "unverified", dataClass: "unavailable" },
  };
  return {
    schemaVersion: "unavailable",
    generatedAt: "",
    exportHash: "",
    safeToExpose: false,
    state: {
      availability: "unavailable",
      freshness: "unavailable",
      verification: "unverified",
      dataClass: "unavailable",
      reason,
    },
    sectionStates: {},
    portfolios: [], missions: [], workstreams: [], tasks: [], dependencies: [], attempts: [],
    runs: [], evidence: [], verifications: [], approvals: [], economics: [], incidents: [], decisions: [], outcomes: [],
    operations: emptyOperations,
  };
}


export function normalizeAiCompanyMissionControl(payload, options = {}) {
  if (!payload || typeof payload !== "object" || payload.safe_to_expose !== true) {
    return unavailableAiCompanyMissionControl(payload ? "unsafe_export" : "source_missing");
  }
  const entities = {
    portfolios: sectionItems(payload, ["portfolios"], ENTITY_FIELDS.portfolios),
    missions: sectionItems(payload, ["missions"], ENTITY_FIELDS.missions),
    workstreams: sectionItems(payload, ["workstreams"], ENTITY_FIELDS.workstreams),
    tasks: sectionItems(payload, ["tasks"], ENTITY_FIELDS.tasks),
    dependencies: sectionItems(payload, ["dependencies", "task_dependencies"], ENTITY_FIELDS.dependencies),
    attempts: sectionItems(payload, ["attempts"], ENTITY_FIELDS.attempts),
    runs: sectionItems(payload, ["runs"], ENTITY_FIELDS.runs),
    evidence: sectionItems(payload, ["evidence"], ENTITY_FIELDS.evidence),
    verifications: sectionItems(payload, ["verifications", "verification"], ENTITY_FIELDS.verifications),
    approvals: sectionItems(payload, ["approvals"], ENTITY_FIELDS.approvals),
    economics: sectionItems(payload, ["economics", "costs"], ENTITY_FIELDS.economics),
    incidents: sectionItems(payload, ["incidents"], ENTITY_FIELDS.incidents),
    decisions: sectionItems(payload, ["decisions"], ENTITY_FIELDS.decisions),
    outcomes: sectionItems(payload, ["outcomes", "outcome_measurements"], ENTITY_FIELDS.outcomes),
  };
  const operationRoot = payload.company_operations && typeof payload.company_operations === "object"
    ? payload.company_operations
    : payload;
  const operations = {
    offers: sectionItems(operationRoot, ["offers"], ENTITY_FIELDS.offers),
    leads: sectionItems(operationRoot, ["leads"], ENTITY_FIELDS.leads),
    opportunities: sectionItems(operationRoot, ["opportunities"], ENTITY_FIELDS.opportunities),
    experiments: sectionItems(operationRoot, ["experiments"], ENTITY_FIELDS.experiments),
    orders: sectionItems(operationRoot, ["orders"], ENTITY_FIELDS.orders),
    deliveries: sectionItems(operationRoot, ["deliveries"], ENTITY_FIELDS.deliveries),
    payments: sectionItems(operationRoot, ["payments", "payment_states"], ENTITY_FIELDS.payments),
    customerFeedback: sectionItems(operationRoot, ["customer_feedback", "feedback"], ENTITY_FIELDS.customerFeedback),
  };
  operations.counters = {
    offers: operations.offers.length,
    leads: operations.leads.length,
    opportunities: operations.opportunities.length,
    experiments: operations.experiments.length,
    orders: operations.orders.length,
    deliveries: operations.deliveries.length,
    payments: operations.payments.length,
    feedback: operations.customerFeedback.length,
  };
  const records = [...Object.values(entities).flat(), ...Object.values(operations).filter(Array.isArray).flat()];
  const rootState = normalizeState(payload.data_state, records, payload.generated_at, options);
  operations.state = normalizeState(
    operationRoot.data_state,
    Object.values(operations).filter(Array.isArray).flat(),
    payload.generated_at,
    options,
  );
  const sectionStates = {};
  for (const [name, items] of Object.entries(entities)) {
    const container = sectionContainer(payload, [name]);
    sectionStates[name] = normalizeState(container?.data_state, items, payload.generated_at, options);
  }
  return {
    schemaVersion: String(payload.schema_version || "unknown"),
    generatedAt: String(payload.generated_at || ""),
    exportHash: String(payload.export_hash || ""),
    safeToExpose: true,
    state: rootState,
    sectionStates,
    ...entities,
    operations,
  };
}
