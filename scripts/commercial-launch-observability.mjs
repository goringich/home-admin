const PRODUCT_READY_STATES = new Set(["ready"]);
const PRODUCT_BLOCKED_STATES = new Set(["blocked"]);
const CAMPAIGN_READY_STATES = new Set(["allow"]);
const CAMPAIGN_BLOCKED_STATES = new Set(["blocked", "deny", "owner_approval_required"]);
const BILLING_READY_STATES = new Set(["verified"]);
const BILLING_BLOCKED_STATES = new Set(["owner_binding_required", "configured_unverified"]);
const RECEIPT_READY_STATES = new Set(["verified"]);
const RECEIPT_BLOCKED_STATES = new Set(["owner_decision_required", "configured_unverified"]);
const PUBLISHED_STATES = new Set(["published", "live", "verified_published", "publication_verified"]);
const PUBLICATION_BLOCKED_STATES = new Set(["blocked_by_owner_and_publication_gates"]);
const SUMMARY_STALE_AFTER_MS = 15 * 60 * 1000;
const REVENUE_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stage(id, label, status, detail, observedCount = null, pendingCount = null) {
  return { id, label, status, detail, observedCount, pendingCount };
}

function generatedSourceState(generatedAt, now, staleAfterMs) {
  if (!Number.isFinite(now)) return "unavailable";
  const timestamp = Date.parse(text(generatedAt));
  if (!Number.isFinite(timestamp)) return "unavailable";
  const age = now - timestamp;
  if (age < -MAX_FUTURE_SKEW_MS) return "unavailable";
  return age > staleAfterMs ? "stale" : "fresh";
}

function classifiedSignal(value, readyStates, blockedStates) {
  const normalized = text(value);
  if (readyStates.has(normalized)) return "verified";
  if (blockedStates.has(normalized)) return "blocked";
  return "unavailable";
}

function billingReadinessSignal(billing) {
  if (billing.status !== "available" || billing.contractStatus !== "valid") return "unavailable";
  const overall = classifiedSignal(billing.readinessStatus, BILLING_READY_STATES, BILLING_BLOCKED_STATES);
  if (overall !== "verified") return overall;

  const collections = [billing.sellerProfiles, billing.paymentProfiles, billing.productBindings];
  if (collections.some((items) => !Array.isArray(items) || items.length === 0)) return "unavailable";
  const bindingStatuses = collections.flatMap((items) => items.map((item) => record(item) ? text(item.status) : ""));
  const classified = bindingStatuses.map((status) => classifiedSignal(status, BILLING_READY_STATES, BILLING_BLOCKED_STATES));
  if (classified.includes("blocked")) return "blocked";
  if (classified.includes("unavailable")) return "unavailable";
  return "verified";
}

function readinessStage(revenue, billing, now) {
  const revenueState = revenue.status !== "available"
    ? "unavailable"
    : revenue.freshness === "stale"
      ? "stale"
      : revenue.freshness === "unavailable"
        ? "unavailable"
        : generatedSourceState(revenue.generated_at, now, REVENUE_STALE_AFTER_MS);
  if (revenueState === "stale") {
    return stage("readiness", "Readiness", "stale", "Product and campaign readiness evidence is stale and cannot verify launch readiness.");
  }
  if (revenueState === "unavailable") {
    return stage("readiness", "Readiness", "unavailable", "Product and campaign readiness evidence is unavailable.");
  }
  const signals = [
    classifiedSignal(revenue.product_readiness, PRODUCT_READY_STATES, PRODUCT_BLOCKED_STATES),
    classifiedSignal(revenue.campaign_readiness, CAMPAIGN_READY_STATES, CAMPAIGN_BLOCKED_STATES),
    billingReadinessSignal(billing),
  ];
  const blockedSignals = signals.filter((value) => value === "blocked");

  if (blockedSignals.length > 0) {
    return stage(
      "readiness",
      "Readiness",
      "blocked",
      `${blockedSignals.length} of 3 required readiness signals are not verified.`,
    );
  }
  if (signals.every((value) => value === "verified")) {
    return stage("readiness", "Readiness", "verified", "All required product, campaign and billing readiness signals are verified.");
  }
  return stage("readiness", "Readiness", "unavailable", "Required readiness evidence is incomplete or unavailable.");
}

function summaryState(summary, now) {
  if (summary.source_status !== "available") return "unavailable";
  if (summary.freshness === "stale") return "stale";
  if (summary.freshness !== "fresh") return "unavailable";
  return generatedSourceState(summary.generated_at, now, SUMMARY_STALE_AFTER_MS);
}

function publicationStage(summary, now) {
  const sourceState = summaryState(summary, now);
  if (sourceState === "unavailable") {
    return stage("publication", "Publication", "unavailable", "Publication evidence is unavailable.");
  }
  if (sourceState === "stale") {
    return stage("publication", "Publication", "stale", "Publication evidence exists but its aggregate source is stale.");
  }
  const publicationState = text(summary.publication_state);
  if (!publicationState) {
    return stage("publication", "Publication", "unavailable", "Publication state is absent from the authoritative aggregate.");
  }
  if (PUBLISHED_STATES.has(publicationState)) {
    return stage("publication", "Publication", "verified", "The authoritative aggregate marks the public entrypoint as published.");
  }
  if (PUBLICATION_BLOCKED_STATES.has(publicationState)) {
    return stage("publication", "Publication", "blocked", "The authoritative aggregate verifies an unresolved publication gate.");
  }
  return stage("publication", "Publication", "unavailable", "Publication state is unknown or unsupported by the authoritative aggregate contract.");
}

function leadStage(summary, now) {
  const leads = count(record(summary.funnel) ? summary.funnel.leads : null);
  const sourceState = summaryState(summary, now);
  if (sourceState === "unavailable" || leads === null) {
    return stage("lead", "Lead", "unavailable", "Lead evidence is unavailable; unknown is not treated as zero.");
  }
  if (sourceState === "stale") {
    return stage("lead", "Lead", "stale", "The aggregate lead count is stale and is not current proof.", leads);
  }
  if (leads > 0) {
    return stage("lead", "Lead", "observed", "The authoritative aggregate contains observed lead events.", leads);
  }
  return stage("lead", "Lead", "not_observed", "The fresh authoritative aggregate contains zero observed lead events.", 0);
}

function paymentStage(summary, now) {
  const funnel = record(summary.funnel) ? summary.funnel : {};
  const verified = count(funnel.payments_verified);
  const pending = count(funnel.payments_pending);
  const sourceState = summaryState(summary, now);
  if (sourceState === "unavailable" || (verified === null && pending === null)) {
    return stage("payment", "Payment", "unavailable", "Payment evidence is unavailable; readiness is not payment proof.");
  }
  if (sourceState === "stale") {
    return stage("payment", "Payment", "stale", "The aggregate payment counts are stale and are not current proof.", verified, pending);
  }
  if (verified !== null && verified > 0) {
    return stage("payment", "Payment", "observed", "The authoritative aggregate contains verified payment events.", verified, pending);
  }
  if (pending !== null && pending > 0) {
    return stage("payment", "Payment", "pending", "Payment events await verification; they are not counted as received payments.", verified, pending);
  }
  if (verified === 0 && pending === 0) {
    return stage("payment", "Payment", "not_observed", "The fresh authoritative aggregate contains zero verified or pending payment events.", 0, 0);
  }
  return stage("payment", "Payment", "unavailable", "Complete verified and pending payment evidence is unavailable.", verified, pending);
}

function receiptStage(billing, payment) {
  if (billing.status !== "available" || billing.contractStatus !== "valid" || !Array.isArray(billing.paymentProfiles) || billing.paymentProfiles.length === 0) {
    return stage("receipt", "Receipt", "unavailable", "Receipt policy evidence is unavailable; no issued-receipt evidence is exported.");
  }
  const receiptStatuses = billing.paymentProfiles.map((profile) => record(profile) ? text(profile.receiptStatus) : "");
  const classified = receiptStatuses.map((status) => classifiedSignal(status, RECEIPT_READY_STATES, RECEIPT_BLOCKED_STATES));
  if (classified.includes("blocked")) {
    return stage("receipt", "Receipt", "blocked", "Receipt policy is not verified; no issued-receipt evidence is exported.");
  }
  if (classified.includes("unavailable")) {
    return stage("receipt", "Receipt", "unavailable", "Receipt policy evidence is incomplete; no issued-receipt evidence is exported.");
  }
  if (payment.status === "stale") {
    return stage("receipt", "Receipt", "stale", "Payment evidence is stale, so receipt issuance remains unverified.");
  }
  if (payment.status === "unavailable") {
    return stage("receipt", "Receipt", "unavailable", "Payment evidence is unavailable, so receipt issuance cannot be determined.");
  }
  if (payment.status === "pending") {
    return stage("receipt", "Receipt", "pending", "Payment verification is pending, so receipt issuance remains pending too.");
  }
  if (payment.status === "observed") {
    return stage("receipt", "Receipt", "pending", "Receipt policy is verified, but issuance evidence is not exported.");
  }
  return stage("receipt", "Receipt", "not_observed", "Receipt policy is verified; issuance evidence is not exported and no verified payment is observed.");
}

/**
 * Builds a fail-closed, aggregate-only commercial evidence chain. It never
 * forwards arbitrary upstream fields, identities, account data, amounts, or
 * receipt documents into the Atlas snapshot.
 */
export function normalizeCommercialLaunchObservability(input, now = Date.now()) {
  const payload = record(input) ? input : {};
  const summary = record(payload.summary) ? payload.summary : {};
  const revenue = record(payload.revenue) ? payload.revenue : {};
  const billing = record(payload.billing) ? payload.billing : {};
  const readiness = readinessStage(revenue, billing, now);
  const publication = publicationStage(summary, now);
  const lead = leadStage(summary, now);
  const payment = paymentStage(summary, now);
  const receipt = receiptStage(billing, payment);

  return {
    policy: "aggregate_evidence_only",
    stages: [readiness, publication, lead, payment, receipt],
  };
}
