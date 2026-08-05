import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const viteEntrypoint = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const gatewayEntrypoint = path.join(rootDir, "scripts", "device-fleet-host.mjs");
const children = [];
let shuttingDown = false;

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${label} exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
    shutdown(code === 0 ? 0 : 1);
  });
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 1_000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("fleet gateway", process.execPath, [gatewayEntrypoint]);
start("Vite", process.execPath, [viteEntrypoint, "--host", "127.0.0.1"]);
