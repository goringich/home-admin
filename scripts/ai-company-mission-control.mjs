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
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const COMMON_FIELDS = [
  "status", "created_at", "updated_at", "actor", "schema_version", "revision",
  "data_class", "mission_id", "task_id", "attempt_id", "run_id", "portfolio_id",
  "workstream_id",
];

const ENTITY_FIELDS = {
  portfolios: [
    ...COMMON_FIELDS, "portfolio_id", "title", "expected_value", "actual_cost", "score",
    "priority_score", "priority_reason", "priority_explanation", "score_contributions",
    "score_status", "next_best", "next_best_mission_id", "risk", "cost",
  ],
  missions: [
    ...COMMON_FIELDS, "mission_id", "title", "work_status", "implementation_status",
    "deployment_status", "outcome_status", "confidence", "expected_value", "actual_cost",
    "objective", "target_metric", "target_value", "deadline", "budget_limit", "risk_limit",
    "progress", "critical_path", "blockers", "owner_decisions", "outcome_contract",
    "acceptance_criteria", "contract_completion_blockers", "score", "rank", "next_best",
    "priority_explanation", "score_contributions", "score_normalized_inputs", "score_status",
    "score_unknown_terms", "score_policy_schema_version", "economics",
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
    "provenance",
  ],
  economics: [
    ...COMMON_FIELDS, "cost_id", "model", "input_tokens", "cached_tokens", "output_tokens",
    "reasoning_tokens", "model_cost", "runtime_duration", "estimated_gpu_cost",
    "human_attention_events", "budget_limit", "actual_cost", "expected_value", "realized_value",
    "currency", "source_ref", "observed_at", "budget_variance", "data_state", "budget",
    "derived", "scope", "totals",
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
  if (depth >= 6) return null;
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
  const ageMs = nowMs - generatedMs;
  if (ageMs < -MAX_FUTURE_SKEW_MS) return "unavailable";
  return ageMs > maxAgeMs ? "stale" : "fresh";
}


function projectionFreshness(timing, nowMs, maxAgeMs, fallback) {
  const expiresMs = Date.parse(String(timing?.expiresAt || ""));
  if (Number.isFinite(expiresMs) && nowMs >= expiresMs) return "stale";

  const observedMs = Date.parse(String(timing?.observedAt || ""));
  if (Number.isFinite(observedMs)) {
    const observedAgeMs = nowMs - observedMs;
    if (observedAgeMs < -MAX_FUTURE_SKEW_MS) return "unavailable";
    if (observedAgeMs > maxAgeMs) return "stale";
  }

  return generatedFreshness(timing?.generatedAt, nowMs, maxAgeMs, fallback);
}


function projectionTiming(primary, fallback = {}) {
  return {
    generatedAt: primary?.generated_at ?? fallback?.generated_at,
    observedAt: primary?.observed_at ?? fallback?.observed_at,
    expiresAt: primary?.expires_at ?? fallback?.expires_at,
  };
}


function inferDataClass(records) {
  const classes = new Set(records.map((item) => item?.data_class).filter(Boolean));
  if (classes.size === 1) {
    const [value] = classes;
    return DATA_CLASSES.has(value) ? value : "unknown";
  }
  return "unknown";
}


function normalizeState(rawState, records, timing, options) {
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
      : explicitFreshness === "stale"
        ? "stale"
        : projectionFreshness(timing, nowMs, maxAgeMs, explicitFreshness),
    verification: allowed(rawState?.verification, VERIFICATION, "unknown"),
    dataClass: allowed(
      explicitDataClass === "mixed" ? "unknown" : explicitDataClass,
      DATA_CLASSES,
      inferDataClass(records),
    ),
  };
}


function hasArrayRecords(container) {
  return Array.isArray(container)
    || Array.isArray(container?.items)
    || Array.isArray(container?.records);
}


function operationSourceKnown(operationRoot, legacyNames) {
  if (Array.isArray(operationRoot?.items)) return true;
  return legacyNames.some((name) => hasArrayRecords(operationRoot?.[name]));
}


function operationCounterSet(operations, operationRoot, operationState) {
  const trustedSource = operationState.availability === "available"
    && operationState.freshness === "fresh"
    && operationState.verification === "verified"
    && operationState.dataClass === "real";
  const entries = [
    ["offers", "offers", ["offers"]],
    ["leads", "leads", ["leads"]],
    ["opportunities", "opportunities", ["opportunities"]],
    ["experiments", "experiments", ["experiments"]],
    ["orders", "orders", ["orders"]],
    ["deliveries", "deliveries", ["deliveries"]],
    ["payments", "payments", ["payments", "payment_states"]],
    ["feedback", "customerFeedback", ["customer_feedback", "feedback"]],
  ];
  const counters = {};
  const recordCounters = {};
  const nonRealCounters = {};

  for (const [counterName, entityName, legacyNames] of entries) {
    const sourceKnown = operationSourceKnown(operationRoot, legacyNames);
    const records = operations[entityName];
    recordCounters[counterName] = sourceKnown ? records.length : null;
    nonRealCounters[counterName] = sourceKnown
      ? records.filter((record) => record?.data_class !== "real").length
      : null;
    counters[counterName] = trustedSource && sourceKnown
      ? records.filter((record) => record?.data_class === "real").length
      : null;
  }

  return { counters, recordCounters, nonRealCounters };
}


const TRUSTED_LEDGER_AUTHORITY = "ai-company-mission-ledger";
const TRUSTED_APPROVAL_SOURCE = "runtime:ai-company-mission-ledger";
const APPROVAL_ID = /^approval_[A-Za-z0-9]{8,120}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const REQUIRED_APPROVAL_TEXT_FIELDS = [
  "approval_type", "requested_action", "reason", "expected_benefit", "risk",
  "reversibility", "rollback", "expires_at", "requester", "actor", "schema_version",
];


function boundedText(value, maximum = 4_000) {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximum
    && !value.includes("\0");
}


function boundedTextList(value) {
  return Array.isArray(value)
    && value.length <= 100
    && value.every((item) => boundedText(item));
}


function approvalFieldsAreTyped(approval) {
  if (!APPROVAL_ID.test(String(approval?.approval_id || ""))) return false;
  if (!SAFE_IDENTIFIER.test(String(approval?.mission_id || ""))) return false;
  if (!REQUIRED_APPROVAL_TEXT_FIELDS.every((field) => boundedText(approval?.[field]))) return false;
  if (!SAFE_IDENTIFIER.test(approval.approval_type) || !boundedText(approval.actor, 120)) return false;
  if (!(approval.cost === null || (typeof approval.cost === "number" && Number.isFinite(approval.cost) && approval.cost >= 0))) return false;
  if (!boundedTextList(approval.evidence_ids) || !boundedTextList(approval.alternatives)) return false;
  if (!approval.evidence_ids.every((evidenceId) => SAFE_IDENTIFIER.test(evidenceId))) return false;
  return true;
}


function approvalDecisionTrust(approval, approvalState, source, safeToExpose, nowMs) {
  if (!safeToExpose) return { trusted: false, reason: "unsafe_export" };
  if (approval?.data_class !== "real") return { trusted: false, reason: "approval_not_real" };
  if (approvalState.availability !== "available") return { trusted: false, reason: "approval_data_unavailable" };
  if (approvalState.freshness !== "fresh") return { trusted: false, reason: "approval_data_not_fresh" };
  if (source.authority !== TRUSTED_LEDGER_AUTHORITY || source.sourceRef !== TRUSTED_APPROVAL_SOURCE) {
    return { trusted: false, reason: "approval_source_untrusted" };
  }
  if (approval.status !== "pending") return { trusted: false, reason: "approval_not_pending" };
  if (
    !approval.provenance
    || approval.provenance.confidence !== "native"
    || !SAFE_IDENTIFIER.test(String(approval.provenance.kind || ""))
  ) return { trusted: false, reason: "approval_provenance_untrusted" };
  if (!Number.isInteger(approval.revision) || approval.revision < 1 || approval.revision > 1_000_000) {
    return { trusted: false, reason: "approval_revision_invalid" };
  }
  if (!approvalFieldsAreTyped(approval)) return { trusted: false, reason: "approval_fields_invalid" };
  const expiresMs = Date.parse(approval.expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return { trusted: false, reason: "approval_expired" };
  return { trusted: true, reason: "trusted_real_approval" };
}


const PRODUCTIVITY_METRICS = [
  "model_cost",
  "runtime_duration",
  "input_tokens",
  "cached_tokens",
  "output_tokens",
  "reasoning_tokens",
];


function aggregateMetric(rows, field) {
  const values = rows.map((row) => row?.[field]).filter((value) => typeof value === "number" && Number.isFinite(value));
  const knownValue = values.length ? values.reduce((total, value) => total + value, 0) : null;
  const unknownCount = rows.length - values.length;
  return {
    complete: rows.length > 0 && unknownCount === 0,
    known_count: values.length,
    unknown_count: unknownCount,
    known_value: knownValue,
    value: rows.length > 0 && unknownCount === 0 ? knownValue : null,
  };
}


function derivedCostPerVerifiedTask(modelCost, verifiedTaskCount, verificationStatus) {
  if (verificationStatus === "unknown" || verifiedTaskCount === null) {
    return { value: null, numerator: modelCost.value, denominator: null, status: "verification_unknown" };
  }
  if (verificationStatus === "partial") {
    return { value: null, numerator: modelCost.value, denominator: verifiedTaskCount, status: "partial_linkage" };
  }
  if (verifiedTaskCount < 1) {
    return { value: null, numerator: modelCost.value, denominator: verifiedTaskCount, status: "missing_denominator" };
  }
  if (typeof modelCost.value !== "number") {
    return { value: null, numerator: null, denominator: verifiedTaskCount, status: "missing_numerator" };
  }
  return {
    value: modelCost.value / verifiedTaskCount,
    numerator: modelCost.value,
    denominator: verifiedTaskCount,
    status: "known",
  };
}


function buildModelProductivity(costRows, verifications, verificationState) {
  const groups = new Map();
  for (const row of costRows) {
    if (typeof row?.model !== "string" || !row.model.trim()) continue;
    const model = row.model.trim();
    if (!groups.has(model)) groups.set(model, []);
    groups.get(model).push(row);
  }
  const independentlyVerifiedTasks = new Set(
    verifications
      .filter((decision) => decision?.independent === true && decision?.status === "verified" && typeof decision.task_id === "string")
      .map((decision) => decision.task_id),
  );
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([model, rows]) => {
    const linkedTaskIds = new Set(rows.map((row) => row.task_id).filter((taskId) => typeof taskId === "string" && taskId));
    const unlinkedRecordCount = rows.filter((row) => typeof row.task_id !== "string" || !row.task_id).length;
    const verificationAvailable = verificationState?.availability === "available";
    const verifiedTaskCount = verificationAvailable && linkedTaskIds.size
      ? [...linkedTaskIds].filter((taskId) => independentlyVerifiedTasks.has(taskId)).length
      : null;
    const verificationStatus = !verificationAvailable || !linkedTaskIds.size
      ? "unknown"
      : unlinkedRecordCount > 0
        ? "partial"
        : "known";
    const metrics = Object.fromEntries(PRODUCTIVITY_METRICS.map((field) => [field, aggregateMetric(rows, field)]));
    return {
      model,
      record_count: rows.length,
      linked_task_count: linkedTaskIds.size,
      unlinked_record_count: unlinkedRecordCount,
      verified_task_count: verifiedTaskCount,
      verification_status: verificationStatus,
      ...metrics,
      cost_per_verified_task: derivedCostPerVerifiedTask(
        metrics.model_cost,
        verifiedTaskCount,
        verificationStatus,
      ),
    };
  });
}


export function unavailableAiCompanyMissionControl(reason = "source_missing") {
  const emptyOperations = {
    offers: [], leads: [], opportunities: [], experiments: [], orders: [], deliveries: [],
    payments: [], customerFeedback: [],
    counters: { offers: null, leads: null, opportunities: null, experiments: null, orders: null, deliveries: null, payments: null, feedback: null },
    recordCounters: { offers: null, leads: null, opportunities: null, experiments: null, orders: null, deliveries: null, payments: null, feedback: null },
    nonRealCounters: { offers: null, leads: null, opportunities: null, experiments: null, orders: null, deliveries: null, payments: null, feedback: null },
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
    financialSummary: null,
    modelProductivity: [],
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
  const records = [...Object.values(entities).flat(), ...Object.values(operations).filter(Array.isArray).flat()];
  const rootState = normalizeState(
    payload.data_state,
    records,
    projectionTiming(payload),
    options,
  );
  operations.state = normalizeState(
    operationRoot.data_state,
    Object.values(operations).filter(Array.isArray).flat(),
    projectionTiming(operationRoot, payload),
    options,
  );
  Object.assign(operations, operationCounterSet(operations, operationRoot, operations.state));
  const sectionStates = {};
  for (const [name, items] of Object.entries(entities)) {
    const container = sectionContainer(payload, SECTION_STATE_SOURCES[name] ?? [name]);
    sectionStates[name] = normalizeState(
      container?.data_state,
      items,
      projectionTiming(container, payload),
      options,
    );
  }
  const approvalContainer = sectionContainer(payload, ["approvals"]);
  const approvalSource = {
    authority: payload.authority,
    sourceRef: approvalContainer?.source_ref,
  };
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  entities.approvals = entities.approvals.map((approval) => {
    const trust = approvalDecisionTrust(
      approval,
      sectionStates.approvals,
      approvalSource,
      true,
      nowMs,
    );
    return {
      ...approval,
      decision_trusted: trust.trusted,
      decision_trust_reason: trust.reason,
    };
  });
  const financialSummary = entities.economics.find((item) => item.cost_id === "economics.global.summary") ?? null;
  const modelProductivity = buildModelProductivity(
    entities.economics.filter((item) => item.cost_id !== "economics.global.summary"),
    entities.verifications,
    sectionStates.verifications,
  );
  return {
    schemaVersion: String(payload.schema_version || "unknown"),
    generatedAt: String(payload.generated_at || ""),
    exportHash: String(payload.export_hash || ""),
    safeToExpose: true,
    state: rootState,
    sectionStates,
    ...entities,
    financialSummary,
    modelProductivity,
    operations,
  };
}
