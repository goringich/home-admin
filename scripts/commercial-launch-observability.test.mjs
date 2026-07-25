import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCommercialLaunchObservability } from "./commercial-launch-observability.mjs";

const NOW = Date.parse("2026-07-26T00:00:00.000Z");
const GENERATED_AT = new Date(NOW).toISOString();

function byId(result, id) {
  return result.stages.find((stage) => stage.id === id);
}

const blockedInput = {
  summary: {
    source_status: "available",
    freshness: "fresh",
    generated_at: GENERATED_AT,
    publication_state: "blocked_by_owner_and_publication_gates",
    funnel: {
      leads: 0,
      payments_pending: 0,
      payments_verified: 0,
    },
    customer_identity: "PII_SENTINEL",
    payment_account: "ACCOUNT_SENTINEL",
  },
  revenue: {
    status: "available",
    generated_at: GENERATED_AT,
    product_readiness: "blocked",
    campaign_readiness: "blocked",
    funnel_counters: { revenue_rub: 999999 },
  },
  billing: {
    status: "available",
    contractStatus: "valid",
    readinessStatus: "owner_binding_required",
    paymentProfiles: [
      {
        profileId: "manual",
        status: "owner_binding_required",
        receiptStatus: "owner_decision_required",
        accountNumber: "ACCOUNT_SENTINEL",
      },
    ],
  },
};

test("projects the blocked launch path without leaking identity, account or amount fields", () => {
  const result = normalizeCommercialLaunchObservability(blockedInput, NOW);

  assert.equal(result.policy, "aggregate_evidence_only");
  assert.deepEqual(result.stages.map((stage) => stage.id), ["readiness", "publication", "lead", "payment", "receipt"]);
  assert.equal(byId(result, "readiness").status, "blocked");
  assert.equal(byId(result, "publication").status, "blocked");
  assert.equal(byId(result, "lead").status, "not_observed");
  assert.equal(byId(result, "lead").observedCount, 0);
  assert.equal(byId(result, "payment").status, "not_observed");
  assert.equal(byId(result, "payment").observedCount, 0);
  assert.equal(byId(result, "receipt").status, "blocked");
  assert.match(byId(result, "receipt").detail, /no issued-receipt evidence/i);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /PII_SENTINEL|ACCOUNT_SENTINEL|999999|customer_identity|payment_account|revenue_rub/);
});

test("distinguishes observed funnel evidence from receipt issuance proof", () => {
  const result = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      generated_at: GENERATED_AT,
      publication_state: "published",
      funnel: { leads: 3, payments_pending: 0, payments_verified: 1 },
    },
    revenue: {
      status: "available",
      generated_at: GENERATED_AT,
      product_readiness: "ready",
      campaign_readiness: "allow",
      funnel_counters: {},
    },
    billing: {
      status: "available",
      contractStatus: "valid",
      readinessStatus: "verified",
      sellerProfiles: [{ profileId: "owner", status: "verified" }],
      paymentProfiles: [{ profileId: "manual", status: "verified", receiptStatus: "verified", receiptDocument: "DOCUMENT_SENTINEL" }],
      productBindings: [{ productId: "product", status: "verified" }],
    },
  }, NOW);

  assert.equal(byId(result, "readiness").status, "verified");
  assert.equal(byId(result, "publication").status, "verified");
  assert.equal(byId(result, "lead").status, "observed");
  assert.equal(byId(result, "lead").observedCount, 3);
  assert.equal(byId(result, "payment").status, "observed");
  assert.equal(byId(result, "payment").observedCount, 1);
  assert.equal(byId(result, "receipt").status, "pending");
  assert.match(byId(result, "receipt").detail, /policy is verified/i);
  assert.match(byId(result, "receipt").detail, /issuance evidence is not exported/i);
  assert.doesNotMatch(JSON.stringify(result), /DOCUMENT_SENTINEL/);
});

test("does not mark billing readiness verified when required binding evidence is absent", () => {
  const result = normalizeCommercialLaunchObservability({
    revenue: {
      status: "available",
      generated_at: GENERATED_AT,
      product_readiness: "ready",
      campaign_readiness: "allow",
    },
    billing: {
      status: "available",
      contractStatus: "valid",
      readinessStatus: "verified",
      sellerProfiles: [],
      paymentProfiles: [{ profileId: "manual", status: "verified", receiptStatus: "verified" }],
      productBindings: [],
    },
  }, NOW);

  assert.equal(byId(result, "readiness").status, "unavailable");
  assert.match(byId(result, "readiness").detail, /incomplete/i);
});

test("keeps missing, stale and pending evidence distinct from authoritative zero", () => {
  const missing = normalizeCommercialLaunchObservability({}, NOW);
  assert.equal(byId(missing, "publication").status, "unavailable");
  assert.equal(byId(missing, "lead").status, "unavailable");
  assert.equal(byId(missing, "lead").observedCount, null);
  assert.equal(byId(missing, "payment").status, "unavailable");

  const stale = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "stale",
      generated_at: GENERATED_AT,
      publication_state: "published",
      funnel: { leads: 4, payments_pending: 2, payments_verified: 0 },
    },
    billing: {
      status: "available",
      contractStatus: "valid",
      paymentProfiles: [{ receiptStatus: "verified" }],
    },
  }, NOW);
  assert.equal(byId(stale, "publication").status, "stale");
  assert.equal(byId(stale, "lead").status, "stale");
  assert.equal(byId(stale, "lead").observedCount, 4);
  assert.equal(byId(stale, "payment").status, "stale");
  assert.equal(byId(stale, "receipt").status, "stale");

  const pending = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      generated_at: GENERATED_AT,
      publication_state: "published",
      funnel: { leads: 1, payments_pending: 2, payments_verified: 0 },
    },
    billing: {
      status: "available",
      contractStatus: "valid",
      paymentProfiles: [{ receiptStatus: "verified" }],
    },
  }, NOW);
  assert.equal(byId(pending, "payment").status, "pending");
  assert.equal(byId(pending, "payment").observedCount, 0);
  assert.equal(byId(pending, "payment").pendingCount, 2);
  assert.equal(byId(pending, "receipt").status, "pending");
});

test("age-gates commercial aggregates and keeps unavailable receipt evidence fail-closed", () => {
  const verifiedBilling = {
    status: "available",
    contractStatus: "valid",
    readinessStatus: "verified",
    sellerProfiles: [{ status: "verified" }],
    paymentProfiles: [{ status: "verified", receiptStatus: "verified" }],
    productBindings: [{ status: "verified" }],
  };
  const staleSummary = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      generated_at: new Date(NOW - 16 * 60 * 1000).toISOString(),
      publication_state: "published",
      funnel: { leads: 1, payments_pending: 0, payments_verified: 1 },
    },
    revenue: {
      status: "available",
      generated_at: GENERATED_AT,
      product_readiness: "ready",
      campaign_readiness: "allow",
    },
    billing: verifiedBilling,
  }, NOW);
  assert.equal(byId(staleSummary, "publication").status, "stale");
  assert.equal(byId(staleSummary, "lead").status, "stale");
  assert.equal(byId(staleSummary, "payment").status, "stale");
  assert.equal(byId(staleSummary, "receipt").status, "stale");

  const staleRevenue = normalizeCommercialLaunchObservability({
    revenue: {
      status: "available",
      generated_at: new Date(NOW - (6 * 60 + 1) * 60 * 1000).toISOString(),
      product_readiness: "ready",
      campaign_readiness: "allow",
    },
    billing: verifiedBilling,
  }, NOW);
  assert.equal(byId(staleRevenue, "readiness").status, "stale");

  const missingTimestamps = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      publication_state: "published",
      funnel: { leads: 1, payments_pending: 0, payments_verified: 1 },
    },
    revenue: {
      status: "available",
      product_readiness: "ready",
      campaign_readiness: "allow",
    },
    billing: verifiedBilling,
  }, NOW);
  assert.equal(byId(missingTimestamps, "readiness").status, "unavailable");
  assert.equal(byId(missingTimestamps, "publication").status, "unavailable");
  assert.equal(byId(missingTimestamps, "lead").status, "unavailable");
  assert.equal(byId(missingTimestamps, "payment").status, "unavailable");
  assert.equal(byId(missingTimestamps, "receipt").status, "unavailable");

  const unavailablePayment = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      generated_at: GENERATED_AT,
      publication_state: "published",
      funnel: { leads: 1 },
    },
    revenue: {
      status: "available",
      generated_at: GENERATED_AT,
      product_readiness: "ready",
      campaign_readiness: "allow",
    },
    billing: verifiedBilling,
  }, NOW);
  assert.equal(byId(unavailablePayment, "payment").status, "unavailable");
  assert.equal(byId(unavailablePayment, "receipt").status, "unavailable");
});

test("keeps unknown readiness, publication and receipt states unavailable", () => {
  const result = normalizeCommercialLaunchObservability({
    summary: {
      source_status: "available",
      freshness: "fresh",
      generated_at: GENERATED_AT,
      publication_state: "unknown",
      funnel: { leads: 0, payments_pending: 0, payments_verified: 0 },
    },
    revenue: {
      status: "available",
      generated_at: GENERATED_AT,
      product_readiness: "unknown",
      campaign_readiness: "allow",
    },
    billing: {
      status: "available",
      contractStatus: "valid",
      readinessStatus: "unknown",
      sellerProfiles: [{ status: "unknown" }],
      paymentProfiles: [{ status: "unknown", receiptStatus: "unknown" }],
      productBindings: [{ status: "unknown" }],
    },
  }, NOW);

  assert.equal(byId(result, "readiness").status, "unavailable");
  assert.equal(byId(result, "publication").status, "unavailable");
  assert.equal(byId(result, "receipt").status, "unavailable");
});
