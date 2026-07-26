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
    "verified_by", "freshness", "summary", "reference_basename", "reference_sha256",
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
  agentAssignments: [
    ...COMMON_FIELDS, "assignment_id", "agent_id", "role", "status",
  ],
  timeline: [
    ...COMMON_FIELDS, "event_id", "entity_id", "entity_type", "event_type", "event_hash",
    "occurred_at", "sequence",
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

const ENTITY_ID_FIELDS = {
  portfolios: "portfolio_id",
  missions: "mission_id",
  workstreams: "workstream_id",
  tasks: "task_id",
  attempts: "attempt_id",
  runs: "run_id",
  evidence: "evidence_id",
  verifications: "verification_id",
  approvals: "approval_id",
  economics: "cost_id",
  incidents: "incident_id",
  decisions: "decision_id",
  outcomes: "outcome_id",
  agentAssignments: "assignment_id",
  timeline: "event_id",
  offers: "offer_id",
  leads: "lead_id",
  opportunities: "opportunity_id",
  experiments: "experiment_id",
  orders: "order_id",
  deliveries: "delivery_id",
  payments: "payment_id",
  customerFeedback: "feedback_id",
};

const DETAIL_SECTIONS = {
  workstreams: "workstreams",
  tasks: "tasks",
  dependencies: "dependencies",
  attempts: "attempts",
  runs: "runs",
  evidence: "evidence",
  verifications: "verification_decisions",
  approvals: "approvals",
  economics: "costs",
  incidents: "incidents",
  decisions: "decisions",
  outcomes: "outcome_measurements",
  agentAssignments: "agent_assignments",
  timeline: "timeline",
};

const OPERATION_TYPES = {
  offers: "offers",
  leads: "leads",
  opportunities: "opportunities",
  experiments: "experiments",
  orders: "orders",
  deliveries: "deliveries",
  payments: "payments",
  customerFeedback: "customer_feedback",
};

const SECTION_STATE_SOURCES = {
  portfolios: ["portfolios", "portfolio"],
  missions: ["missions"],
  workstreams: ["workstreams", "mission_details"],
  tasks: ["tasks", "mission_details"],
  dependencies: ["dependencies", "task_dependencies", "mission_details"],
  attempts: ["attempts", "mission_details"],
  runs: ["runs", "mission_details"],
  evidence: ["evidence", "mission_details"],
  verifications: ["verifications", "verification", "mission_details"],
  approvals: ["approvals", "mission_details"],
  economics: ["economics", "costs", "mission_details"],
  incidents: ["incidents", "mission_details"],
  decisions: ["decisions", "mission_details"],
  outcomes: ["outcomes", "outcome_measurements", "mission_details"],
  agentAssignments: ["agent_assignments", "mission_details"],
  timeline: ["timeline", "mission_details"],
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


function projectEntity(record, entityName, missionId = null) {
  const projected = projectRecord(record, ENTITY_FIELDS[entityName]);
  if (!projected) return null;
  const idField = ENTITY_ID_FIELDS[entityName];
  if (idField && !projected[idField] && typeof record.id === "string") {
    projected[idField] = record.id;
  }
  if (!projected.mission_id && typeof missionId === "string") {
    projected.mission_id = missionId;
  }
  if (entityName === "evidence" && !projected.evidence_type && typeof record.type === "string") {
    projected.evidence_type = record.type;
  }
  if (entityName === "decisions" && !projected.decision_type && typeof record.type === "string") {
    projected.decision_type = record.type;
  }
  if (entityName === "missions" && record.outcome_target && typeof record.outcome_target === "object") {
    if (!Object.hasOwn(projected, "target_metric")) projected.target_metric = safeValue(record.outcome_target.metric);
    if (!Object.hasOwn(projected, "target_value")) projected.target_value = safeValue(record.outcome_target.value);
    if (!Object.hasOwn(projected, "deadline")) projected.deadline = safeValue(record.outcome_target.deadline);
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


function rawSectionItems(payload, names) {
  const container = sectionContainer(payload, names);
  if (Array.isArray(container)) return container.slice(0, 20_000);
  if (Array.isArray(container?.items)) return container.items.slice(0, 20_000);
  if (Array.isArray(container?.records)) return container.records.slice(0, 20_000);
  return [];
}


function sectionItems(payload, names, entityName) {
  return rawSectionItems(payload, names).map((record) => projectEntity(record, entityName)).filter(Boolean);
}


function nestedDetailItems(payload, entityName) {
  const detailKey = DETAIL_SECTIONS[entityName];
  if (!detailKey) return [];
  const result = [];
  for (const detail of rawSectionItems(payload, ["mission_details"])) {
    const section = detail?.[detailKey];
    const records = Array.isArray(section)
      ? section
      : Array.isArray(section?.items)
        ? section.items
        : [];
    for (const record of records.slice(0, 20_000 - result.length)) {
      const projected = projectEntity(record, entityName, detail.mission_id);
      if (projected) result.push(projected);
    }
    if (result.length >= 20_000) break;
  }
  return result;
}


function mergeEntityItems(entityName, ...groups) {
  const idField = ENTITY_ID_FIELDS[entityName];
  const result = [];
  const seen = new Set();
  for (const item of groups.flat()) {
    const identity = idField && item?.[idField]
      ? `${idField}:${item[idField]}`
      : JSON.stringify(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return result.slice(0, 20_000);
}


function missionItems(payload) {
  const details = new Map(
    rawSectionItems(payload, ["mission_details"])
      .filter((detail) => typeof detail?.mission_id === "string")
      .map((detail) => [detail.mission_id, detail]),
  );
  return rawSectionItems(payload, ["missions"]).map((record) => {
    const detail = details.get(record.mission_id ?? record.id);
    const contract = detail?.outcome_contract;
    const enriched = contract && typeof contract === "object"
      ? { ...contract, ...record, outcome_contract: contract }
      : record;
    return projectEntity(enriched, "missions");
  }).filter(Boolean);
}


function operationItems(operationRoot, entityName, legacyNames) {
  const legacy = sectionItems(operationRoot, legacyNames, entityName);
  const recordType = OPERATION_TYPES[entityName];
  const canonical = (Array.isArray(operationRoot?.items) ? operationRoot.items : [])
    .filter((record) => record?.record_type === recordType)
    .map((record) => projectEntity(record, entityName))
    .filter(Boolean);
  return mergeEntityItems(entityName, legacy, canonical);
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
  if (classes.size === 1) {
    const [value] = classes;
    return DATA_CLASSES.has(value) ? value : "unknown";
  }
  return "unknown";
}


function normalizeState(rawState, records, generatedAt, options) {
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : 15 * 60 * 1000;
  const explicitFreshness = allowed(rawState?.freshness, FRESHNESS, "unknown");
  const explicitDataClass = rawState?.data_class ?? rawState?.dataClass;
  const availability = allowed(
    rawState?.availability,
    AVAILABILITY,
    records.length ? "available" : "unavailable",
  );
  return {
    availability,
    freshness: availability === "unavailable" || explicitFreshness === "unavailable"
      ? "unavailable"
      : generatedFreshness(generatedAt, nowMs, maxAgeMs, explicitFreshness),
    verification: allowed(rawState?.verification, VERIFICATION, "unknown"),
    dataClass: allowed(
      explicitDataClass === "mixed" ? "unknown" : explicitDataClass,
      DATA_CLASSES,
      inferDataClass(records),
    ),
  };
}


function approvalDecisionTrust(approval, mission, approvalState, safeToExpose) {
  if (!safeToExpose) return { trusted: false, reason: "unsafe_export" };
  if (approval?.data_class !== "real") return { trusted: false, reason: "approval_not_real" };
  if (mission?.data_class !== "real") return { trusted: false, reason: "mission_not_real" };
  if (approvalState.availability !== "available") return { trusted: false, reason: "approval_data_unavailable" };
  if (approvalState.freshness !== "fresh") return { trusted: false, reason: "approval_data_not_fresh" };
  const verificationTrusted = ["verified", "partially_verified"].includes(approvalState.verification)
    || ["verified", "partially_verified"].includes(mission.implementation_status);
  if (!verificationTrusted) return { trusted: false, reason: "verification_not_trusted" };
  return { trusted: true, reason: "trusted_real_approval" };
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
    agentAssignments: [], timeline: [],
    operations: emptyOperations,
  };
}


export function normalizeAiCompanyMissionControl(payload, options = {}) {
  if (!payload || typeof payload !== "object" || payload.safe_to_expose !== true) {
    return unavailableAiCompanyMissionControl(payload ? "unsafe_export" : "source_missing");
  }
  const entities = {
    portfolios: sectionItems(payload, ["portfolios", "portfolio"], "portfolios"),
    missions: missionItems(payload),
    workstreams: mergeEntityItems("workstreams", sectionItems(payload, ["workstreams"], "workstreams"), nestedDetailItems(payload, "workstreams")),
    tasks: mergeEntityItems("tasks", sectionItems(payload, ["tasks"], "tasks"), nestedDetailItems(payload, "tasks")),
    dependencies: mergeEntityItems("dependencies", sectionItems(payload, ["dependencies", "task_dependencies"], "dependencies"), nestedDetailItems(payload, "dependencies")),
    attempts: mergeEntityItems("attempts", sectionItems(payload, ["attempts"], "attempts"), nestedDetailItems(payload, "attempts")),
    runs: mergeEntityItems("runs", sectionItems(payload, ["runs"], "runs"), nestedDetailItems(payload, "runs")),
    evidence: mergeEntityItems("evidence", sectionItems(payload, ["evidence"], "evidence"), nestedDetailItems(payload, "evidence")),
    verifications: mergeEntityItems("verifications", sectionItems(payload, ["verifications", "verification"], "verifications"), nestedDetailItems(payload, "verifications")),
    approvals: mergeEntityItems("approvals", sectionItems(payload, ["approvals"], "approvals"), nestedDetailItems(payload, "approvals")),
    economics: mergeEntityItems("economics", sectionItems(payload, ["economics", "costs"], "economics"), nestedDetailItems(payload, "economics")),
    incidents: mergeEntityItems("incidents", sectionItems(payload, ["incidents"], "incidents"), nestedDetailItems(payload, "incidents")),
    decisions: mergeEntityItems("decisions", sectionItems(payload, ["decisions"], "decisions"), nestedDetailItems(payload, "decisions")),
    outcomes: mergeEntityItems("outcomes", sectionItems(payload, ["outcomes", "outcome_measurements"], "outcomes"), nestedDetailItems(payload, "outcomes")),
    agentAssignments: mergeEntityItems("agentAssignments", sectionItems(payload, ["agent_assignments"], "agentAssignments"), nestedDetailItems(payload, "agentAssignments")),
    timeline: mergeEntityItems("timeline", sectionItems(payload, ["timeline"], "timeline"), nestedDetailItems(payload, "timeline")),
  };
  const operationRoot = payload.company_operations && typeof payload.company_operations === "object"
    ? payload.company_operations
    : payload;
  const operations = {
    offers: operationItems(operationRoot, "offers", ["offers"]),
    leads: operationItems(operationRoot, "leads", ["leads"]),
    opportunities: operationItems(operationRoot, "opportunities", ["opportunities"]),
    experiments: operationItems(operationRoot, "experiments", ["experiments"]),
    orders: operationItems(operationRoot, "orders", ["orders"]),
    deliveries: operationItems(operationRoot, "deliveries", ["deliveries"]),
    payments: operationItems(operationRoot, "payments", ["payments", "payment_states"]),
    customerFeedback: operationItems(operationRoot, "customerFeedback", ["customer_feedback", "feedback"]),
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
    const container = sectionContainer(payload, SECTION_STATE_SOURCES[name] ?? [name]);
    sectionStates[name] = normalizeState(container?.data_state, items, payload.generated_at, options);
  }
  const missionsById = new Map(entities.missions.map((mission) => [mission.mission_id, mission]));
  entities.approvals = entities.approvals.map((approval) => {
    const trust = approvalDecisionTrust(
      approval,
      missionsById.get(approval.mission_id),
      sectionStates.approvals,
      true,
    );
    return {
      ...approval,
      decision_trusted: trust.trusted,
      decision_trust_reason: trust.reason,
    };
  });
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
