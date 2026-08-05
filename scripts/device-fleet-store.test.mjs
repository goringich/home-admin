import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSignature,
  FleetStore,
  prepareDeviceDevTask,
  verifySignature,
} from "./device-fleet-store.mjs";

function fixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-fleet-"));
  let nowMs = Date.parse("2026-08-05T16:00:00.000Z");
  const store = new FleetStore({
    rootDir,
    now: () => nowMs,
    randomBytes: (size) => Buffer.alloc(size, 7),
  });
  return {
    rootDir,
    store,
    advance(ms) {
      nowMs += ms;
    },
    now() {
      return nowMs;
    },
  };
}

test("enrollment, signed heartbeat and public fleet state", () => {
  const fx = fixture();
  const enrollment = fx.store.enroll({
    hostname: "WIN-DEV-01",
    name: "Development PC",
    capabilities: ["telemetry", "camera"],
  });
  assert.equal(enrollment.device.id, "win-dev-01");
  assert.ok(enrollment.secret.length >= 40);

  const body = JSON.stringify({ hello: "world" });
  const timestamp = fx.now();
  const signature = buildSignature({
    secret: enrollment.secret,
    method: "POST",
    pathWithQuery: "/api/fleet/heartbeat",
    timestamp,
    nonce: "nonce-12345678",
    body,
  });
  assert.deepEqual(verifySignature({
    secret: enrollment.secret,
    method: "POST",
    pathWithQuery: "/api/fleet/heartbeat",
    timestamp,
    nonce: "nonce-12345678",
    body,
    signature,
    nowMs: fx.now(),
  }), { ok: true });

  fx.store.recordHeartbeat(enrollment.device.id, {
    name: "Development PC",
    telemetry: {
      system: { cpuPercent: 42, memoryPercent: 55, uptimeSeconds: 5000 },
      cameras: [{ id: "cam-1", name: "USB Camera", status: "OK" }],
      remote: { rustdeskInstalled: true, tailscaleConnected: true },
    },
  });
  const state = fx.store.state();
  assert.equal(state.counts.online, 1);
  assert.equal(state.devices[0].health, "ok");
  assert.equal(state.devices[0].telemetry.cameras.length, 1);
});

test("dangerous command requires exact device-name confirmation", () => {
  const fx = fixture();
  const { device } = fx.store.enroll({ hostname: "WIN-OPS", name: "Office PC" });
  assert.throws(
    () => fx.store.enqueueCommand(device.id, { type: "restart_pc", confirmDeviceName: "wrong" }),
    /device_name_confirmation_required/,
  );
  const command = fx.store.enqueueCommand(device.id, {
    type: "restart_pc",
    confirmDeviceName: "Office PC",
  });
  assert.equal(command.status, "queued");
  const delivered = fx.store.pollCommands(device.id);
  assert.equal(delivered[0].status, "delivered");
  const completed = fx.store.acknowledgeCommand(device.id, command.id, {
    status: "succeeded",
    result: { message: "restart scheduled" },
  });
  assert.equal(completed.status, "succeeded");
});

test("stale and offline status are derived from heartbeat age", () => {
  const fx = fixture();
  const { device } = fx.store.enroll({ hostname: "WIN-AGE" });
  fx.store.recordHeartbeat(device.id, { telemetry: { system: { cpuPercent: 1, memoryPercent: 2 } } });
  fx.advance(2 * 60_000);
  assert.equal(fx.store.state().devices[0].status, "stale");
  fx.advance(10 * 60_000);
  assert.equal(fx.store.state().devices[0].status, "offline");
});

test("device-scoped dev prompt contains evidence and safety boundary", () => {
  const fx = fixture();
  const { device } = fx.store.enroll({ hostname: "WIN-AI", name: "AI Workstation" });
  fx.store.recordHeartbeat(device.id, {
    telemetry: {
      system: { cpuPercent: 10, memoryPercent: 20 },
      gpus: [{ name: "RTX", utilizationPercent: 5 }],
    },
  });
  const publicDevice = fx.store.state().devices[0];
  const prepared = prepareDeviceDevTask({ device: publicDevice, task: "Diagnose unstable monitoring" });
  assert.match(prepared.prompt, /Diagnose unstable monitoring/);
  assert.match(prepared.prompt, /governed Windows fleet command catalog/);
  assert.equal(prepared.context.deviceId, device.id);
});
