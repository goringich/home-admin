import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";


const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const snapshot = path.join(dist, "snapshot.json");
const chrome = "/opt/google/chrome/chrome";
const captureLimit = 4 * 1024 * 1024;

assert.ok(existsSync(path.join(dist, "index.html")), "Atlas dist is unavailable; run npm run build");
assert.ok(existsSync(snapshot), "Atlas snapshot fixture is unavailable");
assert.ok(existsSync(chrome), "Google Chrome binary is unavailable");

const temporary = mkdtempSync(path.join(tmpdir(), "project-atlas-browser-"));
const screenshot = path.join(temporary, "atlas-company.png");
const args = [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-crashpad-for-testing",
  "--allow-file-access-from-files",
  `--user-data-dir=${path.join(temporary, "profile")}`,
  "--virtual-time-budget=6000",
  "--window-size=1440,1200",
  `--screenshot=${screenshot}`,
  "--dump-dom",
  `${new URL(`file://${path.join(dist, "index.html")}`).href}#company`,
];
const forbiddenFlags = ["--disable-gpu", "--disable-gpu-compositing", "swiftshader", "software-rasterizer"];
assert.equal(args.some((value) => forbiddenFlags.some((flag) => value.toLowerCase().includes(flag))), false);

function runBrowser() {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > captureLimit) child.kill("SIGKILL");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > captureLimit) child.kill("SIGKILL");
    });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

try {
  const result = await runBrowser();
  assert.equal(result.code, 0, `Chrome failed (${result.signal ?? result.code}): ${result.stderr.slice(-800)}`);
  assert.match(result.stdout, /Company/);
  assert.match(result.stdout, /Portfolio/);
  assert.match(result.stdout, /Mission DAG/);
  assert.match(result.stdout, /Evidence &amp; verification|Evidence & verification/);
  assert.ok(existsSync(screenshot) && statSync(screenshot).size > 10_000, "Chrome screenshot is missing");
  const domHash = createHash("sha256").update(result.stdout).digest("hex");
  const screenshotHash = createHash("sha256").update(readFileSync(screenshot)).digest("hex");
  process.stdout.write(`${JSON.stringify({
    browser: "google-chrome-stable",
    dom_sha256: domHash,
    screenshot_sha256: screenshotHash,
    screenshot_bytes: statSync(screenshot).size,
    workspace: "company",
  })}\n`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
