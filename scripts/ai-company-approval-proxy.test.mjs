import assert from "node:assert/strict";
import test from "node:test";
import {
  forwardApprovalDecision,
  normalizeApprovalDecision,
} from "./ai-company-approval-proxy.mjs";


const payload = {
  approval_id: "approval_0123456789abcdef0123456789abcdef",
  decision: "approve",
  actor: "owner",
  reason: "Reviewed bounded evidence",
  expected_revision: 2,
  idempotency_key: "atlas-approval-001",
};


test("proxy forwards only typed fields to the fixed authenticated loopback endpoint", async () => {
  const calls = [];
  const result = await forwardApprovalDecision(payload, {
    access: "x".repeat(48),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { underlying_action: "not_executed" } }),
      };
    },
  });

  assert.equal(calls[0].url, "http://127.0.0.1:8766/api/dev/ai-company/approvals/decision");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${"x".repeat(48)}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
  assert.equal(result.result.underlying_action, "not_executed");
});


test("proxy rejects command-shaped fields and non-loopback upstreams", async () => {
  assert.throws(
    () => normalizeApprovalDecision({ ...payload, command: "rm" }),
    /unsupported_approval_fields/,
  );
  await assert.rejects(
    () => forwardApprovalDecision(payload, {
      access: "x".repeat(48),
      upstreamUrl: "https://external.example/decision",
      fetchImpl: async () => { throw new Error("must not run"); },
    }),
    /loopback/,
  );
});


test("proxy keeps upstream failures structured", async () => {
  await assert.rejects(
    () => forwardApprovalDecision(payload, {
      access: "x".repeat(48),
      fetchImpl: async () => ({
        ok: false,
        status: 409,
        json: async () => ({ ok: false, error: "revision_conflict" }),
      }),
    }),
    (error) => error.code === "revision_conflict" && error.statusCode === 409,
  );
});
