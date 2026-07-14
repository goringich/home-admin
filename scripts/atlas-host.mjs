import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getRemoteState, runRemoteAction } from "./remote-control.mjs";
import { normalizeCommercialSummary } from "./commercial-summary.mjs";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(rootDir, "dist");
const snapshotPath = path.join(rootDir, "public", "snapshot.json");
const snapshotScript = path.join(rootDir, "scripts", "build-snapshot.mjs");
const host = "127.0.0.1";
const port = Number(process.env.PROJECT_ATLAS_PORT || 4174);
const home = "/home/goringich";
const codexOrchestratorRoot = path.join(home, "codex-orchestrator");
const codexOrchestratorRuntime = path.join(home, "__home_organized", "runtime", "codex-orchestrator");
const codexOrchestratorArtifacts = path.join(home, "__home_organized", "artifacts", "codex-orchestrator");
const localCodexRuntime = path.join(home, "__home_organized", "runtime", "local-codex-stack");
const sharedRunReportsRoot = path.join(localCodexRuntime, "run-reports");
const codexEnqueueScript = path.join(codexOrchestratorRoot, "bin", "codex-agent-enqueue");
const codexRunReporterScript = path.join(codexOrchestratorRoot, "bin", "codex-agent-run-report");
const codexBridgeFixCommand = "cd /home/goringich/codex-orchestrator && ./install.sh";
const codexBridgeAllowedRoots = [
  path.join(home, "Desktop", "project-atlas"),
  path.join(home, "system-bootstrap"),
  path.join(home, "__home_organized"),
  path.join(home, "codex-orchestrator"),
  path.join(home, "Desktop", "Obsidian"),
];

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

function buildAiLabApiData(snapshot) {
  return {
    hostHealth: snapshot.localCodexLab?.hostHealth || "unknown",
    aiLab: snapshot.localCodexLab?.aiLab ?? null,
    knowledgeGraphStatus: snapshot.localCodexLab?.knowledgeGraphStatus ?? null,
    contextPackStatus: snapshot.localCodexLab?.contextPackStatus ?? null,
    ragE2eEvalStatus: snapshot.localCodexLab?.ragE2eEvalStatus ?? null,
    localModelRagEntrypointStatus: snapshot.localCodexLab?.localModelRagEntrypointStatus ?? null,
    codexContextEntrypointStatus: snapshot.localCodexLab?.codexContextEntrypointStatus ?? null,
    localGpuLiveBenchStatus: snapshot.localCodexLab?.localGpuLiveBenchStatus ?? null,
  };
}

function safeString(value, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function isAllowedBridgePath(targetPath) {
  const resolved = path.resolve(String(targetPath || ""));
  return codexBridgeAllowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function requireCodexBridge() {
  if (!fs.existsSync(codexEnqueueScript) || !fs.existsSync(codexRunReporterScript)) {
    throw new Error(`codex-orchestrator bridge unavailable; run: ${codexBridgeFixCommand}`);
  }
}

function listFiles(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  try {
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(targetPath, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function listDirs(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }
  try {
    return fs
      .readdirSync(targetPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(targetPath, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function parseTaskHeader(targetPath) {
  const header = {};
  try {
    const text = fs.readFileSync(targetPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === "---") {
        break;
      }
      if (!line.includes(":")) {
        continue;
      }
      const [key, ...rest] = line.split(":");
      header[key.trim()] = rest.join(":").trim();
    }
  } catch {
    return header;
  }
  return header;
}

function parseKeyValueFile(targetPath) {
  const result = {};
  try {
    const text = fs.readFileSync(targetPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line.includes("=")) {
        continue;
      }
      const [key, ...rest] = line.split("=");
      result[key.trim()] = rest.join("=").trim();
    }
  } catch {
    return result;
  }
  return result;
}

function codexQueueCounts() {
  return {
    queued: listFiles(path.join(codexOrchestratorRuntime, "queue")).length,
    running: listFiles(path.join(codexOrchestratorRuntime, "claims")).length,
    done: listFiles(path.join(codexOrchestratorRuntime, "done")).length,
    failed: listFiles(path.join(codexOrchestratorRuntime, "failed")).length,
  };
}

function codexQueueEntries(kind, limit = 12) {
  return listFiles(path.join(codexOrchestratorRuntime, kind))
    .slice(-limit)
    .reverse()
    .map((targetPath) => {
      const stats = fs.statSync(targetPath);
      const header = parseTaskHeader(targetPath);
      return {
        id: path.basename(targetPath).replace(/\.(task|running|done|failed)$/, ""),
        file: targetPath,
        title: header.title || path.basename(targetPath),
        workdir: header.workdir || "",
        sandbox: header.sandbox || "",
        model: header.model || "",
        updatedAt: new Date(stats.mtimeMs).toISOString(),
      };
    });
}

function codexRecentRuns(limit = 12) {
  return listDirs(codexOrchestratorArtifacts)
    .slice(-limit)
    .reverse()
    .map((targetPath) => {
      const stats = fs.statSync(targetPath);
      const summary = parseKeyValueFile(path.join(targetPath, "summary.txt"));
      return {
        id: path.basename(targetPath),
        title: summary.title || path.basename(targetPath),
        workdir: summary.workdir || "",
        sandbox: summary.sandbox || "",
        model: summary.model || "",
        exitCode: summary.exit_code === undefined ? null : Number(summary.exit_code),
        artifactDir: targetPath,
        updatedAt: new Date(stats.mtimeMs).toISOString(),
      };
    });
}

function readSharedRunReports(limit = 12) {
  return listFiles(sharedRunReportsRoot)
    .filter((targetPath) => targetPath.endsWith(".json"))
    .map((targetPath) => {
      try {
        const stats = fs.statSync(targetPath);
        const payload = JSON.parse(fs.readFileSync(targetPath, "utf8"));
        return {
          ...payload,
          report_path: targetPath,
          modified_at: new Date(stats.mtimeMs).toISOString(),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.created_at || right.modified_at).localeCompare(String(left.created_at || left.modified_at)))
    .slice(0, limit);
}

function codexStatusPayload() {
  const available = fs.existsSync(codexEnqueueScript) && fs.existsSync(codexRunReporterScript);
  return {
    status: available ? "available" : "unavailable",
    available,
    fixCommand: available ? "" : codexBridgeFixCommand,
    runtimeRoot: codexOrchestratorRuntime,
    artifactRoot: codexOrchestratorArtifacts,
    reportRoot: sharedRunReportsRoot,
    scripts: {
      enqueue: codexEnqueueScript,
      reporter: codexRunReporterScript,
    },
    queueCounts: codexQueueCounts(),
  };
}

function recommendedWorkdir(focusFiles = []) {
  const file = focusFiles.find((entry) => typeof entry === "string" && isAllowedBridgePath(entry));
  if (file) {
    const root = codexBridgeAllowedRoots.find((allowedRoot) => path.resolve(file).startsWith(`${allowedRoot}${path.sep}`) || path.resolve(file) === allowedRoot);
    if (root) {
      return root;
    }
  }
  return path.join(home, "Desktop", "project-atlas");
}

function recommendedAddDirs(focusFiles = []) {
  const dirs = new Set([path.join(home, "system-bootstrap"), path.join(home, "__home_organized"), path.join(home, "codex-orchestrator"), path.join(home, "Desktop", "Obsidian")]);
  for (const file of focusFiles) {
    if (typeof file !== "string") {
      continue;
    }
    const root = codexBridgeAllowedRoots.find((allowedRoot) => path.resolve(file).startsWith(`${allowedRoot}${path.sep}`) || path.resolve(file) === allowedRoot);
    if (root) {
      dirs.add(root);
    }
  }
  return [...dirs].filter((entry) => entry !== path.join(home, "Desktop", "project-atlas"));
}

function buildCodexPrompt(payload) {
  const task = safeString(payload.task || payload.prompt || "", 12000);
  const focusFiles = Array.isArray(payload.focusFiles) ? payload.focusFiles.filter((entry) => typeof entry === "string").slice(0, 12) : [];
  const verificationCommands = Array.isArray(payload.verificationCommands) ? payload.verificationCommands.filter((entry) => typeof entry === "string").slice(0, 12) : [];
  return [
    "Context scope: system_scope",
    "Allowed context roots: /home/goringich/Desktop/project-atlas, /home/goringich/system-bootstrap, /home/goringich/__home_organized, /home/goringich/codex-orchestrator, /home/goringich/Desktop/Obsidian",
    "Forbidden context: unrelated project internals, raw Codex sessions, auth/env/cookies/tokens/secrets.",
    "",
    "Task prepared by Project Atlas AI Lab.",
    "",
    task,
    "",
    "Focus files:",
    ...(focusFiles.length ? focusFiles.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "Suggested verification commands:",
    ...(verificationCommands.length ? verificationCommands.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "After the run, write or update the shared run report under /home/goringich/__home_organized/runtime/local-codex-stack/run-reports/ and keep Obsidian updates concise.",
  ].join("\n");
}

function enqueueCodexTask(payload) {
  requireCodexBridge();
  const task = safeString(payload.task || payload.prompt || "", 12000);
  if (!task) {
    throw new Error("task is required");
  }
  const focusFiles = Array.isArray(payload.focusFiles) ? payload.focusFiles.filter((entry) => typeof entry === "string") : [];
  const workdir = path.resolve(String(payload.workdir || recommendedWorkdir(focusFiles)));
  if (!isAllowedBridgePath(workdir)) {
    throw new Error(`workdir is outside allowed bridge roots: ${workdir}`);
  }
  const addDirs = (Array.isArray(payload.addDirs) ? payload.addDirs : recommendedAddDirs(focusFiles))
    .filter((entry) => typeof entry === "string")
    .map((entry) => path.resolve(entry))
    .filter((entry) => isAllowedBridgePath(entry) && entry !== workdir);
  const uniqueAddDirs = [...new Set(addDirs)].slice(0, 8);
  const title = safeString(payload.title || "atlas-prepared-task", 120) || "atlas-prepared-task";
  const sandbox = safeString(payload.sandbox || "workspace-write", 80) || "workspace-write";
  const model = safeString(payload.model || "", 80);
  const prompt = buildCodexPrompt({ ...payload, task, focusFiles });
  const args = ["--title", title, "--workdir", workdir, "--sandbox", sandbox];
  if (model) {
    args.push("--model", model);
  }
  for (const dir of uniqueAddDirs) {
    args.push("--add-dir", dir);
  }
  const stdout = execFileSync(codexEnqueueScript, args, {
    cwd: codexOrchestratorRoot,
    input: prompt,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 20000,
  }).trim();
  const taskPath = stdout.match(/Queued task:\s*(.+)$/m)?.[1]?.trim() || "";
  const runId = taskPath ? path.basename(taskPath).replace(/\.task$/, "") : `atlas-${Date.now()}`;
  const reportArgs = [
    "write",
    "--run-id",
    runId,
    "--task-title",
    title,
    "--task-text",
    task,
    "--workdir",
    workdir,
    "--status",
    "queued",
    "--summary",
    "Project Atlas queued this task through codex-agent-enqueue.",
    "--next-action",
    "Run `codex-agent-run` or wait for `codex-agent-orchestrator.timer`, then refresh Project Atlas snapshot.",
  ];
  if (taskPath) {
    reportArgs.push("--queue-task-path", taskPath);
  }
  for (const file of focusFiles.filter((entry) => isAllowedBridgePath(entry)).slice(0, 12)) {
    reportArgs.push("--source-file", file);
  }
  for (const command of (Array.isArray(payload.verificationCommands) ? payload.verificationCommands : []).filter((entry) => typeof entry === "string").slice(0, 12)) {
    reportArgs.push("--verification-command", command);
  }
  const reportPath = execFileSync(codexRunReporterScript, reportArgs, {
    cwd: codexOrchestratorRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20000,
  }).trim();
  return {
    mode: "queue",
    runId,
    title,
    workdir,
    addDirs: uniqueAddDirs,
    taskPath,
    reportPath,
    stdout,
  };
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
  const bridge = codexStatusPayload();
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
    recommendedWorkdir: recommendedWorkdir(focusFiles),
    recommendedAddDirs: recommendedAddDirs(focusFiles),
    enqueueEndpoint: "/api/codex-orchestrator/enqueue",
    codexBridge: {
      status: bridge.status,
      available: bridge.available,
      fixCommand: bridge.fixCommand,
    },
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

  if (req.method === "GET" && url.pathname === "/api/codex-history") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.codexHistory ?? null });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ai-lab") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: buildAiLabApiData(snapshot) });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ai-lab/tool-inventory") {
    try {
      const snapshot = loadSnapshotData();
      const scientificTools = snapshot.localCodexLab?.aiLab?.scientificTools ?? null;
      sendJson(res, 200, {
        ok: true,
        data: scientificTools
          ? {
              generatedAt: scientificTools.generatedAt,
              inventory: scientificTools.inventory,
              installed: scientificTools.installed,
              missing: scientificTools.missing,
              launchers: scientificTools.launchers,
              allowlistedLauncherIds: snapshot.localCodexLab?.aiLab?.prepareFlow?.launcherIds ?? [],
            }
          : null,
      });
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

  if (req.method === "GET" && url.pathname === "/api/codex-orchestrator/status") {
    try {
      sendJson(res, 200, { ok: true, data: codexStatusPayload() });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/codex-orchestrator/queue") {
    try {
      sendJson(res, 200, {
        ok: true,
        data: {
          queueCounts: codexQueueCounts(),
          queued: codexQueueEntries("queue"),
          running: codexQueueEntries("claims"),
        },
      });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/codex-orchestrator/recent-runs") {
    try {
      sendJson(res, 200, {
        ok: true,
        data: {
          recentRuns: codexRecentRuns(),
          sharedRunReports: readSharedRunReports(),
        },
      });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/codex-orchestrator/enqueue") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        sendJson(res, 200, { ok: true, data: enqueueCodexTask(payload) });
      } catch (error) {
        send(res, 400, `${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
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

  if (req.method === "GET" && url.pathname === "/api/product-operating-standard") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: snapshot.commercialReadiness?.productOperatingStandard ?? null });
    } catch (error) {
      send(res, 500, `${error instanceof Error ? error.message : String(error)}\n`);
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/first-money-summary") {
    try {
      const snapshot = loadSnapshotData();
      sendJson(res, 200, { ok: true, data: normalizeCommercialSummary(snapshot.commercialReadiness?.firstMoneySummary) });
    } catch {
      sendJson(res, 200, { ok: true, data: normalizeCommercialSummary(null) });
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
        sendJson(res, 200, {
          ok: true,
          data: {
            launcherId: launcher.id,
            label: launcher.label,
            kind: launcher.kind,
            status: launcher.status,
            target: launcher.target,
            execution: "disabled_metadata_only",
          },
        });
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
