import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  FleetStore,
  prepareDeviceDevTask,
  verifySignature,
} from "./device-fleet-store.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const host = "127.0.0.1";
const port = Number(process.env.PROJECT_ATLAS_PORT || 4174);
const legacyPort = Number(process.env.PROJECT_ATLAS_LEGACY_PORT || port + 1);
const fleetDir = process.env.PROJECT_ATLAS_FLEET_DIR || path.join(os.homedir(), ".local", "share", "project-atlas", "device-fleet");
const enrollmentToken = process.env.PROJECT_ATLAS_ENROLLMENT_TOKEN || "";
const fleetStore = new FleetStore({ rootDir: fleetDir });
const replayCache = new Map();
const allowedOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
]);
const maximumBodyBytes = 3 * 1024 * 1024;

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, securityHeaders());
  res.end(`${JSON.stringify(payload)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maximumBodyBytes) {
        const error = new Error("request_too_large");
        error.statusCode = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("invalid_json");
    error.statusCode = 400;
    throw error;
  }
}

function requestUrl(req) {
  return new URL(req.url || "/", `http://${host}:${port}`);
}

function isLoopback(address = "") {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function requireUiMutation(req) {
  if (!isLoopback(req.socket.remoteAddress || "")) {
    const error = new Error("loopback_only");
    error.statusCode = 403;
    throw error;
  }
  const origin = String(req.headers.origin || "");
  if (origin && !allowedOrigins.has(origin)) {
    const error = new Error("origin_not_allowed");
    error.statusCode = 403;
    throw error;
  }
}

function cleanupReplayCache(nowMs = Date.now()) {
  for (const [key, expiresAt] of replayCache.entries()) {
    if (expiresAt <= nowMs) replayCache.delete(key);
  }
}

function requireSignedDeviceRequest(req, rawBody, url) {
  cleanupReplayCache();
  const deviceId = String(req.headers["x-atlas-device-id"] || "");
  const timestamp = String(req.headers["x-atlas-timestamp"] || "");
  const nonce = String(req.headers["x-atlas-nonce"] || "");
  const signature = String(req.headers["x-atlas-signature"] || "");
  const secret = fleetStore.getSecret(deviceId);
  if (!secret) {
    const error = new Error("unknown_device");
    error.statusCode = 401;
    throw error;
  }
  const replayKey = `${deviceId}:${nonce}`;
  if (replayCache.has(replayKey)) {
    const error = new Error("replayed_request");
    error.statusCode = 409;
    throw error;
  }
  const verification = verifySignature({
    secret,
    method: req.method || "GET",
    pathWithQuery: `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    body: rawBody,
    signature,
  });
  if (!verification.ok) {
    const error = new Error(verification.reason);
    error.statusCode = 401;
    throw error;
  }
  replayCache.set(replayKey, Date.now() + 5 * 60_000);
  return deviceId;
}

function handleError(res, error) {
  sendJson(res, Number(error?.statusCode) || 400, {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

function proxyToLegacy(req, res) {
  const headers = { ...req.headers, host: `${host}:${legacyPort}` };
  const proxyRequest = http.request({
    host,
    port: legacyPort,
    method: req.method,
    path: req.url,
    headers,
  }, (proxyResponse) => {
    res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(res);
  });
  proxyRequest.on("error", () => {
    sendJson(res, 503, { ok: false, error: "legacy_atlas_unavailable" });
  });
  req.pipe(proxyRequest);
}

function serveArtifact(res, deviceId, filename) {
  const targetPath = fleetStore.resolveArtifact(deviceId, filename);
  if (!targetPath) {
    sendJson(res, 404, { ok: false, error: "artifact_not_found" });
    return;
  }
  const extension = path.extname(targetPath).toLowerCase();
  const contentType = extension === ".png" ? "image/png" : "image/jpeg";
  res.writeHead(200, {
    ...securityHeaders(contentType),
    "Content-Length": fs.statSync(targetPath).size,
  });
  fs.createReadStream(targetPath).pipe(res);
}

async function handleFleetRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/fleet/state") {
    sendJson(res, 200, {
      ok: true,
      data: {
        ...fleetStore.state(),
        enrollmentEnabled: Boolean(enrollmentToken),
        security: {
          transport: "loopback_or_ssh_tunnel",
          deviceAuthentication: "hmac_sha256",
          arbitraryShell: false,
        },
      },
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/fleet/enroll") {
    if (!enrollmentToken) {
      sendJson(res, 503, { ok: false, error: "enrollment_disabled_set_PROJECT_ATLAS_ENROLLMENT_TOKEN" });
      return true;
    }
    if (String(req.headers["x-atlas-enrollment-token"] || "") !== enrollmentToken) {
      sendJson(res, 401, { ok: false, error: "invalid_enrollment_token" });
      return true;
    }
    const rawBody = await readBody(req);
    const result = fleetStore.enroll(parseBody(rawBody));
    sendJson(res, 201, {
      ok: true,
      data: {
        device: result.device,
        secret: result.secret,
        heartbeatIntervalSeconds: 30,
        commandPollIntervalSeconds: 10,
      },
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/fleet/heartbeat") {
    const rawBody = await readBody(req);
    const deviceId = requireSignedDeviceRequest(req, rawBody, url);
    const device = fleetStore.recordHeartbeat(deviceId, parseBody(rawBody));
    sendJson(res, 200, { ok: true, data: device });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/fleet/commands") {
    const deviceId = requireSignedDeviceRequest(req, "", url);
    const requestedDeviceId = url.searchParams.get("deviceId") || "";
    if (requestedDeviceId !== deviceId) {
      sendJson(res, 403, { ok: false, error: "device_scope_mismatch" });
      return true;
    }
    sendJson(res, 200, { ok: true, data: fleetStore.pollCommands(deviceId) });
    return true;
  }

  const ackMatch = url.pathname.match(/^\/api\/fleet\/commands\/([^/]+)\/ack$/);
  if (req.method === "POST" && ackMatch) {
    const rawBody = await readBody(req);
    const deviceId = requireSignedDeviceRequest(req, rawBody, url);
    const command = fleetStore.acknowledgeCommand(deviceId, decodeURIComponent(ackMatch[1]), parseBody(rawBody));
    sendJson(res, 200, { ok: true, data: command });
    return true;
  }

  const commandMatch = url.pathname.match(/^\/api\/fleet\/devices\/([^/]+)\/commands$/);
  if (req.method === "POST" && commandMatch) {
    requireUiMutation(req);
    const rawBody = await readBody(req);
    const command = fleetStore.enqueueCommand(decodeURIComponent(commandMatch[1]), parseBody(rawBody));
    sendJson(res, 202, { ok: true, data: command });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/fleet/dev/prepare") {
    requireUiMutation(req);
    const rawBody = await readBody(req);
    const payload = parseBody(rawBody);
    const device = fleetStore.state().devices.find((entry) => entry.id === payload.deviceId);
    const prepared = prepareDeviceDevTask({ device, task: payload.task });
    sendJson(res, 200, { ok: true, data: prepared });
    return true;
  }

  const artifactMatch = url.pathname.match(/^\/api\/fleet\/artifacts\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && artifactMatch) {
    serveArtifact(res, decodeURIComponent(artifactMatch[1]), decodeURIComponent(artifactMatch[2]));
    return true;
  }

  if (url.pathname.startsWith("/api/fleet/")) {
    sendJson(res, 404, { ok: false, error: "fleet_route_not_found" });
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = requestUrl(req);
  try {
    if (await handleFleetRequest(req, res, url)) return;
    proxyToLegacy(req, res);
  } catch (error) {
    handleError(res, error);
  }
});

const legacyChild = spawn(process.execPath, [path.join(rootDir, "scripts", "atlas-host.mjs")], {
  cwd: rootDir,
  env: {
    ...process.env,
    PROJECT_ATLAS_PORT: String(legacyPort),
  },
  stdio: ["ignore", "inherit", "inherit"],
});

legacyChild.on("exit", (code, signal) => {
  if (!server.listening) return;
  console.error(`Legacy Atlas host exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
});

function shutdown(signal) {
  server.close(() => process.exit(0));
  if (!legacyChild.killed) legacyChild.kill(signal);
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(port, host, () => {
  console.log(`Project Atlas fleet gateway listening on http://${host}:${port}`);
  console.log(`Legacy Atlas host proxied from http://${host}:${legacyPort}`);
});
