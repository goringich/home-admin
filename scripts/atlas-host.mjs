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

const SAFE_OPEN_PREFIXES = ["/home/goringich/", "/usr/share/applications/", "/usr/bin/"];
const CODEX_TASK_KEYWORDS = [
  "atlas",
  "codex",
  "token",
  "budget",
  "route",
  "routing",
  "agent",
  "sandbox",
  "build",
  "typecheck",
  "export",
  "payload",
  "ui",
  "react",
  "typescript",
  "script",
  "fix",
  "verify",
  "test",
];
const SCIENTIFIC_LAB_KEYWORDS = {
  "protein-lab": ["protein", "pdb", "alphafold", "mol", "chimera", "structure"],
  "space-lab": ["space", "nasa", "planet", "orbit", "solar", "star"],
  "physics-lab": ["physics", "paraview", "vtk", "simulation", "dataset", "field"],
  "blender-lab": ["blender", "render", "scene", "mesh", "model", "glb", "blend", "animation"],
  "robotics-lab": ["robot", "robotics", "ros", "isaac", "omniverse", "urdf"],
  "visualization-lab": ["visualization", "viewer", "inspect", "scene", "glb"],
};

function normalizeOpenTarget(target) {
  if (typeof target !== "string" || !target) {
    throw new Error("target is required");
  }

  if (SAFE_OPEN_PREFIXES.some((prefix) => target.startsWith(prefix))) {
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

function normalizeTaskText(taskText) {
  return String(taskText || "")
    .toLowerCase()
    .replace(/[^a-z0-9+/._ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readRoutingConfig(lab) {
  const sourcePath = lab?.agentRouting?.source_path || lab?.agentRouting?.sourcePath || "";
  if (sourcePath && fs.existsSync(sourcePath)) {
    try {
      return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    } catch {
      return lab?.agentRouting || {};
    }
  }
  return lab?.agentRouting || {};
}

function scoreRoute(taskText, route) {
  const keywords = route?.match?.keywords_any || [];
  return keywords.reduce((score, keyword) => (taskText.includes(String(keyword).toLowerCase()) ? score + 1 : score), 0);
}

function findAiLabRoute(taskText, routing, fallbackLab) {
  const routes = routing.routes || [];
  const defaultRouteId = routing.default_route || routing.defaultRoute || fallbackLab?.aiLab?.control?.selectedAgentRoute?.routeId || "";
  let bestRoute = routes.find((entry) => entry.id === defaultRouteId) || routes[0] || null;
  let bestScore = -1;

  for (const route of routes) {
    const score = scoreRoute(taskText, route);
    if (score > bestScore) {
      bestRoute = route;
      bestScore = score;
    }
  }

  return bestRoute;
}

function findAgentRecord(agentId, routing) {
  const agents = routing?.agents || [];
  return agents.find((entry) => entry.id === agentId) || null;
}

function localCloudDecision(agentId, lab, routing) {
  const controlDecision = lab?.aiLab?.control?.selectedAgentRoute?.localCloudDecision;
  if (controlDecision && lab?.aiLab?.control?.selectedAgentRoute?.selectedAgent === agentId) {
    return controlDecision;
  }

  const agent = findAgentRecord(agentId, routing);
  if (!agent) {
    return {
      mode: "hybrid",
      reason: "Route metadata is incomplete, so the decision remains hybrid by default.",
    };
  }
  if (["local-runtime", "local-ollama", "local-cli"].includes(agent.kind)) {
    return {
      mode: "local-first",
      reason: `${agent.label || agent.id} is an installed local execution path.`,
    };
  }
  if (agent.kind === "cloud-cli") {
    return {
      mode: "cloud-assisted",
      reason: `${agent.label || agent.id} is a cloud CLI route.`,
    };
  }
  return {
    mode: "hybrid",
    reason: `${agent.label || agent.id} can participate in hybrid routing.`,
  };
}

function findScientificLab(taskText, aiLab) {
  const labs = aiLab?.groups?.scientificVisualLab || [];
  let bestLab = null;
  let bestScore = 0;

  for (const lab of labs) {
    const keywords = SCIENTIFIC_LAB_KEYWORDS[lab.id] || [];
    const score = keywords.reduce((total, keyword) => (taskText.includes(keyword) ? total + 1 : total), 0);
    if (score > bestScore) {
      bestLab = lab;
      bestScore = score;
    }
  }

  if (bestScore > 0) {
    return bestLab;
  }

  if (taskText.includes("science") || taskText.includes("visual") || taskText.includes("viewer")) {
    return labs.find((entry) => entry.status !== "missing") || labs[0] || null;
  }

  return null;
}

function findScientificAction(taskText, lab) {
  if (!lab) {
    return null;
  }
  const actions = lab.actions || [];
  const matched = actions.find((entry) => taskText.includes(entry.label.toLowerCase()));
  return matched || actions.find((entry) => entry.status !== "missing") || actions[0] || null;
}

function buildFocusFiles(taskText, route, scientificAction) {
  const files = new Set();
  const atlasUiKeywords = ["atlas", "ui", "layout", "responsive", "panel", "render", "react", "tsx"];
  const controlKeywords = ["token", "budget", "routing", "route", "agent", "sandbox", "export", "payload"];

  files.add("/home/goringich/__home_organized/local-codex-stack/scripts/refresh_local_codex_stack.py");

  if (atlasUiKeywords.some((keyword) => taskText.includes(keyword))) {
    files.add("/home/goringich/Desktop/project-atlas/src/App.tsx");
    files.add("/home/goringich/Desktop/project-atlas/scripts/build-snapshot.mjs");
    files.add("/home/goringich/Desktop/project-atlas/scripts/atlas-host.mjs");
  }

  if (controlKeywords.some((keyword) => taskText.includes(keyword)) || route?.id) {
    files.add("/home/goringich/__home_organized/local-codex-stack/configs/agent-routing.json");
    files.add("/home/goringich/__home_organized/runtime/local-codex-stack/context-budgets.json");
    files.add("/home/goringich/__home_organized/runtime/local-codex-stack/retrieval-policy.json");
    files.add("/home/goringich/__home_organized/runtime/local-codex-stack/run-summaries.jsonl");
  }

  if (scientificAction?.target && scientificAction.target.startsWith("/")) {
    files.add(scientificAction.target);
  }

  return [...files].filter(Boolean).slice(0, 6);
}

function buildAiLabPrepare(snapshot, task) {
  const lab = snapshot?.localCodexLab || {};
  const aiLab = lab.aiLab || {};
  const normalizedTask = normalizeTaskText(task);
  const routing = readRoutingConfig(lab);
  const route = findAiLabRoute(normalizedTask, routing, lab);
  const selectedAgent =
    (route?.preferred_agents && route.preferred_agents[0]) ||
    aiLab?.control?.selectedAgentRoute?.selectedAgent ||
    "";
  const scientificLab = findScientificLab(normalizedTask, aiLab);
  const scientificAction = findScientificAction(normalizedTask, scientificLab);
  const decision = localCloudDecision(selectedAgent, lab, routing);
  const verificationCommands = (route?.allowed_verification_commands || []).map((entry) =>
    Array.isArray(entry) ? entry.join(" ") : String(entry),
  );
  const focusFiles = buildFocusFiles(normalizedTask, route, scientificAction);
  const codexNecessary =
    selectedAgent === "codex" ||
    CODEX_TASK_KEYWORDS.some((keyword) => normalizedTask.includes(keyword)) ||
    (route?.preferred_agents || []).includes("codex");

  return {
    task: String(task || "").trim(),
    proposedBudget: route?.context_budget || aiLab?.control?.tokenBudgetTier || "small",
    routeId: route?.id || aiLab?.control?.selectedAgentRoute?.routeId || "default",
    routeLabel: route?.label || aiLab?.control?.selectedAgentRoute?.routeLabel || "Default route",
    selectedAgent: selectedAgent || "manual-review",
    localCloudDecision: decision,
    sandboxStatus: {
      backend: aiLab?.control?.sandboxStatus?.backend || "copytree",
      mode: route?.sandbox_mode || aiLab?.control?.sandboxStatus?.mode || "generated-files",
      permissionTier: route?.permission_tier || aiLab?.control?.sandboxStatus?.permissionTier || "generated-files",
    },
    retrievalSources: aiLab?.control?.retrievalSources || [],
    excludedSources: aiLab?.control?.excludedSources || [],
    focusFiles,
    scientificToolTarget: scientificLab && scientificAction
      ? {
          labId: scientificLab.id,
          label: scientificAction.label,
          launcherId: scientificAction.launcherId,
          target: scientificAction.target,
          reason: `${scientificLab.label} matched the task keywords and has an allowlisted open target.`,
        }
      : null,
    verificationCommands,
    codexNecessary,
    codexReason: codexNecessary
      ? "The task touches code, Atlas control-plane surfaces, or a route that already prefers Codex."
      : "The task currently maps to read-only preparation or a local scientific-viewer flow.",
    nextBestAction: aiLab?.control?.nextBestAction || lab?.nextBestAction || "",
  };
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

  if (req.method === "GET" && url.pathname === "/api/ai-lab") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.localCodexLab?.aiLab ?? null });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ai-lab/tool-inventory") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.localCodexLab?.aiLab?.scientificTools ?? null });
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

  if (req.method === "GET" && url.pathname === "/api/commercial-readiness") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.commercialReadiness ?? null });
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

  if (req.method === "POST" && url.pathname === "/api/ai-lab/prepare") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const task = typeof payload.task === "string" ? payload.task.trim() : "";
        if (!task) {
          throw new Error("task is required");
        }
        const snapshot = loadSnapshotData();
        sendJson(res, 200, { ok: true, data: buildAiLabPrepare(snapshot, task) });
      } catch (error) {
        send(res, 400, `${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ai-lab/launch") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const launcherId = typeof payload.launcherId === "string" ? payload.launcherId.trim() : "";
        if (!launcherId) {
          throw new Error("launcherId is required");
        }
        const snapshot = loadSnapshotData();
        const launchers = snapshot.localCodexLab?.aiLab?.scientificTools?.launchers || [];
        const launcher = launchers.find((entry) => entry.id === launcherId);
        if (!launcher || launcher.status === "missing" || !launcher.target) {
          throw new Error("launcher is not available");
        }
        const target = openTarget(launcher.target);
        sendJson(res, 200, { ok: true, launcherId, target });
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
