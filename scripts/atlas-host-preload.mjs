import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { rebuildSnapshotAfterProjectionRefresh as rebuildSnapshot } from "./local-agent-platform-refresh.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const snapshotPath = path.join(rootDir, "public", "snapshot.json");
const recoveryScript = path.join(rootDir, "scripts", "build-snapshot-recovery.mjs");

export function rebuildSnapshotWithColdStartRecovery({
  snapshotExists = () => fs.existsSync(snapshotPath),
  recoverSnapshot = () => execFileSync(process.execPath, [recoveryScript], {
    cwd: rootDir,
    stdio: "ignore",
    timeout: 120_000,
  }),
  ...options
} = {}) {
  const result = rebuildSnapshot(options);
  if (result.rebuilt || snapshotExists()) {
    return result;
  }

  try {
    recoverSnapshot();
  } catch {
    // The caller will surface snapshot_unavailable only if recovery also failed.
  }

  const recovered = snapshotExists();
  return {
    ...result,
    recovered,
    status: recovered ? "recovery_snapshot_written" : "snapshot_unavailable",
  };
}

// Compatibility bridge for the legacy Atlas host. The host currently calls this
// helper as a global identifier. Besides preloading the ESM helper, recover a
// cold-start snapshot when the canonical builder fails and no stale snapshot
// exists. This keeps direct/legacy atlasd startup fail-soft as well as the
// canonical resilient host path.
globalThis.rebuildSnapshotAfterProjectionRefresh = rebuildSnapshotWithColdStartRecovery;
