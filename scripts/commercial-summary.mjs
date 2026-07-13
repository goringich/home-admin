const UNKNOWN_FUNNEL = Object.freeze({
  leads: null,
  qualified_leads: null,
  quotes_sent: null,
  payments_pending: null,
  payments_verified: null,
  orders_in_fulfillment: null,
  orders_delivered: null,
  orders_canceled: null,
  orders_refunded: null,
});

const FUNNEL_KEYS = Object.keys(UNKNOWN_FUNNEL);
const STALE_AFTER_MS = 15 * 60 * 1000;

function unavailable(error = "Источник недоступен") {
  return {
    source_status: "unavailable",
    freshness: "unavailable",
    last_refresh: new Date().toISOString(),
    error,
    primary_offer: null,
    funnel: { ...UNKNOWN_FUNNEL },
    publication_state: null,
    telegram_intake_state: null,
    active_experiment: null,
    blockers: [],
    next_machine_action: null,
    next_human_action: null,
  };
}

function isNullableNumber(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

/** Sanitizes the generated Elizabeth aggregate before it is ever served by Atlas. */
export function normalizeCommercialSummary(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return unavailable("Malformed commercial summary source");
  if (raw.source_status !== "available" || raw.freshness !== "fresh") {
    return unavailable(typeof raw.error === "string" ? raw.error : "Источник недоступен");
  }
  const offer = raw.primary_offer;
  const funnel = raw.funnel;
  if (!offer || typeof offer !== "object" || !funnel || typeof funnel !== "object") return unavailable("Malformed commercial summary source");
  if (!FUNNEL_KEYS.every((key) => isNullableNumber(funnel[key]))) return unavailable("Malformed commercial summary source");
  if (typeof offer.title !== "string" || typeof offer.product_id !== "string" || typeof offer.offer_id !== "string" || !isNullableNumber(offer.starting_price_rub)) {
    return unavailable("Malformed commercial summary source");
  }
  const generatedAt = typeof raw.generated_at === "string" ? Date.parse(raw.generated_at) : Number.NaN;
  const stale = !Number.isFinite(generatedAt) || now - generatedAt > STALE_AFTER_MS;
  return {
    source_status: "available",
    freshness: stale ? "stale" : "fresh",
    last_refresh: typeof raw.generated_at === "string" ? raw.generated_at : new Date(now).toISOString(),
    primary_offer: {
      product_id: offer.product_id,
      offer_id: offer.offer_id,
      title: offer.title,
      starting_price_rub: offer.starting_price_rub,
    },
    funnel: Object.fromEntries(FUNNEL_KEYS.map((key) => [key, funnel[key]])),
    publication_state: typeof raw.publication_state === "string" ? raw.publication_state : null,
    telegram_intake_state: typeof raw.telegram_intake_state === "string" ? raw.telegram_intake_state : null,
    active_experiment: typeof raw.active_experiment === "string" ? raw.active_experiment : null,
    blockers: Array.isArray(raw.blockers) ? raw.blockers.filter((item) => typeof item === "string").slice(0, 12) : [],
    next_machine_action: typeof raw.next_machine_action === "string" ? raw.next_machine_action : null,
    next_human_action: typeof raw.next_human_action === "string" ? raw.next_human_action : null,
  };
}

const REVENUE_COUNTER_KEYS = Object.freeze([
  "attributed_sessions",
  "product_page_views",
  "cta_clicks",
  "lead_submit_success",
  "qualified_leads",
  "offer_sent",
  "payment_received",
  "room_delivered",
  "consented_testimonial_or_referral",
  "campaign_cost_rub",
  "revenue_rub",
  "gross_margin_estimate_rub",
]);

function safeStrings(value, limit = 20) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, limit) : [];
}

function normalizeCreativeFactory(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const numericKeys = ["approved_asset_count", "primary_angle_count", "planned_render_jobs", "rendered_video_count"];
  if (typeof raw.status !== "string" || typeof raw.asset_status !== "string" || typeof raw.analytics_status !== "string" || typeof raw.publish_policy !== "string") {
    return null;
  }
  const normalized = {
    status: raw.status,
    asset_status: raw.asset_status,
    capture_task_ids: safeStrings(raw.capture_task_ids, 12),
    analytics_status: raw.analytics_status,
    publish_policy: raw.publish_policy,
  };
  for (const key of numericKeys) {
    const value = raw[key];
    if (!isNullableNumber(value)) return null;
    normalized[key] = value ?? null;
  }
  return normalized;
}

/** Reads only the sanitized generated projection; manifests/configs remain authoritative. */
export function normalizeRevenueAutopilot(raw) {
  const unavailable = { status: "unavailable", active_revenue_lane: null, funnel_counters: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.safe_to_expose !== true) return unavailable;
  if (typeof raw.active_revenue_lane !== "string" || typeof raw.product_readiness !== "string" || typeof raw.campaign_readiness !== "string") return unavailable;
  if (!raw.funnel_counters || typeof raw.funnel_counters !== "object" || Array.isArray(raw.funnel_counters)) return unavailable;
  const funnelCounters = {};
  for (const key of REVENUE_COUNTER_KEYS) {
    const value = raw.funnel_counters[key];
    if (value !== undefined && !isNullableNumber(value)) return unavailable;
    funnelCounters[key] = value ?? null;
  }
  return {
    status: "available",
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : null,
    active_revenue_lane: raw.active_revenue_lane,
    active_experiment: typeof raw.active_experiment === "string" ? raw.active_experiment : null,
    current_spend_cap_rub: isNullableNumber(raw.current_spend_cap_rub) ? raw.current_spend_cap_rub : null,
    product_readiness: raw.product_readiness,
    campaign_readiness: raw.campaign_readiness,
    funnel_counters: funnelCounters,
    analytics_status: typeof raw.analytics_status === "string" ? raw.analytics_status : "unavailable",
    experiment_classification: typeof raw.experiment_classification === "string" ? raw.experiment_classification : null,
    experiment_action: typeof raw.experiment_action === "string" ? raw.experiment_action : null,
    blocked_gates: safeStrings(raw.blocked_gates),
    next_exact_money_action: typeof raw.next_exact_money_action === "string" ? raw.next_exact_money_action : null,
    last_autonomous_run: typeof raw.last_autonomous_run === "string" ? raw.last_autonomous_run : null,
    owner_approvals_needed: safeStrings(raw.owner_approvals_needed),
    host_safe_mode: raw.host_safe_mode === true,
    creative_factory: normalizeCreativeFactory(raw.creative_factory),
  };
}
