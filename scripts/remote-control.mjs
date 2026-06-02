import fs from "node:fs";
import os from "node:os";
import process from "node:process";
import { execFileSync, spawn, spawnSync } from "node:child_process";

const userInfo = os.userInfo();
const runtimeDir = `/run/user/${userInfo.uid}`;
const defaultWaylandDisplay = "wayland-1";
const defaultVncHost = "127.0.0.1";
const defaultVncPort = 5900;
const devBridgeUnit = "dev-control-ssh-tunnel.service";
const devApiUnit = "dev-control-api.service";
const atlasUnit = "project-atlas.service";

function capture(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      ...options,
    }).trim();
  } catch {
    return "";
  }
}

function captureJson(command, args) {
  const raw = capture(command, args);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function captureStatus(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function parseGlobalIpv4() {
  const raw = capture("ip", ["-4", "-o", "addr", "show", "scope", "global"]);
  const records = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^\d+:\s+(\S+)\s+inet\s+(\d+\.\d+\.\d+\.\d+)\/\d+/);
    if (match) {
      records[match[1]] = match[2];
    }
  }
  return records;
}

function parseServiceState(unit) {
  const result = captureStatus("systemctl", ["--user", "is-active", unit]);
  return result.stdout || (result.ok ? "active" : "unknown");
}

function parseWayvncState() {
  const result = captureStatus("pgrep", ["-af", "wayvnc"]);
  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      active: false,
      process: "",
      listen: `${defaultVncHost}:${defaultVncPort}`,
    };
  }

  return {
    active: true,
    process: lines[0],
    listen: `${defaultVncHost}:${defaultVncPort}`,
  };
}

function parseWakeMode(iface) {
  const raw = capture("ethtool", [iface]);
  const match = raw.match(/Wake-on:\s+([a-zA-Z]+)/);
  return match?.[1] || "";
}

function parseMonitorState() {
  const monitors = captureJson("hyprctl", ["monitors", "-j"]);
  if (!Array.isArray(monitors) || monitors.length === 0) {
    return null;
  }

  const monitor = monitors.find((item) => item?.focused) || monitors[0];
  const refresh = Number(monitor.refreshRate || monitor.refresh || 60);
  const availableModes = Array.isArray(monitor.availableModes) ? monitor.availableModes : [];
  const modeLabel = `${monitor.width}x${monitor.height}@${refresh.toFixed(2)}`;
  const nativeMode = availableModes.find((item) => item.startsWith("3440x1440@")) || availableModes[0] || modeLabel;
  const remoteSafeMode =
    availableModes.find((item) => item.startsWith("1920x1080@59.94")) ||
    availableModes.find((item) => item.startsWith("1920x1080@60.00")) ||
    availableModes.find((item) => item.startsWith("2560x1440@59.95")) ||
    availableModes.find((item) => item.startsWith("2560x1440@")) ||
    nativeMode;

  return {
    name: String(monitor.name || ""),
    width: Number(monitor.width || 0),
    height: Number(monitor.height || 0),
    x: Number(monitor.x || 0),
    y: Number(monitor.y || 0),
    scale: Number(monitor.scale || 1),
    refreshRate: refresh,
    modeLabel,
    nativeMode,
    remoteSafeMode,
    remoteSafeActive: String(remoteSafeMode).startsWith(`${monitor.width}x${monitor.height}@`) && Number(monitor.scale || 1) === 1
      ? /^(1920x1080|2560x1440)@/.test(remoteSafeMode)
      : monitor.width <= 2560 && Number(monitor.scale || 1) === 1,
  };
}

function normalizeMode(mode) {
  return String(mode).replace(/Hz$/, "");
}

function runMonitorAction(targetMode) {
  const monitor = parseMonitorState();
  if (!monitor) {
    throw new Error("monitor state unavailable");
  }

  execFileSync("hyprctl", [
    "keyword",
    "monitor",
    `${monitor.name},${normalizeMode(targetMode)},${monitor.x}x${monitor.y},1.00`,
  ], {
    stdio: "ignore",
  });

  return parseMonitorState();
}

function startWayvnc() {
  const current = parseWayvncState();
  if (current.active) {
    return current;
  }

  const env = {
    ...process.env,
    XDG_RUNTIME_DIR: runtimeDir,
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || defaultWaylandDisplay,
  };

  const child = spawn("wayvnc", [defaultVncHost, String(defaultVncPort)], {
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();

  return parseWayvncState();
}

function stopWayvnc() {
  captureStatus("pkill", ["-x", "wayvnc"]);
  return parseWayvncState();
}

function restartUserUnit(unit) {
  const result = captureStatus("systemctl", ["--user", "restart", unit]);
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `failed to restart ${unit}`);
  }
  return parseServiceState(unit);
}

export function getRemoteState() {
  const ipv4 = parseGlobalIpv4();
  const monitor = parseMonitorState();
  const iface = "enp7s0";
  const lanIp = ipv4[iface] || "";
  const tailscaleIp = ipv4.tailscale0 || "";
  const yadroIp = ipv4.yadro || "";
  const wolMac = fs.existsSync(`/sys/class/net/${iface}/address`)
    ? fs.readFileSync(`/sys/class/net/${iface}/address`, "utf8").trim().toUpperCase()
    : "";
  const wakeupState = fs.existsSync(`/sys/class/net/${iface}/device/power/wakeup`)
    ? fs.readFileSync(`/sys/class/net/${iface}/device/power/wakeup`, "utf8").trim()
    : "";
  const wakeMode = parseWakeMode(iface);
  const wayvnc = parseWayvncState();

  return {
    generatedAt: new Date().toISOString(),
    access: {
      atlasTunnel: `ssh -N -L 4174:127.0.0.1:4174 goringich@${tailscaleIp || lanIp || "HOST"}`,
      sshLan: lanIp ? `ssh goringich@${lanIp}` : "",
      sshTailscale: tailscaleIp ? `ssh goringich@${tailscaleIp}` : "",
      vncTunnel: `ssh -N -L 5900:127.0.0.1:${defaultVncPort} goringich@${tailscaleIp || lanIp || "HOST"}`,
      wol: wolMac ? `wakeonlan ${wolMac}` : "",
      lanIp,
      tailscaleIp,
      yadroIp,
      wolMac,
    },
    monitor: monitor
      ? {
          ...monitor,
          nativeMode: normalizeMode(monitor.nativeMode),
          remoteSafeMode: normalizeMode(monitor.remoteSafeMode),
        }
      : null,
    services: {
      atlas: parseServiceState(atlasUnit),
      devApi: parseServiceState(devApiUnit),
      devTunnel: parseServiceState(devBridgeUnit),
      wayvnc: wayvnc.active ? "active" : "inactive",
    },
    wayvnc,
    wakeOnLan: {
      interface: iface,
      wakeMode,
      wakeupState,
    },
    notes: [
      "Atlas host stays on 127.0.0.1; use the SSH tunnel above over Tailscale for secure remote UI access.",
      "Remote-safe mode switches the ultrawide desktop to a laptop-friendly mode for remote sessions and can be restored with one click.",
      "wayvnc stays localhost-only and is intended as a fallback when the web control plane is not enough.",
    ],
  };
}

export function runRemoteAction(action) {
  switch (action) {
    case "remote_safe_on": {
      const monitor = parseMonitorState();
      if (!monitor) throw new Error("monitor state unavailable");
      return {
        ok: true,
        message: `Monitor switched to ${normalizeMode(monitor.remoteSafeMode)}`,
        state: getRemoteState(),
        monitor: runMonitorAction(monitor.remoteSafeMode),
      };
    }
    case "remote_safe_off": {
      const monitor = parseMonitorState();
      if (!monitor) throw new Error("monitor state unavailable");
      return {
        ok: true,
        message: `Monitor restored to ${normalizeMode(monitor.nativeMode)}`,
        state: getRemoteState(),
        monitor: runMonitorAction(monitor.nativeMode),
      };
    }
    case "wayvnc_start":
      startWayvnc();
      return {
        ok: true,
        message: "wayvnc started on 127.0.0.1:5900",
        state: getRemoteState(),
      };
    case "wayvnc_stop":
      stopWayvnc();
      return {
        ok: true,
        message: "wayvnc stopped",
        state: getRemoteState(),
      };
    case "dev_bridge_restart": {
      const state = restartUserUnit(devBridgeUnit);
      return {
        ok: true,
        message: `dev bridge restart requested, unit state: ${state}`,
        state: getRemoteState(),
      };
    }
    default:
      throw new Error(`unknown remote action: ${action}`);
  }
}
