import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCommercialBilling } from "./commercial-billing.mjs";

test("projects only commercial profile identifiers and readiness", () => {
  const projection = normalizeCommercialBilling({
    schema_version: "v1",
    contract_status: "valid",
    readiness_status: "owner_binding_required",
    seller_profiles: [{ profile_id: "owner-primary", status: "owner_binding_required", private_binding_ref: "private-value" }],
    payment_profiles: [{ profile_id: "manual", provider_id: "manual", status: "owner_binding_required", receipt_status: "owner_decision_required", merchant_reuse_status: "not_applicable", account_number: "private-value" }],
    product_bindings: [{ product_id: "lead-desk", seller_profile_id: "owner-primary", payment_profile_ids: ["manual"], status: "owner_binding_required" }],
  });

  assert.equal(projection.status, "available");
  assert.equal(projection.productBindings[0].productId, "lead-desk");
  assert.equal(projection.paymentProfiles[0].receiptStatus, "owner_decision_required");
  assert.doesNotMatch(JSON.stringify(projection), /private-value|private_binding_ref|account_number/);
});

test("fails closed when the upstream contract is not valid", () => {
  const projection = normalizeCommercialBilling({ contract_status: "invalid", readiness_status: "verified" });

  assert.equal(projection.status, "unavailable");
  assert.equal(projection.readinessStatus, "unknown");
  assert.deepEqual(projection.productBindings, []);
});
