import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ONLINE_AFTER_MS = 90_000;
const STALE_AFTER_MS = 10 * 60_000;
const COMMAND_TTL_MS = 15 * 60_000;
const MAX_EVENTS = 2_000;
const MAX_COMMANDS = 1_000;

export const SAFE_COMMANDS = new Set([
  "refresh_telemetry",
  "run_health_check",
  "lock_screen",
  "restart_agent",
  "camera_snapshot",
  "open_rustdesk",
  "open_sunshine",
  "restart_pc",
  "shutdown_pc",
]);

export const DANGEROUS_COMMANDS = new Set(["restart_pc", "shutdown_pc"]);

function asString(value, limit = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit);
}

function asStringList(value, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => asString(item, 80)).filter(Boolean))].slice(0, limit);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, asNumber(value)));
}

function slug(value) {
  return asString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "windows-device";
}

function parseJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode });
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, mode);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function statusFor(device, nowMs) {
  if (!device.lastSeenAt) return "enrolling";
  const age = nowMs - Date.parse(device.lastSeenAt);
  if (!Number.isFinite(age)) return "unknown";
  if (age <= ONLINE_AFTER_MS) return "online";
  if (age <= STALE_AFTER_MS) return "stale";
  return "offline";
}

function healthFor(device, nowMs) {
  const status = statusFor(device, nowMs);
  if (status === "offline" || status === "unknown") return "risk";
  if (status === "stale" || status === "enrolling") return "attention";
  const telemetry = device.telemetry || {};
  const cpu = asNumber(telemetry.system?.cpuPercent);
  const memory = asNumber(telemetry.system?.memoryPercent);
  const hottestGpu = Math.max(0, ...(telemetry.gpus || []).map((gpu) => asNumber(gpu.temperatureC)));
  const diskRisk = (telemetry.disks || []).some((disk) => asNumber(disk.freePercent, 100) < 10);
  if (cpu >= 95 || memory >= 95 || hottestGpu >= 92 || diskRisk || telemetry.system?.rebootPending) return "risk";
  if (cpu >= 80 || memory >= 85 || hottestGpu >= 82) return "attention";
  return "ok";
}

function sanitizeTelemetry(input = {}) {
  const system = input.system || {};
  const remote = input.remote || {};
  return {
    collectedAt: asString(input.collectedAt, 64) || new Date().toISOString(),
    system: {
      cpuPercent: clamp(system.cpuPercent, 0, 100),
      memoryPercent: clamp(system.memoryPercent, 0, 100),
      memoryUsedGb: Math.max(0, asNumber(system.memoryUsedGb)),
      memoryTotalGb: Math.max(0, asNumber(system.memoryTotalGb)),
      uptimeSeconds: Math.max(0, Math.round(asNumber(system.uptimeSeconds))),
      rebootPending: Boolean(system.rebootPending),
      powerSource: asString(system.powerSource, 40),
    },
    os: {
      caption: asString(input.os?.caption, 160),
      version: asString(input.os?.version, 80),
      build: asString(input.os?.build, 80),
      architecture: asString(input.os?.architecture, 40),
    },
    disks: Array.isArray(input.disks) ? input.disks.slice(0, 32).map((disk) => ({
      name: asString(disk.name, 80),
      label: asString(disk.label, 80),
      sizeGb: Math.max(0, asNumber(disk.sizeGb)),
      freeGb: Math.max(0, asNumber(disk.freeGb)),
      freePercent: clamp(disk.freePercent, 0, 100),
    })) : [],
    gpus: Array.isArray(input.gpus) ? input.gpus.slice(0, 16).map((gpu) => ({
      name: asString(gpu.name, 160),
      utilizationPercent: clamp(gpu.utilizationPercent, 0, 100),
      memoryUsedMb: Math.max(0, asNumber(gpu.memoryUsedMb)),
      memoryTotalMb: Math.max(0, asNumber(gpu.memoryTotalMb)),
      temperatureC: Math.max(0, asNumber(gpu.temperatureC)),
      source: asString(gpu.source, 40),
    })) : [],
    network: {
      ipv4: asStringList(input.network?.ipv4, 32),
      tailscaleIp: asString(input.network?.tailscaleIp, 64),
      defaultGateway: asString(input.network?.defaultGateway, 64),
    },
    cameras: Array.isArray(input.cameras) ? input.cameras.slice(0, 24).map((camera) => ({
      id: asString(camera.id, 180),
      name: asString(camera.name, 180),
      status: asString(camera.status, 40) || "unknown",
      ffmpegName: asString(camera.ffmpegName, 180),
    })) : [],
    processes: Array.isArray(input.processes) ? input.processes.slice(0, 20).map((processEntry) => ({
      name: asString(processEntry.name, 120),
      pid: Math.max(0, Math.round(asNumber(processEntry.pid))),
      cpuSeconds: Math.max(0, asNumber(processEntry.cpuSeconds)),
      workingSetMb: Math.max(0, asNumber(processEntry.workingSetMb)),
    })) : [],
    remote: {
      rustdeskInstalled: Boolean(remote.rustdeskInstalled),
      rustdeskRunning: Boolean(remote.rustdeskRunning),
      rustdeskId: asString(remote.rustdeskId, 120),
      sunshineInstalled: Boolean(remote.sunshineInstalled),
      sunshineRunning: Boolean(remote.sunshineRunning),
      rdpEnabled: Boolean(remote.rdpEnabled),
      tailscaleConnected: Boolean(remote.tailscaleConnected),
    },
    agent: {
      version: asString(input.agent?.version, 80),
      serviceState: asString(input.agent?.serviceState, 80),
      lastError: asString(input.agent?.lastError, 500),
    },
  };
}

export function buildSignature({ secret, method, pathWithQuery, timestamp, nonce, body = "" }) {
  const canonical = [
    String(method).toUpperCase(),
    pathWithQuery,
    String(timestamp),
    nonce,
    sha256Hex(body),
  ].join("\n");
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}

export function verifySignature({ secret, method, pathWithQuery, timestamp, nonce, body = "", signature, nowMs = Date.now() }) {
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp) || Math.abs(nowMs - parsedTimestamp) > 5 * 60_000) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }
  if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(String(nonce || ""))) {
    return { ok: false, reason: "invalid_nonce" };
  }
  if (!/^[a-f0-9]{64}$/i.test(String(signature || ""))) {
    return { ok: false, reason: "invalid_signature_format" };
  }
  const expected = buildSignature({ secret, method, pathWithQuery, timestamp, nonce, body });
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(String(signature), "hex");
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

export class FleetStore {
  constructor({ rootDir, now = () => Date.now(), randomBytes = crypto.randomBytes } = {}) {
    if (!rootDir) throw new Error("rootDir is required");
    this.rootDir = rootDir;
    this.now = now;
    this.randomBytes = randomBytes;
    this.registryPath = path.join(rootDir, "registry.json");
    this.secretsPath = path.join(rootDir, "secrets.json");
    this.commandsPath = path.join(rootDir, "commands.json");
    this.eventsPath = path.join(rootDir, "events.json");
    this.artifactsDir = path.join(rootDir, "artifacts");
    fs.mkdirSync(this.artifactsDir, { recursive: true, mode: 0o700 });
    this.registry = parseJsonFile(this.registryPath, { schemaVersion: 1, devices: [] });
    this.secrets = parseJsonFile(this.secretsPath, { schemaVersion: 1, devices: {} });
    this.commands = parseJsonFile(this.commandsPath, { schemaVersion: 1, commands: [] });
    this.events = parseJsonFile(this.eventsPath, { schemaVersion: 1, events: [] });
  }

  persist() {
    writeJsonAtomic(this.registryPath, this.registry);
    writeJsonAtomic(this.secretsPath, this.secrets);
    writeJsonAtomic(this.commandsPath, this.commands);
    writeJsonAtomic(this.eventsPath, this.events);
  }

  appendEvent(type, deviceId, detail = {}) {
    this.events.events.push({
      id: `evt_${this.randomBytes(8).toString("hex")}`,
      type: asString(type, 80),
      deviceId: asString(deviceId, 120),
      createdAt: new Date(this.now()).toISOString(),
      detail,
    });
    this.events.events = this.events.events.slice(-MAX_EVENTS);
  }

  enroll(input = {}) {
    const hostname = asString(input.hostname || input.name, 120) || "Windows PC";
    const requestedId = slug(input.deviceId || hostname);
    let deviceId = requestedId;
    if (this.registry.devices.some((device) => device.id === deviceId)) {
      deviceId = `${requestedId}-${this.randomBytes(3).toString("hex")}`;
    }
    const secret = this.randomBytes(32).toString("base64url");
    const nowIso = new Date(this.now()).toISOString();
    const device = {
      id: deviceId,
      name: asString(input.name || hostname, 120),
      hostname,
      platform: "windows",
      osVersion: asString(input.osVersion, 120),
      agentVersion: asString(input.agentVersion, 80),
      groups: asStringList(input.groups, 12),
      tags: asStringList(input.tags, 24),
      capabilities: asStringList(input.capabilities, 32),
      enrolledAt: nowIso,
      lastSeenAt: null,
      lastCommandAt: null,
      telemetry: null,
      lastArtifact: null,
    };
    this.registry.devices.push(device);
    this.secrets.devices[deviceId] = secret;
    this.appendEvent("device_enrolled", deviceId, { name: device.name, hostname: device.hostname });
    this.persist();
    return { device, secret };
  }

  getSecret(deviceId) {
    return this.secrets.devices[deviceId] || "";
  }

  getDevice(deviceId) {
    return this.registry.devices.find((device) => device.id === deviceId) || null;
  }

  recordHeartbeat(deviceId, payload = {}) {
    const device = this.getDevice(deviceId);
    if (!device) throw new Error("device_not_found");
    device.lastSeenAt = new Date(this.now()).toISOString();
    device.name = asString(payload.name || device.name, 120);
    device.hostname = asString(payload.hostname || device.hostname, 120);
    device.osVersion = asString(payload.osVersion || device.osVersion, 120);
    device.agentVersion = asString(payload.agentVersion || device.agentVersion, 80);
    device.capabilities = asStringList(payload.capabilities || device.capabilities, 32);
    device.telemetry = sanitizeTelemetry(payload.telemetry || {});
    if (payload.commandAckCount) {
      device.lastCommandAt = device.lastSeenAt;
    }
    this.appendEvent("heartbeat", deviceId, {
      cpuPercent: device.telemetry.system.cpuPercent,
      memoryPercent: device.telemetry.system.memoryPercent,
      cameraCount: device.telemetry.cameras.length,
    });
    this.persist();
    return this.publicDevice(device);
  }

  publicDevice(device) {
    const nowMs = this.now();
    const status = statusFor(device, nowMs);
    const health = healthFor(device, nowMs);
    const queuedCommands = this.commands.commands.filter((command) => command.deviceId === device.id && ["queued", "delivered"].includes(command.status)).length;
    return {
      ...device,
      status,
      health,
      queuedCommands,
      lastSeenAgeSeconds: device.lastSeenAt ? Math.max(0, Math.round((nowMs - Date.parse(device.lastSeenAt)) / 1000)) : null,
    };
  }

  state() {
    this.expireCommands();
    const devices = this.registry.devices.map((device) => this.publicDevice(device));
    const counts = {
      total: devices.length,
      online: devices.filter((device) => device.status === "online").length,
      attention: devices.filter((device) => device.health === "attention").length,
      risk: devices.filter((device) => device.health === "risk").length,
      offline: devices.filter((device) => device.status === "offline").length,
      queuedCommands: this.commands.commands.filter((command) => ["queued", "delivered"].includes(command.status)).length,
    };
    return {
      generatedAt: new Date(this.now()).toISOString(),
      counts,
      devices,
      recentCommands: this.commands.commands.slice(-100).reverse().map((command) => ({ ...command, payload: command.type === "camera_snapshot" ? command.payload : {} })),
      recentEvents: this.events.events.slice(-120).reverse(),
    };
  }

  enqueueCommand(deviceId, input = {}) {
    const device = this.getDevice(deviceId);
    if (!device) throw new Error("device_not_found");
    const type = asString(input.type, 80);
    if (!SAFE_COMMANDS.has(type)) throw new Error("command_not_allowed");
    if (DANGEROUS_COMMANDS.has(type) && asString(input.confirmDeviceName, 120) !== device.name) {
      throw new Error("device_name_confirmation_required");
    }
    const createdAtMs = this.now();
    const command = {
      id: `cmd_${this.randomBytes(10).toString("hex")}`,
      deviceId,
      type,
      payload: type === "camera_snapshot" ? {
        cameraName: asString(input.payload?.cameraName, 180),
      } : {},
      status: "queued",
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(createdAtMs + COMMAND_TTL_MS).toISOString(),
      deliveredAt: null,
      completedAt: null,
      result: null,
    };
    this.commands.commands.push(command);
    this.commands.commands = this.commands.commands.slice(-MAX_COMMANDS);
    this.appendEvent("command_queued", deviceId, { commandId: command.id, type });
    this.persist();
    return command;
  }

  expireCommands() {
    const nowMs = this.now();
    let changed = false;
    for (const command of this.commands.commands) {
      if (["queued", "delivered"].includes(command.status) && Date.parse(command.expiresAt) < nowMs) {
        command.status = "expired";
        command.completedAt = new Date(nowMs).toISOString();
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  pollCommands(deviceId, limit = 10) {
    if (!this.getDevice(deviceId)) throw new Error("device_not_found");
    this.expireCommands();
    const nowIso = new Date(this.now()).toISOString();
    const commands = this.commands.commands
      .filter((command) => command.deviceId === deviceId && command.status === "queued")
      .slice(0, Math.max(1, Math.min(20, Number(limit) || 10)));
    for (const command of commands) {
      command.status = "delivered";
      command.deliveredAt = nowIso;
      this.appendEvent("command_delivered", deviceId, { commandId: command.id, type: command.type });
    }
    if (commands.length) this.persist();
    return commands;
  }

  acknowledgeCommand(deviceId, commandId, input = {}) {
    const command = this.commands.commands.find((entry) => entry.id === commandId && entry.deviceId === deviceId);
    if (!command) throw new Error("command_not_found");
    const status = ["succeeded", "failed", "manual_required"].includes(input.status) ? input.status : "failed";
    command.status = status;
    command.completedAt = new Date(this.now()).toISOString();
    command.result = {
      message: asString(input.result?.message, 800),
      exitCode: input.result?.exitCode === undefined ? null : Math.round(asNumber(input.result.exitCode)),
      data: input.result?.data && typeof input.result.data === "object" ? input.result.data : null,
    };
    if (input.artifact) {
      const artifact = this.saveArtifact(deviceId, commandId, input.artifact);
      command.result.artifact = artifact;
      const device = this.getDevice(deviceId);
      if (device) device.lastArtifact = artifact;
    }
    this.appendEvent("command_completed", deviceId, { commandId, type: command.type, status });
    this.persist();
    return command;
  }

  saveArtifact(deviceId, commandId, input = {}) {
    const contentType = asString(input.contentType, 80);
    if (!new Set(["image/jpeg", "image/png"]).has(contentType)) throw new Error("artifact_type_not_allowed");
    const raw = Buffer.from(String(input.base64 || ""), "base64");
    if (!raw.length || raw.length > 2 * 1024 * 1024) throw new Error("artifact_size_invalid");
    const extension = contentType === "image/png" ? "png" : "jpg";
    const deviceDir = path.join(this.artifactsDir, slug(deviceId));
    fs.mkdirSync(deviceDir, { recursive: true, mode: 0o700 });
    const filename = `${slug(commandId)}-${this.now()}.${extension}`;
    const targetPath = path.join(deviceDir, filename);
    fs.writeFileSync(targetPath, raw, { mode: 0o600 });
    return {
      kind: asString(input.kind, 80) || "artifact",
      contentType,
      filename,
      url: `/api/fleet/artifacts/${encodeURIComponent(deviceId)}/${encodeURIComponent(filename)}`,
      size: raw.length,
      createdAt: new Date(this.now()).toISOString(),
    };
  }

  resolveArtifact(deviceId, filename) {
    const safeDeviceId = slug(deviceId);
    const safeFilename = path.basename(filename);
    const targetPath = path.join(this.artifactsDir, safeDeviceId, safeFilename);
    if (!targetPath.startsWith(path.join(this.artifactsDir, safeDeviceId)) || !fs.existsSync(targetPath)) return null;
    return targetPath;
  }
}

export function prepareDeviceDevTask({ device, task }) {
  const cleanedTask = asString(task, 4_000);
  if (!cleanedTask) throw new Error("task_required");
  if (!device) throw new Error("device_not_found");
  const telemetry = device.telemetry || {};
  const context = {
    deviceId: device.id,
    deviceName: device.name,
    hostname: device.hostname,
    status: device.status,
    health: device.health,
    os: telemetry.os || null,
    system: telemetry.system || null,
    gpus: telemetry.gpus || [],
    disks: telemetry.disks || [],
    network: telemetry.network || null,
    cameras: telemetry.cameras || [],
    remote: telemetry.remote || null,
    agent: telemetry.agent || null,
  };
  const prompt = [
    "Task",
    cleanedTask,
    "",
    "Context",
    `Target Windows device: ${device.name} (${device.id}, host ${device.hostname}).`,
    `Current device context: ${JSON.stringify(context)}`,
    "Use only evidence from this context and repository/runtime files you can actually read.",
    "",
    "Constraints",
    "Find and fix the root cause within the available scope. Preserve the existing architecture and security boundaries.",
    "Do not run destructive, irreversible, paid, external, or production actions without explicit confirmation.",
    "Do not invent remote access, camera, service, registry, file, or command results.",
    "Use the governed Windows fleet command catalog instead of arbitrary remote shell execution.",
    "",
    "Verification / Done",
    "Report the root cause, changes, affected files or device operations, checks run, results, assumptions, remaining risks, and real blockers.",
  ].join("\n");
  return { prompt, context };
}
