import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCommercialSummary, normalizeRevenueAutopilot } from "./commercial-summary.mjs";

const NOW = Date.parse("2026-07-13T11:20:00.000Z");
const valid = {
  generated_at: "2026-07-13T11:19:00.000Z",
  source_status: "available",
  freshness: "fresh",
  primary_offer: { product_id: "elizabet", offer_id: "elizabeth-gift-room", title: "Elizabeth Gift Room", starting_price_rub: 4900 },
  funnel: { leads: 0, qualified_leads: 0, quotes_sent: 0, payments_pending: 2, payments_verified: 0, orders_in_fulfillment: 0, orders_delivered: 0, orders_canceled: 0, orders_refunded: 0 },
  publication_state: "blocked", telegram_intake_state: "operator_only", active_experiment: "test", blockers: [], next_machine_action: "observe", next_human_action: "approve",
};

test("normalizes a successful authoritative zero summary", () => {
  const result = normalizeCommercialSummary(valid, NOW);
  assert.equal(result.source_status, "available");
  assert.equal(result.freshness, "fresh");
  assert.equal(result.funnel.leads, 0);
  assert.equal(result.funnel.payments_verified, 0);
  assert.equal(result.funnel.payments_pending, 2);
});

test("handles unavailable and malformed summary sources without replacing with zeros", () => {
  const unavailable = normalizeCommercialSummary({ source_status: "unavailable", freshness: "unavailable" }, NOW);
  assert.equal(unavailable.source_status, "unavailable");
  assert.equal(unavailable.funnel.leads, null);
  const malformed = normalizeCommercialSummary({ ...valid, funnel: { ...valid.funnel, leads: "0" } }, NOW);
  assert.equal(malformed.source_status, "unavailable");
  assert.equal(malformed.funnel.leads, null);
});

test("marks old generated aggregate data as stale", () => {
  const result = normalizeCommercialSummary({ ...valid, generated_at: "2026-07-13T10:00:00.000Z" }, NOW);
  assert.equal(result.source_status, "available");
  assert.equal(result.freshness, "stale");
});

test("First Money UI keeps unknown, zero, stale and pending-payment wording safe", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /Нет проверенных данных/);
  assert.match(source, /Данные устарели/);
  assert.match(source, /Ожидающие проверки оплаты/);
  assert.match(source, /Подтверждённые оплаты/);
  assert.doesNotMatch(source, /выручк/i);
});

test("normalizes Revenue Autopilot as a read-only commercial projection", () => {
  const result = normalizeRevenueAutopilot({
    schema_version: "2026-07-13.revenue-autopilot-atlas.v1",
    generated_at: "2026-07-13T11:19:00.000Z",
    safe_to_expose: true,
    active_revenue_lane: "elizabet",
    active_experiment: "gift-room-founder-post-v1",
    current_spend_cap_rub: 0,
    product_readiness: "blocked",
    campaign_readiness: "blocked",
    funnel_counters: { attributed_sessions: null, qualified_leads: null, revenue_rub: null },
    analytics_status: "unavailable",
    experiment_classification: "blocked",
    experiment_action: "repair_analytics_source",
    blocked_gates: ["public_entrypoint"],
    next_exact_money_action: "Provision owned HTTPS.",
    last_autonomous_run: null,
    owner_approvals_needed: ["Provision owned HTTPS."],
    creative_factory: {
      status: "plan_only_blocked_pending_approved_assets",
      asset_status: "blocked_pending_approved_assets",
      approved_asset_count: 0,
      capture_task_ids: ["elizabeth-public-safe-short-form-capture-v1"],
      primary_angle_count: 5,
      planned_render_jobs: 15,
      rendered_video_count: 0,
      analytics_status: "unavailable",
      publish_policy: "owner_approval_required",
    },
    host_safe_mode: true,
  });
  assert.equal(result.status, "available");
  assert.equal(result.active_revenue_lane, "elizabet");
  assert.equal(result.current_spend_cap_rub, 0);
  assert.equal(result.funnel_counters.attributed_sessions, null);
  assert.deepEqual(result.blocked_gates, ["public_entrypoint"]);
  assert.equal(result.creative_factory?.planned_render_jobs, 15);
  assert.equal(result.creative_factory?.rendered_video_count, 0);
});

test("withholds unsafe or malformed Revenue Autopilot exports", () => {
  assert.equal(normalizeRevenueAutopilot(null).status, "unavailable");
  assert.equal(normalizeRevenueAutopilot({ safe_to_expose: false }).status, "unavailable");
  assert.equal(normalizeRevenueAutopilot({ safe_to_expose: true, active_revenue_lane: 42 }).status, "unavailable");
  const unsafeCreative = normalizeRevenueAutopilot({
    safe_to_expose: true,
    active_revenue_lane: "elizabet",
    product_readiness: "blocked",
    campaign_readiness: "blocked",
    funnel_counters: {},
    creative_factory: { status: "plan", asset_status: "blocked", approved_asset_count: -1 },
  });
  assert.equal(unsafeCreative.status, "available");
  assert.equal(unsafeCreative.creative_factory, null);
});
