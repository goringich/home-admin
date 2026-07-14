import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeServicePlacementProjection } from "./service-placement-projection.mjs";

test("accepts only the sanitized placement projection and preserves writer metadata", () => {
  const projected = sanitizeServicePlacementProjection({
    schema_version: "2026-07-15.ai-os-placement.v1",
    generated_at: "2026-07-15T00:00:00Z",
    status: "attention",
    safety: {
      atlas_read_only_projection: true,
      secrets_exported: false,
      raw_prompts_exported: false,
    },
    raw_prompt: "must never reach Atlas",
    hosts: [{
      host_id: "server-secondary",
      availability: "online",
      health_freshness: "fresh",
      connectivity: "reachable",
      private_token: "must never reach Atlas",
      failure: { id: "", severity: "", detail: "" },
    }],
    services: [{
      service_id: "payment-api",
      authoritative_writer: "server-primary",
      configured_host: "server-primary",
      active_host: "server-secondary",
      stateful: true,
      raw_response: "must never reach Atlas",
      failure: { id: "configured_host_unhealthy", severity: "high", detail: "safe detail" },
    }],
  });

  assert.equal(projected.trusted, true);
  assert.equal(projected.hosts[0].hostId, "server-secondary");
  assert.equal(projected.services[0].authoritativeWriter, "server-primary");
  assert.equal(JSON.stringify(projected).includes("must never reach Atlas"), false);
});

test("rejects a projection without its read-only redaction contract", () => {
  const projected = sanitizeServicePlacementProjection({
    schema_version: "2026-07-15.ai-os-placement.v1",
    status: "ok",
    safety: { atlas_read_only_projection: true, secrets_exported: false, raw_prompts_exported: true },
    services: [{ service_id: "untrusted" }],
  });

  assert.equal(projected.trusted, false);
  assert.equal(projected.status, "invalid");
  assert.deepEqual(projected.services, []);
});
