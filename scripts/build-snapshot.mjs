import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { normalizeRevenueAutopilot } from "./commercial-summary.mjs";
import { normalizeLocalAgentPlatform } from "./local-agent-platform.mjs";

const home = os.homedir();
const rootDir = path.join(home, "Desktop", "project-atlas");
const inventoryPath = path.join(home, "system-bootstrap", "docs", "repo-inventory.md");
const overridesPath = path.join(rootDir, "data", "project-overrides.json");
const administrationRegistryPath = path.join(home, "__home_organized", "local-codex-stack", "configs", "admin-surface-registry.json");
const outputPath = path.join(rootDir, "public", "snapshot.json");
const canonicalLocalCodexRuntime = path.join(home, "__home_organized", "runtime", "local-codex-stack");
const legacyLocalCodexRuntime = path.join(home, "__home_organized", "local-codex-stack", "runtime", "local-codex-stack");
const canonicalLocalCodexAtlasPath = path.join(canonicalLocalCodexRuntime, "atlas", "local-codex-lab.json");
const codexHistorySummaryPath = path.join(canonicalLocalCodexRuntime, "atlas", "codex-history-summary.json");
const legacyLocalCodexAtlasPath = path.join(home, "__home_organized", "local-codex-stack", "atlas", "local-codex-lab.json");
const localAiStatePath = path.join(home, "__home_organized", "runtime", "local-ai-control", "state.json");
const agentHealthStatePath = path.join(home, "__home_organized", "runtime", "agent-health-gate", "state.json");
const hostAuditOutputPath = path.join(canonicalLocalCodexRuntime, "host-audit-latest.json");
const aiTelemetryExportPath = path.join(home, "__home_organized", "runtime", "ai-telemetry", "exports", "atlas.json");
const commercialReadinessPath = path.join(canonicalLocalCodexRuntime, "commercial-readiness.json");
const productIntelPath = path.join(canonicalLocalCodexRuntime, "product-intel.json");
const productOperatingStandardPath = path.join(canonicalLocalCodexRuntime, "atlas", "product-operating-standard.json");
const operationPolicySummaryPath = path.join(canonicalLocalCodexRuntime, "atlas", "operation-policy-summary.json");
const localAgentPlatformPath = path.join(canonicalLocalCodexRuntime, "atlas", "local-agent-platform.json");
const revenueAutopilotPath = path.join(canonicalLocalCodexRuntime, "atlas", "revenue-autopilot.json");
const aiLabRegistryPath = path.join(rootDir, "data", "ai-lab-registry.json");
const codexOrchestratorRoot = path.join(home, "codex-orchestrator");
const codexOrchestratorRuntime = path.join(home, "__home_organized", "runtime", "codex-orchestrator");
const codexOrchestratorArtifacts = path.join(home, "__home_organized", "artifacts", "codex-orchestrator");
const sharedRunReportsRoot = path.join(canonicalLocalCodexRuntime, "run-reports");
const codexEnqueueScript = path.join(codexOrchestratorRoot, "bin", "codex-agent-enqueue");
const codexRunReporterScript = path.join(codexOrchestratorRoot, "bin", "codex-agent-run-report");
const codexBridgeFixCommand = "cd /home/goringich/codex-orchestrator && ./install.sh";

const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));

function run(command, args = [], cwd = home) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return String(error?.stdout ?? "").trim() || String(error?.stderr ?? "").trim();
  }
}

function fileExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function sensitivePathLike(value) {
  const lowered = String(value || "").toLowerCase();
  return ["auth", "cookie", "secret", "token", ".env"].some((marker) => lowered.includes(marker));
}

function sanitizeSensitiveExportMetadata(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSensitiveExportMetadata(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const clone = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "auth_file") {
      clone[key] = "";
      continue;
    }
    if (key === "source_path" && typeof raw === "string" && sensitivePathLike(path.basename(raw))) {
      clone[key] = "";
      continue;
    }
    if (key === "source_paths" && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const sanitizedPaths = {};
      for (const [pathKey, pathValue] of Object.entries(raw)) {
        sanitizedPaths[pathKey] =
          typeof pathValue === "string" && (sensitivePathLike(pathKey) || sensitivePathLike(path.basename(pathValue)))
            ? ""
            : pathValue;
      }
      clone[key] = sanitizedPaths;
      continue;
    }
    clone[key] = sanitizeSensitiveExportMetadata(raw);
  }
  return clone;
}

function readText(targetPath) {
  try {
    return fs.readFileSync(targetPath, "utf8");
  } catch {
    return "";
  }
}

function pickExistingPath(paths) {
  return paths.find((targetPath) => fileExists(targetPath)) || "";
}

function readJsonFirst(paths, fallback = null) {
  for (const targetPath of paths) {
    if (!fileExists(targetPath)) {
      continue;
    }
    try {
      return { path: targetPath, payload: JSON.parse(fs.readFileSync(targetPath, "utf8")) };
    } catch {
      continue;
    }
  }
  return { path: "", payload: fallback };
}

function buildAdministration() {
  const registry = readJsonFirst([administrationRegistryPath], { schema_version: "missing", surfaces: [] });
  const payload = sanitizeSensitiveExportMetadata(registry.payload || {});
  const surfaces = Array.isArray(payload.surfaces) ? payload.surfaces : [];
  return {
    status: registry.path ? "registered" : "missing",
    schemaVersion: payload.schema_version || "missing",
    sourceOfTruth: Array.isArray(payload.source_of_truth) ? payload.source_of_truth : [],
    contract: payload.global_contract || {},
    surfaces: surfaces.map((surface) => ({
      id: String(surface?.id || ""),
      title: String(surface?.title || "Unnamed admin surface"),
      classification: String(surface?.classification || "unknown"),
      ownership: String(surface?.ownership || "unknown"),
      operatorRole: String(surface?.operator_role || ""),
      nativeUi: String(surface?.native_ui || ""),
      designReview: String(surface?.design_review || ""),
      styleAdapter: String(surface?.style_adapter || ""),
      atlasIntegration: String(surface?.atlas_integration || ""),
      availability: String(surface?.availability || "available"),
      capabilities: Array.isArray(surface?.capabilities) ? surface.capabilities.map((item) => String(item)) : [],
      launch: {
        mode: String(surface?.launch?.mode || "runbook"),
        label: String(surface?.launch?.label || "Open guide"),
        target: String(surface?.launch?.target || ""),
      },
      runbookTarget: String(surface?.runbook_target || ""),
      sourcePaths: Array.isArray(surface?.source_paths) ? surface.source_paths.map((item) => String(item)) : [],
    })).filter((surface) => surface.id),
    source: statMeta(registry.path, payload.schema_version || ""),
  };
}

function readJsonlFirst(paths) {
  for (const targetPath of paths) {
    if (!fileExists(targetPath)) {
      continue;
    }
    try {
      const payload = fs
        .readFileSync(targetPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      return { path: targetPath, payload };
    } catch {
      continue;
    }
  }
  return { path: "", payload: [] };
}

function statMeta(targetPath, generatedAt = "") {
  if (!targetPath || !fileExists(targetPath)) {
    return {
      path: targetPath || "",
      generatedAt: generatedAt || "",
      modifiedAt: "",
      modifiedAtMs: 0,
    };
  }

  const stats = fs.statSync(targetPath);
  return {
    path: targetPath,
    generatedAt: generatedAt || "",
    modifiedAt: new Date(stats.mtimeMs).toISOString(),
    modifiedAtMs: stats.mtimeMs,
  };
}

function goalStatusRank(status) {
  if (status === "active") return 0;
  if (status === "usage_limited") return 1;
  if (status === "blocked") return 2;
  if (status === "derived") return 3;
  return 4;
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function mapAiLabRun(entry = {}) {
  return {
    runId: entry.run_id || "",
    status: entry.status || "unknown",
    dryRun: Boolean(entry.dry_run),
    repoId: entry.repo_id || "",
    taskType: entry.task_type || "",
    taskText: entry.task_text || "",
    contextBudget: entry.context_budget || "",
    selectedAgent: entry.selected_agent || "",
    sandboxBackend: entry.sandbox_backend || "",
    generatedAt: entry.generated_at || "",
    runReportPath: entry.run_report_path || "",
    failedChecks: entry.failed_checks || [],
    overBudget: Boolean(entry.over_budget),
    delegationStatus: entry.delegation_status || "",
    fallbackUsed: Boolean(entry.fallback_used),
    savedContextCharsEstimated: toNumber(entry.saved_context_chars_estimated || 0),
    plannedWorkerModels: entry.planned_worker_models || {},
    nextBestAction: entry.next_best_action || "",
  };
}

function parseSimpleKeyValueFile(targetPath) {
  const result = {};
  for (const line of readText(targetPath).split(/\r?\n/)) {
    if (!line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    result[key.trim()] = rest.join("=").trim();
  }
  return result;
}

function parseCodexTaskHeader(targetPath) {
  const header = {};
  for (const line of readText(targetPath).split(/\r?\n/)) {
    if (line.trim() === "---") {
      break;
    }
    if (!line.includes(":")) {
      continue;
    }
    const [key, ...rest] = line.split(":");
    header[key.trim()] = rest.join(":").trim();
  }
  return header;
}

function listFiles(targetPath) {
  if (!fileExists(targetPath)) {
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
  if (!fileExists(targetPath)) {
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

function codexQueueCounts() {
  return {
    queued: listFiles(path.join(codexOrchestratorRuntime, "queue")).length,
    running: listFiles(path.join(codexOrchestratorRuntime, "claims")).length,
    done: listFiles(path.join(codexOrchestratorRuntime, "done")).length,
    failed: listFiles(path.join(codexOrchestratorRuntime, "failed")).length,
  };
}

function codexQueueEntries(kind, limit = 8) {
  return listFiles(path.join(codexOrchestratorRuntime, kind))
    .slice(-limit)
    .reverse()
    .map((targetPath) => {
      const stats = fs.statSync(targetPath);
      const header = parseCodexTaskHeader(targetPath);
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

function codexRecentRuns(limit = 8) {
  return listDirs(codexOrchestratorArtifacts)
    .slice(-limit)
    .reverse()
    .map((targetPath) => {
      const stats = fs.statSync(targetPath);
      const summary = parseSimpleKeyValueFile(path.join(targetPath, "summary.txt"));
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

function normalizeSharedRunReport(targetPath, payload = {}) {
  const stats = fs.statSync(targetPath);
  const verificationResults = Array.isArray(payload.verification_results) ? payload.verification_results : [];
  const failedVerification = verificationResults.filter((entry) => ["failed", "blocked"].includes(String(entry?.status || "")));
  const dirtyAfter = toNumber(payload.dirty_after || 0);
  return {
    runId: payload.run_id || path.basename(targetPath, ".json"),
    createdAt: payload.created_at || new Date(stats.mtimeMs).toISOString(),
    taskTitle: payload.task_title || "",
    taskText: payload.task_text || "",
    workdir: payload.workdir || "",
    repo: payload.repo || {},
    branchBefore: payload.branch_before || "",
    branchAfter: payload.branch_after || "",
    dirtyBefore: toNumber(payload.dirty_before || 0),
    dirtyAfter,
    commitBefore: payload.commit_before || "",
    commitAfter: payload.commit_after || "",
    filesChanged: Array.isArray(payload.files_changed) ? payload.files_changed : [],
    verificationCommands: Array.isArray(payload.verification_commands) ? payload.verification_commands : [],
    verificationResults,
    failedVerificationCount: failedVerification.length,
    status: payload.status || "unknown",
    summary: payload.summary || "",
    nextAction: payload.next_action || "",
    sourceFiles: Array.isArray(payload.source_files) ? payload.source_files : [],
    reportPath: targetPath,
    dirtyAfterRun: dirtyAfter > 0,
    source: statMeta(targetPath, payload.created_at || ""),
  };
}

function readSharedRunReports(limit = 8) {
  return listFiles(sharedRunReportsRoot)
    .filter((targetPath) => targetPath.endsWith(".json"))
    .map((targetPath) => {
      try {
        return normalizeSharedRunReport(targetPath, JSON.parse(fs.readFileSync(targetPath, "utf8")));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, limit);
}

function buildCodexOrchestratorBridge() {
  const available = fileExists(codexEnqueueScript) && fileExists(codexRunReporterScript);
  const latestRunReports = readSharedRunReports(10);
  const failedVerification = latestRunReports.filter((report) => report.failedVerificationCount > 0);
  const dirtyAfterRun = latestRunReports.filter((report) => report.dirtyAfterRun);
  return {
    status: available ? "available" : "unavailable",
    available,
    fixCommand: available ? "" : codexBridgeFixCommand,
    endpoints: {
      status: "/api/codex-orchestrator/status",
      queue: "/api/codex-orchestrator/queue",
      recentRuns: "/api/codex-orchestrator/recent-runs",
      enqueue: "/api/codex-orchestrator/enqueue",
    },
    scripts: {
      enqueue: codexEnqueueScript,
      reporter: codexRunReporterScript,
    },
    runtimeRoot: codexOrchestratorRuntime,
    reportRoot: sharedRunReportsRoot,
    queueCounts: codexQueueCounts(),
    queue: codexQueueEntries("queue"),
    running: codexQueueEntries("claims"),
    recentRuns: codexRecentRuns(),
    latestRunReports,
    failedVerification,
    dirtyAfterRun,
    nextExactAction:
      latestRunReports[0]?.nextAction ||
      (available
        ? "Prepare in Atlas, enqueue through `/api/codex-orchestrator/enqueue`, run `codex-agent-run`, then refresh the Atlas snapshot."
        : codexBridgeFixCommand),
    source: statMeta(sharedRunReportsRoot, ""),
  };
}

function parseInventory(markdown) {
  const lines = markdown.split(/\r?\n/);
  const repos = [];
  let section = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim();
      continue;
    }

    if (!line.startsWith("- `")) {
      continue;
    }

    const parts = line.slice(2).split(" -> ");
    const repoPath = parts[0]?.replace(/`/g, "").trim();
    if (!repoPath) {
      continue;
    }

    let remote = "";
    let branch = "";
    let dirty = "0";

    for (const part of parts.slice(1)) {
      if (part.startsWith("`")) {
        remote = part.replace(/`/g, "").trim();
      } else if (part.startsWith("branch `")) {
        branch = part.slice(8, -1).trim();
      } else if (part.startsWith("dirty `")) {
        dirty = part.slice(7, -1).trim();
      }
    }

    repos.push({
      path: repoPath,
      remote,
      branch,
      dirty,
      section,
    });
  }

  return repos;
}

function injectOverrideRepos(repos) {
  const seen = new Set(repos.map((repo) => repo.path));
  const candidates = Object.keys(overrides.projects).flatMap((repoKey) => [
    path.join(home, "Desktop", repoKey),
    path.join(home, "Desktop", "server", repoKey),
    path.join(home, repoKey),
  ]);

  for (const candidatePath of candidates) {
    if (!fileExists(candidatePath) || seen.has(candidatePath) || !fileExists(path.join(candidatePath, ".git"))) {
      continue;
    }

    seen.add(candidatePath);
    repos.push({
      path: candidatePath,
      remote: run("git", ["remote", "get-url", "origin"], candidatePath),
      branch: run("git", ["rev-parse", "--abbrev-ref", "HEAD"], candidatePath),
      dirty: "0",
      section: "Curated Focus Repos",
    });
  }

  return repos;
}

function parsePackageJson(repoPath) {
  const packagePath = path.join(repoPath, "package.json");
  if (!fileExists(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
}

function parseManifestTags(repoPath, packageJson, repoKey) {
  const tags = new Set();
  const packageDeps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };
  const packageScripts = packageJson?.scripts ?? {};
  const pyproject = readText(path.join(repoPath, "pyproject.toml"));
  const cargoToml = readText(path.join(repoPath, "Cargo.toml"));
  const goMod = readText(path.join(repoPath, "go.mod"));
  const readme = readText(path.join(repoPath, "README.md"));

  if (packageDeps.react || packageDeps["react-dom"]) tags.add("React");
  if (packageDeps.next) tags.add("Next.js");
  if (packageDeps.fastify) tags.add("Fastify");
  if (packageDeps.prisma || readme.includes("Prisma")) tags.add("Prisma");
  if (packageDeps.vite || Object.values(packageScripts).some((value) => value.includes("vite"))) tags.add("Vite");
  if (packageDeps.zustand) tags.add("Zustand");
  if (packageDeps.dexie) tags.add("Dexie");
  if (packageDeps.electron || repoKey === "cabinet") tags.add("Electron");
  if (packageDeps.express) tags.add("Express");
  if (packageDeps["@keystatic/next"]) tags.add("Keystatic");
  if (packageDeps.redis || readme.includes("Redis")) tags.add("Redis");
  if (packageDeps["@tanstack/react-query"]) tags.add("TanStack Query");
  if (pyproject.includes("django") || readme.includes("Django")) tags.add("Django");
  if (pyproject.includes("fastapi")) tags.add("FastAPI");
  if (pyproject.includes("flask") || readme.includes("Flask")) tags.add("Flask");
  if (pyproject.includes("aiogram")) tags.add("Bot");
  if (cargoToml) tags.add("Rust");
  if (goMod) tags.add("Go");
  if (repoPath.includes("/esp") || readme.includes("ESP-IDF")) tags.add("ESP-IDF");
  if (fileExists(path.join(repoPath, "docker-compose.yml")) || fileExists(path.join(repoPath, "compose.yaml")) || fileExists(path.join(repoPath, "Dockerfile"))) tags.add("Docker");
  if (readme.includes("MCP")) tags.add("MCP");
  if (readme.includes("OpenHarness")) tags.add("Agents");

  return [...tags].slice(0, 5);
}

function inferDomain(repoPath, section) {
  if (repoPath.includes("/server/")) return "infra";
  if (repoPath.includes("/esp")) return "embedded";
  if (repoPath.includes("system-bootstrap") || repoPath.includes("__home_organized")) return "system";
  if (repoPath.includes("OpenHarness") || repoPath.includes("openClaw") || repoPath.includes("codex")) return "local-ai";
  if (repoPath.includes("/hse") || repoPath.includes("course") || repoPath.includes("hakaton")) return "study";
  if (section.includes("External")) return "external";
  return "product";
}

function inferCommands(packageJson, overrideCommands = {}) {
  const scripts = packageJson?.scripts ?? {};
  const select = (...keys) => {
    const exactKey = keys.find((key) => typeof scripts[key] === "string");
    return exactKey ? `npm run ${exactKey}` : "";
  };

  const deployKey = Object.keys(scripts).find((key) => key.includes("deploy"));
  return {
    dev: overrideCommands.dev || select("dev:all", "dev"),
    build: overrideCommands.build || select("build"),
    test: overrideCommands.test || select("test"),
    deploy: overrideCommands.deploy || (deployKey ? `npm run ${deployKey}` : ""),
  };
}

function gitStatus(repoPath) {
  const short = run("git", ["status", "--short"], repoPath);
  const branchLine = run("git", ["status", "--short", "--branch"], repoPath).split(/\r?\n/, 1)[0] ?? "";
  const dirtyFiles = short
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  const dirtyCount = short ? short.split(/\r?\n/).filter(Boolean).length : 0;
  const aheadMatch = branchLine.match(/ahead (\d+)/);
  const behindMatch = branchLine.match(/behind (\d+)/);

  return {
    dirtyCount,
    dirtyFiles,
    ahead: Number(aheadMatch?.[1] ?? 0),
    behind: Number(behindMatch?.[1] ?? 0),
  };
}

function gitCommit(repoPath) {
  const raw = run("git", ["log", "-1", "--pretty=%ct|%ad|%h|%s", "--date=short"], repoPath);
  const [timestamp = "0", date = "", sha = "", subject = ""] = raw.split("|");
  return {
    timestamp: Number(timestamp || 0) * 1000,
    date,
    sha,
    subject,
  };
}

function sparkline(seedText, dirtyCount, ahead, behind) {
  let seed = 0;
  for (const char of seedText) {
    seed = (seed * 31 + char.charCodeAt(0)) % 9973;
  }

  const values = [];
  for (let index = 0; index < 14; index += 1) {
    seed = (seed * 37 + 11) % 7919;
    const base = 28 + (seed % 43);
    const modifier = Math.max(0, 14 - dirtyCount) + ahead * 3 - behind * 2;
    values.push(Math.max(8, Math.min(92, base + modifier - index)));
  }

  return values;
}

function healthTone({ dirtyCount, ahead, behind, deployStatus, blockedTasks }) {
  if (blockedTasks > 0 || dirtyCount > 24 || deployStatus === "risk") {
    return "risk";
  }
  if (dirtyCount > 0 || ahead > 0 || behind > 0 || deployStatus === "attention") {
    return "attention";
  }
  return "ok";
}

function fileLink(targetPath) {
  return targetPath ? `file://${targetPath}` : "";
}

function vscodeLink(targetPath) {
  return targetPath ? `vscode://file/${targetPath}` : "";
}

function summarizeRepo(repoEntry) {
  const repoPath = repoEntry.path;
  const repoKey = path.basename(repoPath);
  const override = overrides.projects[repoKey] ?? {};
  const packageJson = parsePackageJson(repoPath);
  const commands = inferCommands(packageJson, override.commands ?? {});
  const git = gitStatus(repoPath);
  const commit = gitCommit(repoPath);
  const detectedTags = parseManifestTags(repoPath, packageJson, repoKey);
  const tags = [...new Set([...(override.tags ?? []), ...detectedTags])].slice(0, 5);
  const readmePath = fileExists(path.join(repoPath, "README.md")) ? path.join(repoPath, "README.md") : "";
  const docsDir = fileExists(path.join(repoPath, "docs")) ? path.join(repoPath, "docs") : "";
  const services = override.services ?? [];
  const tasks = (override.tasks ?? []).map((task, index) => ({
    id: `${repoKey}-${index + 1}`,
    project: repoKey,
    projectTitle: override.title || repoKey,
    ...task,
  }));
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const deployStatus = override.deploy?.status ?? (commands.deploy ? "attention" : "ok");
  const tone = healthTone({
    dirtyCount: git.dirtyCount,
    ahead: git.ahead,
    behind: git.behind,
    deployStatus,
    blockedTasks,
  });
  const summary = override.summary ?? `${repoKey} · ${tags.join(" / ") || "repository"}`;
  const domain = override.domain ?? inferDomain(repoPath, repoEntry.section);
  const commercialRole = override.commercialRole || override.monetizationLabel || "technical-only";
  const moneyPath = Array.isArray(override.moneyPath) ? override.moneyPath : [];
  const commitAgeHours = commit.timestamp ? Math.max(0, Math.round((Date.now() - commit.timestamp) / 36e5)) : null;
  const docs = [
    ...(override.docs ?? []),
    ...(readmePath ? [{ label: "README", path: readmePath }] : []),
  ].filter((entry, index, array) => array.findIndex((item) => item.path === entry.path) === index);

  return {
    id: repoKey,
    title: override.title || repoKey,
    name: repoKey,
    repoPath,
    section: repoEntry.section,
    domain,
    focus: overrides.focus.includes(repoKey),
    summary,
    commercialRole,
    monetizationLabel: commercialRole,
    moneyPath,
    remote: repoEntry.remote,
    branch: repoEntry.branch || "unknown",
    dirtyCount: git.dirtyCount || Number(repoEntry.dirty || 0),
    ahead: git.ahead,
    behind: git.behind,
    healthTone: tone,
    lastCommit: commit,
    commitAgeHours,
    tags,
    related: override.related ?? [],
    services,
    commands,
    deploy: override.deploy ?? null,
    docs,
    release: override.release ?? null,
    riskNotes: override.riskNotes ?? [],
    tasks,
    quickOpen: {
      root: fileLink(repoPath),
      readme: fileLink(readmePath),
      docs: fileLink(docsDir),
      vscode: vscodeLink(repoPath),
    },
    paths: {
      root: repoPath,
      readme: readmePath,
      docs: docsDir,
    },
    position: override.position ?? null,
    sparkline: sparkline(repoKey, git.dirtyCount, git.ahead, git.behind),
    dirtyFiles: git.dirtyFiles,
    metrics: {
      signal: Math.max(22, 90 - git.dirtyCount * 3 + git.ahead * 4 - git.behind * 2),
      commits7d: Math.max(1, Math.round((90 - (commitAgeHours ?? 120)) / 12)),
      services: services.length,
    },
  };
}

function buildLocalCodexLab() {
  const codexOrchestratorBridge = buildCodexOrchestratorBridge();
  const lab = readJsonFirst([canonicalLocalCodexAtlasPath, legacyLocalCodexAtlasPath], {});
  const aiLabRegistry = readJsonFirst([aiLabRegistryPath], {});
  const researchSummary = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "research", "research-summary.json"),
      path.join(legacyLocalCodexRuntime, "research", "research-summary.json"),
    ],
    {},
  );
  const workspaceMemory = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "memory", "workspace-memory-summary.json"),
      path.join(legacyLocalCodexRuntime, "memory", "workspace-memory-summary.json"),
    ],
    {},
  );
  const retrievalPolicy = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "retrieval-policy.json"),
      path.join(legacyLocalCodexRuntime, "retrieval-policy.json"),
    ],
    {},
  );
  const tokenWaste = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "conversation-mining", "token-waste-metrics.json"),
      path.join(legacyLocalCodexRuntime, "conversation-mining", "token-waste-metrics.json"),
    ],
    {},
  );
  const openclawReliability = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "openclaw-reliability.json"),
      path.join(legacyLocalCodexRuntime, "openclaw-reliability.json"),
    ],
    {},
  );
  const repoIntel = readJsonFirst(
    [
      path.join(canonicalLocalCodexRuntime, "repo-intel", "index.json"),
      path.join(legacyLocalCodexRuntime, "repo-intel", "index.json"),
    ],
    {},
  );
  const runSummaries = readJsonlFirst(
    [
      path.join(canonicalLocalCodexRuntime, "run-summaries.jsonl"),
      path.join(legacyLocalCodexRuntime, "run-summaries.jsonl"),
    ],
  );

  const goalsRoot = pickExistingPath([
    path.join(canonicalLocalCodexRuntime, "goals"),
    path.join(legacyLocalCodexRuntime, "goals"),
  ]);
  const goalCapsules = goalsRoot
    ? fs
        .readdirSync(goalsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(goalsRoot, entry.name, "goal-capsule.json"))
        .filter((targetPath) => fileExists(targetPath))
        .map((targetPath) => {
          const payload = JSON.parse(fs.readFileSync(targetPath, "utf8"));
          return {
            goalId: payload.goal_id,
            status: payload.status,
            objective: payload.objective,
            nextAction: payload.next_action,
            latestRunSummary: payload.latest_run_summary || "",
            recommendedContextBudget: payload.recommended_context_budget || "",
            remainingGaps: payload.remaining_gaps || [],
            knownBlockers: payload.known_blockers || [],
            lastUsefulCommits: payload.last_useful_commits || [],
            sourceNotes: payload.source_notes || [],
            source: statMeta(targetPath, payload.generated_at || ""),
          };
        })
        .sort((left, right) => {
          const rankDelta = goalStatusRank(left.status) - goalStatusRank(right.status);
          if (rankDelta !== 0) {
            return rankDelta;
          }
          return left.goalId.localeCompare(right.goalId);
        })
    : [];

  const runSummarySource = statMeta(runSummaries.path, "");
  const summarizedRuns = runSummaries.payload
    .slice()
    .sort((left, right) => String(right.finished_at || right.started_at || "").localeCompare(String(left.finished_at || left.started_at || "")))
    .slice(0, 6)
    .map((entry) => ({
      runId: entry.run_id,
      goalId: entry.goal_id || "",
      task: entry.task || "",
      startedAt: entry.started_at || null,
      finishedAt: entry.finished_at || null,
      reposTouched: entry.repos_touched || [],
      verification: entry.verification || [],
      commits: entry.commits || [],
      whatRemains: entry.what_remains || [],
      nextAction: entry.next_action || "",
      source: runSummarySource,
    }));
  const aiLab = lab.payload?.ai_lab || {};
  const codexControlLabCards = [
    ...(aiLab.groups?.codex_control_lab || []),
    ...(aiLabRegistry.payload?.codex_control_lab || []),
  ].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index);
  const scientificVisualLabCards = [
    ...(aiLab.groups?.scientific_visual_lab || []),
    ...(aiLabRegistry.payload?.scientific_visual_lab || []),
  ].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index);

  return {
    generatedAt: lab.payload?.generated_at || new Date().toISOString(),
    hostHealth: lab.payload?.host_health || "unknown",
    source: statMeta(lab.path, lab.payload?.generated_at || ""),
    modelRouting: {
      fast: lab.payload?.fast_model || "unknown",
      balanced: lab.payload?.balanced_model || "unknown",
      heavy: lab.payload?.heavy_model || "unknown",
      planning: lab.payload?.planning_model || "unknown",
      embedding: lab.payload?.embedding_model || "unknown",
      evolution: {
        status: lab.payload?.model_evolution?.status || "missing",
        generatedAt: lab.payload?.model_evolution?.generated_at || "",
        mode: lab.payload?.model_evolution?.mode || "",
        evalPath: lab.payload?.model_evolution?.eval_path || "",
        winners: lab.payload?.model_evolution?.winners || {},
        promotionCandidates: lab.payload?.model_evolution?.promotion_candidates || {},
        promoted: lab.payload?.model_evolution?.promoted || {},
        sanitized: Boolean(lab.payload?.model_evolution?.sanitized),
      },
      source: statMeta(lab.path, lab.payload?.generated_at || ""),
    },
    retrievalPolicy: {
      priorityOrder: retrievalPolicy.payload?.priority_order || [],
      denylistedClasses: retrievalPolicy.payload?.ordinary_retrieval_rules?.denylisted_classes || [],
      denylistedFiles: Number(retrievalPolicy.payload?.stats?.denylisted_files || 0),
      source: statMeta(retrievalPolicy.path, retrievalPolicy.payload?.generated_at || ""),
    },
    tokenEfficiency: {
      filesScanned: toNumber(tokenWaste.payload?.number_of_codex_conversation_files_scanned || 0),
      longGoalRuns: toNumber(tokenWaste.payload?.number_of_long_goal_runs || 0),
      bridgeNoiseFiles: toNumber(tokenWaste.payload?.number_of_bridge_smoke_no_answer_files || 0),
      repeatedHealthGateCount: toNumber(tokenWaste.payload?.repeated_health_gate_count || 0),
      filesWithNoAssistantReply: toNumber(tokenWaste.payload?.files_with_no_assistant_reply || 0),
      source: statMeta(tokenWaste.path, tokenWaste.payload?.generated_at || ""),
    },
    openclawReliability: {
      warningCount: toNumber(openclawReliability.payload?.summary?.warning_count || 0),
      status: openclawReliability.payload?.summary?.status || "unknown",
      classifications: openclawReliability.payload?.summary?.classifications || {},
      recommendedActions: openclawReliability.payload?.recommended_actions || [],
      source: statMeta(
        openclawReliability.path,
        openclawReliability.payload?.generated_at || "",
      ),
    },
    repoIntel: {
      targetCount: toNumber(repoIntel.payload?.target_count || 0),
      safeTargets: repoIntel.payload?.safe_targets || [],
      targets: (repoIntel.payload?.targets || []).map((entry) => ({
        repoId: entry.repo_id,
        title: entry.title,
        path: entry.path,
        dirtyCount: toNumber(entry.git?.dirty_count || 0),
        ahead: toNumber(entry.git?.ahead || 0),
        symbolCount: toNumber(entry.symbol_count || 0),
        testCount: toNumber(entry.test_count || 0),
        dependencyManifestCount: toNumber(entry.dependency_manifest_count || 0),
        source: statMeta(path.join(entry.canonical_dir || "", "repo-summary.json"), entry.generated_at || ""),
      })),
      source: statMeta(repoIntel.path, repoIntel.payload?.generated_at || ""),
    },
    research: {
      runCount: toNumber(researchSummary.payload?.research_run_count || 0),
      sourceCardCount: toNumber(researchSummary.payload?.source_card_count || 0),
      providers: researchSummary.payload?.providers || [],
      sourceDomains: researchSummary.payload?.source_domains || [],
      latestRun: researchSummary.payload?.latest_run || {},
      paths: researchSummary.payload?.paths || {},
      freshness: researchSummary.payload?.freshness || {},
      source: statMeta(researchSummary.path, researchSummary.payload?.generated_at || ""),
    },
    memory: {
      workspaceFocus: workspaceMemory.payload?.workspace_focus || "",
      activeGoalCount: toNumber(workspaceMemory.payload?.active_goal_count || 0),
      activeGoalIds: workspaceMemory.payload?.active_goal_ids || [],
      latestRunId: workspaceMemory.payload?.latest_run_id || "",
      latestTask: workspaceMemory.payload?.latest_task || "",
      hostHealth: workspaceMemory.payload?.host_health || "",
      highlights: workspaceMemory.payload?.highlights || [],
      sourcePaths: workspaceMemory.payload?.source_paths || {},
      source: statMeta(workspaceMemory.path, workspaceMemory.payload?.generated_at || ""),
    },
    tokenEconomy: {
      contextBudgetsPath: lab.payload?.token_economy?.context_budgets_path || "",
      tokenWasteMetricsPath: lab.payload?.token_economy?.token_waste_metrics_path || "",
      runSummariesPath: lab.payload?.token_economy?.run_summaries_path || "",
      highWasteCapsulesPath: lab.payload?.token_economy?.high_waste_capsules_path || "",
      tokenEconomyReportPath: lab.payload?.token_economy?.token_economy_report_path || "",
      freshness: lab.payload?.token_economy?.freshness || {},
      source: statMeta(lab.path, lab.payload?.generated_at || ""),
    },
    failureAwareObservability: {
      hostHealth: lab.payload?.failure_aware_observability?.host_health || "unknown",
      safeMode: lab.payload?.failure_aware_observability?.safe_mode || "unknown",
      openclawWarningCount: toNumber(lab.payload?.failure_aware_observability?.openclaw_warning_count || 0),
      latestRunFailures: lab.payload?.failure_aware_observability?.latest_run_failures || [],
      sourcePaths: lab.payload?.failure_aware_observability?.source_paths || {},
      source: statMeta(lab.path, lab.payload?.generated_at || ""),
    },
    activeRuns: (lab.payload?.active_runs || []).map((entry) => mapAiLabRun(entry)),
    latestRunReports: (lab.payload?.latest_run_reports || []).map((entry) => mapAiLabRun(entry)),
    sharedRunReports: codexOrchestratorBridge.latestRunReports,
    codexOrchestratorBridge,
    evalStatus: lab.payload?.eval_status || { status: "missing" },
    knowledgeGraphStatus: {
      status: lab.payload?.knowledge_graph_status?.status || "missing",
      scope: lab.payload?.knowledge_graph_status?.scope || "",
      generatedAt: lab.payload?.knowledge_graph_status?.generated_at || "",
      nodeCount: toNumber(lab.payload?.knowledge_graph_status?.node_count || 0),
      edgeCount: toNumber(lab.payload?.knowledge_graph_status?.edge_count || 0),
      durationMs: toNumber(lab.payload?.knowledge_graph_status?.duration_ms || 0),
      sanitized: Boolean(lab.payload?.knowledge_graph_status?.sanitized),
    },
    contextPackStatus: {
      status: lab.payload?.context_pack_status?.status || "missing",
      generatedAt: lab.payload?.context_pack_status?.generated_at || "",
      scope: lab.payload?.context_pack_status?.scope || "",
      agent: lab.payload?.context_pack_status?.agent || "",
      taskHash: lab.payload?.context_pack_status?.task_hash || "",
      contextBudget: lab.payload?.context_pack_status?.context_budget || "",
      hybridStatus: lab.payload?.context_pack_status?.hybrid_status || "",
      hybridMatchCount: toNumber(lab.payload?.context_pack_status?.hybrid_match_count || 0),
      repoIntelStatus: lab.payload?.context_pack_status?.repo_intel_status || "",
      repoCandidateCount: toNumber(lab.payload?.context_pack_status?.repo_candidate_count || 0),
      goalCount: toNumber(lab.payload?.context_pack_status?.goal_count || 0),
      runSummaryCount: toNumber(lab.payload?.context_pack_status?.run_summary_count || 0),
      verificationCommandCount: toNumber(lab.payload?.context_pack_status?.verification_command_count || 0),
      sourceRegistryHitCount: toNumber(lab.payload?.context_pack_status?.source_registry_hit_count || 0),
      sanitized: Boolean(lab.payload?.context_pack_status?.sanitized),
    },
    ragE2eEvalStatus: {
      status: lab.payload?.rag_e2e_eval_status?.status || "missing",
      scope: lab.payload?.rag_e2e_eval_status?.scope || "",
      limit: toNumber(lab.payload?.rag_e2e_eval_status?.limit || 0),
      budget: lab.payload?.rag_e2e_eval_status?.budget || "",
      fixtureCount: toNumber(lab.payload?.rag_e2e_eval_status?.metrics?.fixture_count || 0),
      hitAt1: toNumber(lab.payload?.rag_e2e_eval_status?.metrics?.hit_at_1 || 0),
      hitAt3: toNumber(lab.payload?.rag_e2e_eval_status?.metrics?.hit_at_3 || 0),
      mrr: toNumber(lab.payload?.rag_e2e_eval_status?.metrics?.mrr || 0),
      sanitized: Boolean(lab.payload?.rag_e2e_eval_status?.sanitized),
    },
    localModelRagEntrypointStatus: {
      status: lab.payload?.local_model_rag_entrypoint_status?.status || "missing",
      generatedAt: lab.payload?.local_model_rag_entrypoint_status?.generated_at || "",
      taskHash: lab.payload?.local_model_rag_entrypoint_status?.task_hash || "",
      scope: lab.payload?.local_model_rag_entrypoint_status?.scope || "",
      model: lab.payload?.local_model_rag_entrypoint_status?.model || "",
      mode: lab.payload?.local_model_rag_entrypoint_status?.mode || "",
      graphMatchCount: toNumber(lab.payload?.local_model_rag_entrypoint_status?.graph_match_count || 0),
      sourceRegistryHitCount: toNumber(lab.payload?.local_model_rag_entrypoint_status?.source_registry_hit_count || 0),
      dryRun: Boolean(lab.payload?.local_model_rag_entrypoint_status?.dry_run),
      sanitized: Boolean(lab.payload?.local_model_rag_entrypoint_status?.sanitized),
    },
    codexContextEntrypointStatus: {
      status: lab.payload?.codex_context_entrypoint_status?.status || "missing",
      generatedAt: lab.payload?.codex_context_entrypoint_status?.generated_at || "",
      scope: lab.payload?.codex_context_entrypoint_status?.scope || "",
      taskHash: lab.payload?.codex_context_entrypoint_status?.task_hash || "",
      sourceRegistryHitCount: toNumber(lab.payload?.codex_context_entrypoint_status?.source_registry_hit_count || 0),
      graphMatchCount: toNumber(lab.payload?.codex_context_entrypoint_status?.graph_match_count || 0),
      sanitized: Boolean(lab.payload?.codex_context_entrypoint_status?.sanitized),
    },
    localGpuLiveBenchStatus: {
      status: lab.payload?.local_gpu_live_bench_status?.status || "missing",
      generatedAt: lab.payload?.local_gpu_live_bench_status?.generated_at || "",
      model: lab.payload?.local_gpu_live_bench_status?.model || "",
      numCtx: toNumber(lab.payload?.local_gpu_live_bench_status?.num_ctx || 0),
      numPredict: toNumber(lab.payload?.local_gpu_live_bench_status?.num_predict || 0),
      processorLine: lab.payload?.local_gpu_live_bench_status?.processor_line || "",
      metrics: {
        status: lab.payload?.local_gpu_live_bench_status?.metrics?.status || "missing",
        elapsedSec: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.elapsed_sec || 0),
        promptEvalCount: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.prompt_eval_count || 0),
        promptEvalSec: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.prompt_eval_sec || 0),
        evalCount: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.eval_count || 0),
        evalSec: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.eval_sec || 0),
        tokensPerSec: toNumber(lab.payload?.local_gpu_live_bench_status?.metrics?.tokens_per_sec || 0),
      },
      gpuSummary: {
        status: lab.payload?.local_gpu_live_bench_status?.gpu_summary?.status || "missing",
        sampleCount: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.sample_count || 0),
        gpuUtilAvgPct: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.gpu_util_avg_pct || 0),
        gpuUtilMaxPct: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.gpu_util_max_pct || 0),
        memUtilAvgPct: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.mem_util_avg_pct || 0),
        memUtilMaxPct: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.mem_util_max_pct || 0),
        memUsedAvgMib: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.mem_used_avg_mib || 0),
        memUsedMaxMib: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.mem_used_max_mib || 0),
        powerAvgW: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.power_avg_w || 0),
        powerMaxW: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.power_max_w || 0),
        tempMaxC: toNumber(lab.payload?.local_gpu_live_bench_status?.gpu_summary?.temp_max_c || 0),
        pstates: lab.payload?.local_gpu_live_bench_status?.gpu_summary?.pstates || [],
      },
      offloadRecommendations: {
        status: lab.payload?.local_gpu_offload_bench_status?.status || "missing",
        fast: lab.payload?.local_gpu_offload_bench_status?.recommendations?.fast || "",
        balanced: lab.payload?.local_gpu_offload_bench_status?.recommendations?.balanced || "",
        heavy: lab.payload?.local_gpu_offload_bench_status?.recommendations?.heavy || "",
        rankedCount: toNumber(lab.payload?.local_gpu_offload_bench_status?.recommendations?.ranked?.length || 0),
        sanitized: Boolean(lab.payload?.local_gpu_offload_bench_status?.sanitized),
      },
      sanitized: Boolean(lab.payload?.local_gpu_live_bench_status?.sanitized),
    },
    latestHermes: {
      status: lab.payload?.latest_hermes?.status || "missing",
      runtime_state: lab.payload?.latest_hermes?.runtime_state || "missing",
      state_reason: lab.payload?.latest_hermes?.state_reason || "",
      selected_runtime: lab.payload?.latest_hermes?.selected_runtime || "",
      requested_runtime: lab.payload?.latest_hermes?.requested_runtime || "hermes",
      fallback_used: Boolean(lab.payload?.latest_hermes?.fallback_used),
      fallback_target: lab.payload?.latest_hermes?.fallback_target || "",
      policy_allowed: Boolean(lab.payload?.latest_hermes?.policy_allowed),
      delegation_status: lab.payload?.latest_hermes?.delegation_status || "",
      preflight_completed: Boolean(lab.payload?.latest_hermes?.preflight_completed),
      preflight_mode_resolved: lab.payload?.latest_hermes?.preflight_mode_resolved || "",
      hermes_installed: Boolean(lab.payload?.latest_hermes?.hermes_installed),
      hermes_binary: lab.payload?.latest_hermes?.hermes_binary || "",
      runtime_policy_path: lab.payload?.latest_hermes?.runtime_policy_path || "",
      worker_manifest_path: lab.payload?.latest_hermes?.worker_manifest_path || "",
      workers_dir: lab.payload?.latest_hermes?.workers_dir || "",
      skip_reason: lab.payload?.latest_hermes?.skip_reason || "",
      saved_context_chars_estimated: Number(lab.payload?.latest_hermes?.saved_context_chars_estimated || 0),
      failed_roles: lab.payload?.latest_hermes?.failed_roles || [],
      planned_worker_models: lab.payload?.latest_hermes?.planned_worker_models || {},
    },
    agentRouting: lab.payload?.agent_routing || { status: "missing" },
    tokenCostPlaceholders: lab.payload?.token_cost_placeholders || {
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      cost_usd: null,
    },
    failedChecks: lab.payload?.failed_checks || [],
    nextBestAction: lab.payload?.next_best_action || "",
    goalCapsules,
    runSummaries: summarizedRuns,
    aiLab: {
      generatedAt: aiLab.generated_at || lab.payload?.generated_at || new Date().toISOString(),
      status: aiLab.status || "missing",
      source: statMeta(lab.path, aiLab.generated_at || lab.payload?.generated_at || ""),
      control: {
        tokenBudgetTier: aiLab.control?.token_budget_tier || "small",
        retrievalSources: aiLab.control?.retrieval_sources || [],
        excludedSources: aiLab.control?.excluded_sources || [],
        selectedAgentRoute: {
          routeId: aiLab.control?.selected_agent_route?.route_id || "",
          routeLabel: aiLab.control?.selected_agent_route?.route_label || "",
          selectedAgent: aiLab.control?.selected_agent_route?.selected_agent || "",
          defaultContextBudget: aiLab.control?.selected_agent_route?.default_context_budget || "small",
          localCloudDecision: {
            mode: aiLab.control?.selected_agent_route?.local_cloud_decision?.mode || "hybrid",
            reason: aiLab.control?.selected_agent_route?.local_cloud_decision?.reason || "",
          },
        },
        sandboxStatus: {
          backend: aiLab.control?.sandbox_status?.backend || "",
          mode: aiLab.control?.sandbox_status?.mode || "",
          permissionTier: aiLab.control?.sandbox_status?.permission_tier || "",
          rawConversationMirrorsAllowed: Boolean(aiLab.control?.sandbox_status?.raw_conversation_mirrors_allowed),
          hostHealth: aiLab.control?.sandbox_status?.host_health || "unknown",
        },
        activeRuns: (aiLab.control?.active_runs || []).map((entry) => mapAiLabRun(entry)),
        latestRunReports: (aiLab.control?.latest_run_reports || []).map((entry) => mapAiLabRun(entry)),
        tokenWasteMarkers: {
          filesScanned: toNumber(aiLab.control?.token_waste_markers?.files_scanned || 0),
          repeatedHealthGateCount: toNumber(aiLab.control?.token_waste_markers?.repeated_health_gate_count || 0),
          bridgeNoiseFiles: toNumber(aiLab.control?.token_waste_markers?.bridge_noise_files || 0),
          filesWithNoAssistantReply: toNumber(aiLab.control?.token_waste_markers?.files_with_no_assistant_reply || 0),
          highWasteCapsulesPath: aiLab.control?.token_waste_markers?.high_waste_capsules_path || "",
        },
        goalCapsules: (aiLab.control?.goal_capsules || []).map((entry) => ({
          goalId: entry.goal_id || "",
          status: entry.status || "unknown",
          objective: entry.objective || "",
          nextAction: entry.next_action || "",
          recommendedContextBudget: entry.recommended_context_budget || "",
          sourcePath: entry.source_path || "",
        })),
        nextBestAction: aiLab.control?.next_best_action || "",
      },
      groups: {
        codexControlLab: codexControlLabCards.map((entry) => ({
          id: entry.id || "",
          label: entry.label || "",
          status: entry.status || "missing",
          summary: entry.summary || "",
          path: entry.path || "",
        })),
        scientificVisualLab: scientificVisualLabCards.map((entry) => ({
          id: entry.id || "",
          label: entry.label || "",
          status: entry.status || "missing",
          summary: entry.summary || "",
          path: entry.path || "",
          primaryTarget: entry.primary_target || "",
          installedTools: entry.installed_tools || [],
          missingTools: entry.missing_tools || [],
          actions: (entry.actions || []).map((action) => ({
            label: action.label || "",
            launcherId: action.launcher_id || "",
            target: action.target || "",
            status: action.status || "missing",
          })),
        })),
      },
      scientificTools: {
        generatedAt: aiLab.scientific_tools?.generated_at || aiLab.generated_at || "",
        inventory: (aiLab.scientific_tools?.inventory || []).map((entry) => ({
          id: entry.id || "",
          label: entry.label || "",
          command: entry.command || "",
          path: entry.path || "",
          category: entry.category || "",
          status: entry.status || "missing",
          openTarget: entry.open_target || "",
        })),
        installed: aiLab.scientific_tools?.installed || [],
        missing: aiLab.scientific_tools?.missing || [],
        launchers: (aiLab.scientific_tools?.launchers || []).map((entry) => ({
          id: entry.id || "",
          label: entry.label || "",
          status: entry.status || "missing",
          kind: entry.kind || "path",
          target: entry.target || "",
        })),
      },
      prepareFlow: {
        endpoint: aiLab.prepare_flow?.endpoint || "/api/ai-lab/prepare",
        toolInventoryEndpoint: aiLab.prepare_flow?.tool_inventory_endpoint || "/api/ai-lab/tool-inventory",
        launcherEndpoint: aiLab.prepare_flow?.launcher_endpoint || "/api/ai-lab/launch",
        executionPolicy: aiLab.prepare_flow?.execution_policy || "",
        launcherIds: aiLab.prepare_flow?.launcher_ids || [],
      },
    },
  };
}

function buildLocalAiControl() {
  const state = readJsonFirst([localAiStatePath], {});
  const payload = state.payload ?? {};
  const emptyCleanup = {
    keep: [],
    "keep-but-manual": [],
    "candidate-for-removal": [],
    "unknown-needs-test": [],
  };

  return {
    generatedAt: payload.generated_at || "",
    host: payload.host || {},
    ollamaVersion: payload.ollama_version?.text || "",
    recommendations: payload.recommendations || {},
    roleMap: payload.role_map || {},
    models: payload.ollama?.models || [],
    activeModels: payload.ollama_ps?.active_models || [],
    cleanup: payload.cleanup || emptyCleanup,
    gemma4: payload.gemma4 || { recommended_tag: "", tags: {}, reason: "" },
    runtimes: payload.runtimes || [],
    blockers: payload.blockers || [],
    atlas: payload.atlas || {},
    openclaw: {
      overview: payload.openclaw?.overview || {},
      channels: payload.openclaw?.channels || [],
      agents: payload.openclaw?.agents || [],
    },
    security: {
      summary: payload.openclaw_audit?.summary || { critical: 0, warn: 0, info: 0 },
      findings: payload.openclaw_audit?.findings || [],
    },
    source: statMeta(state.path, payload.generated_at || ""),
  };
}

function buildAiTelemetry() {
  const exportState = readJsonFirst([aiTelemetryExportPath], {
    retrieval_quality: { status: "missing" },
    code_context_search: { status: "missing" },
    skill_registry: { status: "missing" },
    skill_usage: { status: "missing" },
    codex_productivity: { status: "missing" },
    token_context_waste: { status: "missing" },
    model_routing: { status: "missing" },
    tool_usage: { status: "missing" },
    ai_response: { status: "missing" },
    ai_response_usage: { status: "missing" },
    prompt_cache_efficiency: { status: "missing" },
    cost_by_model: { status: "missing", entries: [] },
    cost_by_goal: { status: "missing", entries: [] },
    tokens_per_verified_run: { status: "missing" },
    budget_drift: { status: "missing" },
    research: { status: "missing" },
    memory: { status: "missing" },
    token_governor: { status: "missing" },
    hermes_runtime: { status: "missing", state: "missing", installed: false, fallback_used: false, state_counts: [] },
    agent_trace: { status: "missing" },
    cache_ledger: { status: "missing" },
    redundant_work: { status: "missing" },
    token_economy: { status: "missing" },
    account_analytics: { status: "missing" },
    token_economy_report: { status: "missing" },
    failure_aware_observability: { status: "missing" },
    guardrail_events: { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    ai_activity_explorer: {
      status: "missing",
      overview: { status: "missing" },
      trends: { status: "missing" },
      explore: { status: "missing" },
      guardrails: { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    },
    recent_events: [],
  });
  const sanitizedPayload = sanitizeSensitiveExportMetadata(exportState.payload || {});
  return {
    generatedAt: sanitizedPayload.generated_at || "",
    retrievalQuality: sanitizedPayload.retrieval_quality || { status: "missing" },
    codeContextSearch: sanitizedPayload.code_context_search || { status: "missing" },
    skillRegistry: sanitizedPayload.skill_registry || { status: "missing" },
    skillUsage: sanitizedPayload.skill_usage || { status: "missing" },
    codexProductivity: sanitizedPayload.codex_productivity || { status: "missing" },
    tokenContextWaste: sanitizedPayload.token_context_waste || { status: "missing" },
    modelRouting: sanitizedPayload.model_routing || { status: "missing" },
    toolUsage: sanitizedPayload.tool_usage || { status: "missing" },
    aiResponse: sanitizedPayload.ai_response || { status: "missing" },
    aiResponseUsage: sanitizedPayload.ai_response_usage || { status: "missing" },
    promptCacheEfficiency: sanitizedPayload.prompt_cache_efficiency || { status: "missing" },
    costByModel: sanitizedPayload.cost_by_model || { status: "missing", entries: [] },
    costByGoal: sanitizedPayload.cost_by_goal || { status: "missing", entries: [] },
    tokensPerVerifiedRun: sanitizedPayload.tokens_per_verified_run || { status: "missing" },
    budgetDrift: sanitizedPayload.budget_drift || { status: "missing" },
    research: sanitizedPayload.research || { status: "missing" },
    memory: sanitizedPayload.memory || { status: "missing" },
    tokenGovernor: sanitizedPayload.token_governor || { status: "missing" },
    hermesRuntime: sanitizedPayload.hermes_runtime || { status: "missing", state: "missing", installed: false, fallback_used: false, state_counts: [] },
    agentTrace: sanitizedPayload.agent_trace || { status: "missing" },
    cacheLedger: sanitizedPayload.cache_ledger || { status: "missing" },
    redundantWork: sanitizedPayload.redundant_work || { status: "missing" },
    tokenEconomy: sanitizedPayload.token_economy || { status: "missing" },
    accountAnalytics: sanitizedPayload.account_analytics || { status: "missing" },
    tokenEconomyReport: sanitizedPayload.token_economy_report || { status: "missing" },
    failureAwareObservability: sanitizedPayload.failure_aware_observability || { status: "missing" },
    guardrailEvents: sanitizedPayload.guardrail_events || { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    aiActivityExplorer: sanitizedPayload.ai_activity_explorer || {
      status: "missing",
      overview: { status: "missing" },
      trends: { status: "missing" },
      explore: { status: "missing" },
      guardrails: { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    },
    recentEvents: sanitizedPayload.recent_events || [],
    source: statMeta(exportState.path, sanitizedPayload.generated_at || ""),
  };
}

function buildCodexHistory() {
  const exportState = readJsonFirst([codexHistorySummaryPath], { schema_version: "v1", runs: [] });
  const payload = sanitizeSensitiveExportMetadata(exportState.payload || {});
  return {
    status: exportState.path ? "ok" : "missing",
    schemaVersion: payload.schema_version || "v1",
    generatedAt: payload.generated_at || "",
    source: statMeta(exportState.path, payload.generated_at || ""),
    sourceOfTruth: payload.source_of_truth || "normalized-codex-history-metadata",
    runs: Array.isArray(payload.runs) ? payload.runs : [],
  };
}

function buildCommercialReadiness() {
  const report = readJsonFirst([commercialReadinessPath], {});
  const productIntel = readJsonFirst([productIntelPath], {});
  const productOperatingStandard = readJsonFirst([productOperatingStandardPath], {});
  const revenueAutopilot = readJsonFirst([revenueAutopilotPath], {});
  return {
    generatedAt: report.payload?.generated_at || new Date().toISOString(),
    overallStatus: report.payload?.overall_status || "unknown",
    hostHealth: report.payload?.host_health || "unknown",
    blockedByHostHealth: Boolean(report.payload?.blocked_by_host_health),
    score: Number(report.payload?.score || 0),
    targetProduct: report.payload?.target_product || {
      id: "unknown",
      title: "unknown",
      path: "",
      monetization_label: "technical-only",
      money_path: [],
    },
    targetProducts: report.payload?.target_products || [],
    monetizationLabel: report.payload?.monetization_label || report.payload?.target_product?.monetization_label || "technical-only",
    moneyPath: report.payload?.money_path || report.payload?.target_product?.money_path || [],
    topMoneyBlockers: report.payload?.top_money_blockers || [],
    topOwnerBlockers: report.payload?.top_owner_blockers || [],
    nextMoneyAction: report.payload?.next_money_action || report.payload?.next_exact_action || "",
    monetizationStatus: report.payload?.monetization_status || {},
    monetizationPriorityPath: report.payload?.monetization_priority_path || productIntel.payload?.monetization_priority_path || "",
    firstMoneyContractPath: report.payload?.first_money_operating_contract_path || productIntel.payload?.first_money_operating_contract_path || "",
    firstMoney: report.payload?.first_money || { status: "missing", primary_offer: {}, readiness: { current_state: "missing", reasons: [] }, verified_blockers: [], owner_required_blockers: [], aggregate_funnel_counters: { status: "missing", counters: {} }, active_experiment: {}, next_exact_revenue_action: "" },
    firstMoneySummary: report.payload?.first_money_summary || {},
    summary: {
      implemented: Number(report.payload?.summary?.implemented || 0),
      scaffolded: Number(report.payload?.summary?.scaffolded || 0),
      missing: Number(report.payload?.summary?.missing || 0),
      dirtyFocusRepos: Number(report.payload?.summary?.dirty_focus_repos || 0),
      highRiskBlockers: Number(report.payload?.summary?.high_risk_blockers || 0),
    },
    nextAction: report.payload?.next_exact_action || "",
    highRiskBlockers: report.payload?.high_risk_blockers || [],
    checks: report.payload?.checks || [],
    atlasExport: report.payload?.atlas_export || {
      safe_to_expose: true,
      section_label: "Commercial Readiness",
      endpoint_hint: "/api/commercial-readiness",
      source_path: commercialReadinessPath,
    },
    focusRepos: productIntel.payload?.focus_repos || [],
    source: statMeta(report.path, report.payload?.generated_at || ""),
    productIntelSource: statMeta(productIntel.path, productIntel.payload?.generated_at || ""),
    productOperatingStandard: productOperatingStandard.payload?.safe_to_expose === true ? productOperatingStandard.payload : null,
    productOperatingStandardSource: statMeta(productOperatingStandard.path, productOperatingStandard.payload?.generated_at || ""),
    revenueAutopilot: normalizeRevenueAutopilot(revenueAutopilot.payload),
    revenueAutopilotSource: statMeta(revenueAutopilot.path, revenueAutopilot.payload?.generated_at || ""),
  };
}

function buildOperationPolicy() {
  const record = readJsonFirst([operationPolicySummaryPath], {});
  const payload = sanitizeSensitiveExportMetadata(record.payload || {});
  return {
    status: record.path ? "recorded" : "not_evaluated",
    decision: payload.decision || "not_evaluated",
    mode: payload.mode || "observe",
    enforcement: payload.enforcement || "record_only",
    reasons: payload.reasons || [],
    requiredChecks: payload.required_checks || [],
    evidenceFreshness: payload.evidence_freshness || "unknown",
    source: statMeta(record.path, payload.evaluated_at || ""),
  };
}

function buildLocalAgentPlatform() {
  const record = readJsonFirst([localAgentPlatformPath], {});
  const payload = sanitizeSensitiveExportMetadata(record.payload || {});
  return {
    ...normalizeLocalAgentPlatform(payload),
    sourceArtifact: statMeta(record.path, payload.generated_at || ""),
    readOnly: true,
    commandGateway: "codex-orchestrator-policy-boundary",
  };
}

function systemSnapshot() {
  const issues = run("bash", ["-lc", `${home}/__home_organized/scripts/system-issues-report.sh --compact`]);
  const running = run("systemctl", ["is-system-running"]);
  const gpu = run("nvidia-smi", [
    "--query-gpu=temperature.gpu,memory.used,memory.total,utilization.gpu",
    "--format=csv,noheader,nounits",
  ]);
  const disk = run("df", ["-BG", "/"]);
  const hypr = run("hyprctl", ["instances"]);
  const systemIndex = readText(path.join(home, "Desktop", "Obsidian", "System", "System Health", "index.md"));
  const gpuIndex = readText(path.join(home, "Desktop", "Obsidian", "System", "GPU Health", "index.md"));

  const safeMode = issues.includes("Safe mode active         YES") || issues.includes("safe-mode YES");
  const overallMatch = issues.match(/overall\s+(ok|degraded|unavailable)/);
  const gpuParts = gpu.split(",").map((part) => part.trim());
  const diskLine = disk.split(/\r?\n/)[1] ?? "";
  const diskUseMatch = diskLine.match(/(\d+)%/);
  const topIssueMatch = issues.match(/• Top current issue: (.+)/);
  const bundlePathMatch = issues.match(/bundle path\s+(.+)/);
  const watchdogReasonMatch = issues.match(/System watchdog reason\s+(.+)/);
  const systemNoteDate = systemIndex.match(/\[\[System\/System Health\/(\d{4}-\d{2}-\d{2})\|\1\]\]/)?.[1];
  const gpuNoteDate = gpuIndex.match(/\[\[System\/GPU Health\/(\d{4}-\d{2}-\d{2})\|\1\]\]/)?.[1];
  const systemNote = systemNoteDate
    ? readText(path.join(home, "Desktop", "Obsidian", "System", "System Health", `${systemNoteDate}.md`))
    : "";
  const gpuNote = gpuNoteDate
    ? readText(path.join(home, "Desktop", "Obsidian", "System", "GPU Health", `${gpuNoteDate}.md`))
    : "";
  const notedSystemStatus = systemNote.match(/- Status: `([^`]+)`/)?.[1] ?? "";
  const notedSystemReason = systemNote.match(/- Reason: `([^`]+)`/)?.[1] ?? "";
  const notedGpuReason = gpuNote.match(/- Reason: `([^`]+)`/)?.[1] ?? "";
  const hyprRuntimePath = path.join("/run/user", String(process.getuid?.() ?? 1000), "hypr");

  return {
    systemStatus: running || overallMatch?.[1] || notedSystemStatus || "unknown",
    overall: overallMatch?.[1] ?? "unknown",
    safeMode,
    hyprlandOnline: Boolean(hypr.trim()) || fileExists(hyprRuntimePath),
    topIssue: topIssueMatch?.[1] ?? notedSystemReason ?? "No highlighted issue",
    gpu: {
      temperature: Number(gpuParts[0] ?? 0),
      memoryUsed: Number(gpuParts[1] ?? 0),
      memoryTotal: Number(gpuParts[2] ?? 0),
      utilization: Number(gpuParts[3] ?? 0),
    },
    diskRootPercent: Number(diskUseMatch?.[1] ?? 0),
    gpuNote: notedGpuReason,
    bundlePath: bundlePathMatch?.[1]?.trim() ?? "",
    watchdogReason: watchdogReasonMatch?.[1]?.trim() ?? "",
  };
}

function buildHostAudit(system, localAiControl) {
  const hostname = run("hostnamectl", ["--static"]) || run("hostname", []);
  const uname = run("uname", ["-a"]);
  const osRelease = readText("/etc/os-release");
  const prettyName = osRelease.match(/^PRETTY_NAME=(.+)$/m)?.[1]?.replace(/^"|"$/g, "") ?? "";
  const atlasRepo = path.join(home, "Desktop", "project-atlas");
  const roots = [
    { id: "project-atlas", path: atlasRepo, type: "repo" },
    { id: "local-codex-stack", path: path.join(home, "__home_organized", "local-codex-stack"), type: "repo" },
    { id: "runtime-local-codex-stack", path: canonicalLocalCodexRuntime, type: "runtime" },
    { id: "codex-orchestrator", path: path.join(home, "codex-orchestrator"), type: "repo" },
    { id: "obsidian", path: path.join(home, "Desktop", "Obsidian"), type: "repo" },
    { id: "elizabet", path: path.join(home, "Desktop", "server", "elizabet"), type: "repo" },
  ];
  const repos = roots.map((entry) => {
    if (!fileExists(entry.path)) {
      return { ...entry, present: false, dirtyCount: null, branch: "", note: "missing" };
    }
    if (entry.type === "repo" && fileExists(path.join(entry.path, ".git"))) {
      const short = run("git", ["status", "--short"], entry.path);
      return {
        ...entry,
        present: true,
        branch: run("git", ["rev-parse", "--abbrev-ref", "HEAD"], entry.path),
        dirtyCount: short ? short.split(/\r?\n/).filter(Boolean).length : 0,
        note: "",
      };
    }
    const children = fs.readdirSync(entry.path).length;
    return {
      ...entry,
      present: true,
      branch: "",
      dirtyCount: null,
      note: `${children} entries`,
    };
  });
  const healthState = readJsonFirst([agentHealthStatePath], {});
  const dfRoot = run("df", ["-h", "/"]);
  const dfBoot = run("df", ["-h", "/boot"]);
  const hyprInstances = run("hyprctl", ["instances"]);
  const gpuRaw = run("nvidia-smi", [
    "--query-gpu=name,driver_version,memory.used,memory.total,temperature.gpu,pstate,utilization.gpu",
    "--format=csv,noheader,nounits",
  ]);
  const audit = {
    generatedAt: new Date().toISOString(),
    hostname,
    kernel: uname,
    os: prettyName,
    overall: system.overall,
    safeMode: system.safeMode,
    hyprlandOnline: system.hyprlandOnline,
    topIssue: system.topIssue,
    issueBundlePath: system.bundlePath,
    watchdogReason: system.watchdogReason,
    gpu: {
      ...system.gpu,
      raw: gpuRaw,
      note: system.gpuNote,
    },
    disk: {
      rootPercent: system.diskRootPercent,
      root: dfRoot,
      boot: dfBoot,
    },
    hyprland: {
      instances: hyprInstances,
    },
    services: localAiControl.runtimes,
    modelRoles: localAiControl.recommendations,
    activeModels: localAiControl.activeModels.map((item) => item.name),
    gemma4: localAiControl.gemma4,
    openclawSecurity: localAiControl.security.summary,
    codexOrchestrator: (localAiControl.runtimes || []).find((item) => item.id === "codex-orchestrator") || null,
    atlas: localAiControl.atlas,
    repos,
    blockers: localAiControl.blockers,
    sourcePaths: {
      localAiControl: localAiStatePath,
      healthGate: agentHealthStatePath,
      bundle: system.bundlePath || "",
    },
    healthGate: healthState.payload || {},
  };

  fs.mkdirSync(path.dirname(hostAuditOutputPath), { recursive: true });
  fs.writeFileSync(hostAuditOutputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  return {
    ...audit,
    source: statMeta(hostAuditOutputPath, audit.generatedAt),
  };
}

const inventory = injectOverrideRepos(parseInventory(readText(inventoryPath)));
const projects = inventory
  .map(summarizeRepo)
  .sort((left, right) => {
    if (left.focus !== right.focus) {
      return Number(right.focus) - Number(left.focus);
    }
    return (right.lastCommit.timestamp || 0) - (left.lastCommit.timestamp || 0);
  });

const tasks = projects.flatMap((project) => project.tasks);
const focusProjects = projects.filter((project) => project.focus && project.position);
const recentCommits = projects
  .filter((project) => project.lastCommit.timestamp)
  .slice()
  .sort((left, right) => right.lastCommit.timestamp - left.lastCommit.timestamp)
  .slice(0, 8)
  .map((project) => ({
    project: project.name,
    title: project.title,
    sha: project.lastCommit.sha,
    subject: project.lastCommit.subject,
    timestamp: project.lastCommit.timestamp,
    branch: project.branch,
  }));

const domainCounts = projects.reduce((accumulator, project) => {
  accumulator[project.domain] = (accumulator[project.domain] ?? 0) + 1;
  return accumulator;
}, {});

const doneTasks = tasks.filter((task) => task.status === "done").length;
const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
const activeTasks = tasks.filter((task) => task.status === "active").length;
const reviewTasks = tasks.filter((task) => task.status === "review").length;
const system = systemSnapshot();
const localCodexLab = buildLocalCodexLab();
const localAiControl = buildLocalAiControl();
const aiTelemetry = buildAiTelemetry();
const codexHistory = buildCodexHistory();
const commercialReadiness = buildCommercialReadiness();
const operationPolicy = buildOperationPolicy();
const localAgentPlatform = buildLocalAgentPlatform();
const hostAudit = buildHostAudit(system, localAiControl);
const administration = buildAdministration();

const snapshot = {
  generatedAt: new Date().toISOString(),
  focusProjectIds: focusProjects.map((project) => project.id),
  summary: {
    totalRepos: projects.length,
    focusRepos: focusProjects.length,
    dirtyRepos: projects.filter((project) => project.dirtyCount > 0).length,
    deployConfigured: projects.filter((project) => project.commands.deploy).length,
    activeTasks,
    blockedTasks,
    completedTasks: doneTasks,
    weeklyVelocity: Math.max(-12, Math.min(32, (doneTasks - blockedTasks * 2 + reviewTasks + activeTasks) * 4)),
    deployPulse: focusProjects.map((project) => Math.max(2, Math.round(project.metrics.signal / 10))),
    domainCounts,
  },
  system,
  hostAudit,
  projects,
  tasks,
  recentCommits,
  localCodexLab,
  localAiControl,
  aiTelemetry,
  codexHistory,
  commercialReadiness,
  operationPolicy,
  localAgentPlatform,
  administration,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
