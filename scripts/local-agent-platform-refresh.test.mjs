import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_AGENT_PLATFORM_EXPORT_MAX_TIMEOUT_MS,
  rebuildSnapshotAfterProjectionRefresh,
  refreshLocalAgentPlatformProjection,
} from "./local-agent-platform-refresh.mjs";

test("refreshes only the read-only Atlas projection with bounded silent execution", () => {
  let invocation;
  const result = refreshLocalAgentPlatformProjection({
    exporterPath: "/safe/local_agent_platform.py",
    pythonPath: "/usr/bin/python",
    timeoutMs: LOCAL_AGENT_PLATFORM_EXPORT_MAX_TIMEOUT_MS * 2,
    run(command, args, options) {
      invocation = { command, args, options };
    },
  });

  assert.deepEqual(result, { refreshed: true, status: "refreshed" });
  assert.equal(invocation.command, "/usr/bin/python");
  assert.deepEqual(invocation.args, ["/safe/local_agent_platform.py", "atlas-export"]);
  assert.equal(invocation.options.stdio, "ignore");
  assert.equal(invocation.options.shell, false);
  assert.ok(invocation.options.timeout > 0);
  assert.ok(invocation.options.timeout <= LOCAL_AGENT_PLATFORM_EXPORT_MAX_TIMEOUT_MS);
  assert.deepEqual(Object.keys(invocation.options.env).sort(), ["HOME", "LANG", "PATH"]);
});

test("keeps the previous projection available when refresh fails", () => {
  const result = refreshLocalAgentPlatformProjection({
    run() {
      throw new Error("private child-process failure detail");
    },
  });

  assert.deepEqual(result, { refreshed: false, status: "stale_preserved" });
  assert.equal("error" in result, false);
  assert.equal("stdout" in result, false);
  assert.equal("stderr" in result, false);
});

test("still rebuilds the snapshot from the previous projection after an unexpected refresh failure", () => {
  let rebuilds = 0;
  rebuildSnapshotAfterProjectionRefresh({
    refreshProjection() {
      throw new Error("refresh failed before the helper could normalize it");
    },
    rebuildSnapshot() {
      rebuilds += 1;
    },
  });

  assert.equal(rebuilds, 1);
});
