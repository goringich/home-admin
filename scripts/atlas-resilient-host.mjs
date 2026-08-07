import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const recoveryScript = path.join(rootDir, "scripts", "build-snapshot-recovery.mjs");
const hostScript = path.join(rootDir, "scripts", "device-fleet-host.mjs");

const recovery = spawnSync(process.execPath, [recoveryScript], {
  cwd: rootDir,
  env: process.env,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 120_000,
});

if (recovery.stdout) process.stdout.write(recovery.stdout);
if (recovery.stderr) process.stderr.write(recovery.stderr);
if (recovery.status !== 0) {
  console.error(`Atlas snapshot bootstrap failed with exit code ${recovery.status ?? "unknown"}; refusing to start an empty host.`);
  process.exit(recovery.status || 1);
}

const child = spawn(process.execPath, [hostScript], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
