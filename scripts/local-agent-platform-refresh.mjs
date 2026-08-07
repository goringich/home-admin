import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const defaultExporterPath = path.join(
  home,
  "__home_organized",
  "local-codex-stack",
  "scripts",
  "local_agent_platform.py",
);

export const LOCAL_AGENT_PLATFORM_EXPORT_MAX_TIMEOUT_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 12_000;

function boundedTimeout(value) {
  const requested = Number.isFinite(value) ? Math.trunc(value) : DEFAULT_TIMEOUT_MS;
  return Math.min(LOCAL_AGENT_PLATFORM_EXPORT_MAX_TIMEOUT_MS, Math.max(1, requested));
}

export function refreshLocalAgentPlatformProjection({
  exporterPath = defaultExporterPath,
  pythonPath = "/usr/bin/python",
  run = execFileSync,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  try {
    run(pythonPath, [exporterPath, "atlas-export"], {
      cwd: path.dirname(exporterPath),
      env: {
        HOME: home,
        LANG: "C.UTF-8",
        PATH: "/usr/local/bin:/usr/bin:/bin",
      },
      killSignal: "SIGTERM",
      shell: false,
      stdio: "ignore",
      timeout: boundedTimeout(timeoutMs),
      windowsHide: true,
    });
    return { refreshed: true, status: "refreshed" };
  } catch {
    return { refreshed: false, status: "stale_preserved" };
  }
}

export function rebuildSnapshotAfterProjectionRefresh({
  rebuildSnapshot,
  refreshProjection = refreshLocalAgentPlatformProjection,
}) {
  let projection = { refreshed: false, status: "stale_preserved" };
  try {
    projection = refreshProjection() || projection;
  } catch {
    // Projection freshness is advisory; the last sanitized artifact remains valid evidence.
  }

  try {
    rebuildSnapshot();
    return {
      rebuilt: true,
      status: "rebuilt",
      projection,
    };
  } catch {
    // The always-on Atlas host must keep serving the last parseable snapshot.
    // Cold-start absence is still surfaced by the caller when it attempts to read the file.
    return {
      rebuilt: false,
      status: "stale_snapshot_preserved",
      projection,
    };
  }
}
