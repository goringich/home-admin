import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getRemoteState, runRemoteAction } from "./remote-control.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(rootDir, "dist");
const snapshotPath = path.join(rootDir, "public", "snapshot.json");
const snapshotScript = path.join(rootDir, "scripts", "build-snapshot.mjs");
const host = "127.0.0.1";
const port = Number(process.env.PROJECT_ATLAS_PORT || 4174);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, `${JSON.stringify(payload)}\n`, "application/json; charset=utf-8");
}

function refreshSnapshot() {
  execFileSync(process.execPath, [snapshotScript], {
    cwd: rootDir,
    stdio: "ignore",
  });
}

function loadSnapshotData() {
  if (!fs.existsSync(snapshotPath)) {
    refreshSnapshot();
  }
  return JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
}

function normalizeOpenTarget(target) {
  if (typeof target !== "string" || !target) {
    throw new Error("target is required");
  }

  if (target.startsWith("/home/goringich/")) {
    return `file://${target}`;
  }

  if (/^(https?:\/\/|file:\/\/|vscode:\/\/)/.test(target)) {
    return target;
  }

  throw new Error("target is not allowed");
}

function openTarget(target) {
  const normalized = normalizeOpenTarget(target);
  const child = spawn("xdg-open", [normalized], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return normalized;
}

function serveFile(res, absolutePath) {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    send(res, 404, "not found\n");
    return;
  }

  const ext = path.extname(absolutePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";
  send(res, 200, fs.readFileSync(absolutePath), contentType);
}

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  throw new Error("dist/index.html is missing. Run `npm run build` before starting atlas-host.");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, host, port });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/local-codex-lab") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.localCodexLab ?? null });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/goal-capsules") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.localCodexLab?.goalCapsules ?? [] });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/token-efficiency") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, {
        ok: true,
        data: {
          tokenEfficiency: snapshot.localCodexLab?.tokenEfficiency ?? null,
          retrievalPolicy: snapshot.localCodexLab?.retrievalPolicy ?? null,
          runSummaries: snapshot.localCodexLab?.runSummaries ?? [],
        },
      });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/openclaw-reliability") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.localCodexLab?.openclawReliability ?? null });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const target = openTarget(payload.target);
        sendJson(res, 200, { ok: true, target });
      } catch (error) {
        send(res, 400, `${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/remote/state") {
    try {
      sendJson(res, 200, { ok: true, state: getRemoteState() });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/remote/action") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const action = typeof payload.action === "string" ? payload.action.trim() : "";
        if (!action) {
          throw new Error("action is required");
        }
        sendJson(res, 200, runRemoteAction(action));
      } catch (error) {
        send(res, 400, `${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/snapshot.json") {
    try {
      refreshSnapshot();
    } catch (error) {
      if (!fs.existsSync(snapshotPath)) {
        send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
        return;
      }
    }
    serveFile(res, snapshotPath);
    return;
  }

  if (req.method !== "GET") {
    send(res, 405, "method not allowed\n");
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const candidatePath = path.normalize(path.join(distDir, requestPath));
  if (!candidatePath.startsWith(distDir)) {
    send(res, 403, "forbidden\n");
    return;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    serveFile(res, candidatePath);
    return;
  }

  serveFile(res, path.join(distDir, "index.html"));
});

server.listen(port, host, () => {
  console.log(`Project Atlas host listening on http://${host}:${port}`);
});
