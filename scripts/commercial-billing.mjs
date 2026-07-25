function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeCommercialBilling(input) {
  const payload = record(input) ? input : {};
  if (payload.contract_status !== "valid" || !Array.isArray(payload.product_bindings)) {
    return {
      status: "unavailable",
      schemaVersion: text(payload.schema_version),
      contractStatus: text(payload.contract_status) || "invalid",
      readinessStatus: "unknown",
      sellerProfiles: [],
      paymentProfiles: [],
      productBindings: [],
    };
  }
  return {
    status: "available",
    schemaVersion: text(payload.schema_version),
    contractStatus: "valid",
    readinessStatus: text(payload.readiness_status) || "unknown",
    sellerProfiles: (Array.isArray(payload.seller_profiles) ? payload.seller_profiles : []).flatMap((item) => record(item) ? [{
      profileId: text(item.profile_id),
      status: text(item.status) || "unknown",
    }] : []),
    paymentProfiles: (Array.isArray(payload.payment_profiles) ? payload.payment_profiles : []).flatMap((item) => record(item) ? [{
      profileId: text(item.profile_id),
      providerId: text(item.provider_id),
      status: text(item.status) || "unknown",
      receiptStatus: text(item.receipt_status) || "unknown",
      merchantReuseStatus: text(item.merchant_reuse_status) || "unknown",
    }] : []),
    productBindings: payload.product_bindings.flatMap((item) => record(item) ? [{
      productId: text(item.product_id),
      sellerProfileId: text(item.seller_profile_id),
      paymentProfileIds: Array.isArray(item.payment_profile_ids) ? item.payment_profile_ids.map(text).filter(Boolean) : [],
      status: text(item.status) || "unknown",
    }] : []),
  };
}
