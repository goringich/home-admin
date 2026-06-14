import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const home = os.homedir();
const rootDir = path.join(home, "Desktop", "project-atlas");
const inventoryPath = path.join(home, "system-bootstrap", "docs", "repo-inventory.md");
const overridesPath = path.join(rootDir, "data", "project-overrides.json");
const outputPath = path.join(rootDir, "public", "snapshot.json");
const canonicalLocalCodexRuntime = path.join(home, "__home_organized", "runtime", "local-codex-stack");
const legacyLocalCodexRuntime = path.join(home, "__home_organized", "local-codex-stack", "runtime", "local-codex-stack");
const localCodexAtlasPath = path.join(home, "__home_organized", "local-codex-stack", "atlas", "local-codex-lab.json");
const localAiStatePath = path.join(home, "__home_organized", "runtime", "local-ai-control", "state.json");
const agentHealthStatePath = path.join(home, "__home_organized", "runtime", "agent-health-gate", "state.json");
const hostAuditOutputPath = path.join(canonicalLocalCodexRuntime, "host-audit-latest.json");
const aiTelemetryExportPath = path.join(home, "__home_organized", "runtime", "ai-telemetry", "exports", "atlas.json");
const commercialReadinessPath = path.join(canonicalLocalCodexRuntime, "commercial-readiness.json");
const productIntelPath = path.join(canonicalLocalCodexRuntime, "product-intel.json");

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
  const lab = readJsonFirst([localCodexAtlasPath], {});
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

  return {
    generatedAt: lab.payload?.generated_at || new Date().toISOString(),
    hostHealth: lab.payload?.host_health || "unknown",
    source: statMeta(lab.path, lab.payload?.generated_at || ""),
    modelRouting: {
      fast: lab.payload?.fast_model || "unknown",
      balanced: lab.payload?.balanced_model || "unknown",
      planning: lab.payload?.planning_model || "unknown",
      embedding: lab.payload?.embedding_model || "unknown",
      source: statMeta(lab.path, lab.payload?.generated_at || ""),
    },
    retrievalPolicy: {
      priorityOrder: retrievalPolicy.payload?.priority_order || [],
      denylistedClasses: retrievalPolicy.payload?.ordinary_retrieval_rules?.denylisted_classes || [],
      denylistedFiles: Number(retrievalPolicy.payload?.stats?.denylisted_files || 0),
      source: statMeta(retrievalPolicy.path, retrievalPolicy.payload?.generated_at || ""),
    },
    tokenEfficiency: {
      filesScanned: Number(tokenWaste.payload?.number_of_codex_conversation_files_scanned || 0),
      longGoalRuns: Number(tokenWaste.payload?.number_of_long_goal_runs || 0),
      bridgeNoiseFiles: Number(tokenWaste.payload?.number_of_bridge_smoke_no_answer_files || 0),
      repeatedHealthGateCount: Number(tokenWaste.payload?.repeated_health_gate_count || 0),
      filesWithNoAssistantReply: Number(tokenWaste.payload?.files_with_no_assistant_reply || 0),
      source: statMeta(tokenWaste.path, tokenWaste.payload?.generated_at || ""),
    },
    openclawReliability: {
      warningCount: Number(openclawReliability.payload?.summary?.warning_count || 0),
      status: openclawReliability.payload?.summary?.status || "unknown",
      classifications: openclawReliability.payload?.summary?.classifications || {},
      recommendedActions: openclawReliability.payload?.recommended_actions || [],
      source: statMeta(
        openclawReliability.path,
        openclawReliability.payload?.generated_at || "",
      ),
    },
    repoIntel: {
      targetCount: Number(repoIntel.payload?.target_count || 0),
      safeTargets: repoIntel.payload?.safe_targets || [],
      targets: (repoIntel.payload?.targets || []).map((entry) => ({
        repoId: entry.repo_id,
        title: entry.title,
        path: entry.path,
        dirtyCount: Number(entry.git?.dirty_count || 0),
        ahead: Number(entry.git?.ahead || 0),
        symbolCount: Number(entry.symbol_count || 0),
        testCount: Number(entry.test_count || 0),
        dependencyManifestCount: Number(entry.dependency_manifest_count || 0),
        source: statMeta(path.join(entry.canonical_dir || "", "repo-summary.json"), entry.generated_at || ""),
      })),
      source: statMeta(repoIntel.path, repoIntel.payload?.generated_at || ""),
    },
    research: {
      runCount: Number(researchSummary.payload?.research_run_count || 0),
      sourceCardCount: Number(researchSummary.payload?.source_card_count || 0),
      providers: researchSummary.payload?.providers || [],
      sourceDomains: researchSummary.payload?.source_domains || [],
      latestRun: researchSummary.payload?.latest_run || {},
      paths: researchSummary.payload?.paths || {},
      freshness: researchSummary.payload?.freshness || {},
      source: statMeta(researchSummary.path, researchSummary.payload?.generated_at || ""),
    },
    memory: {
      workspaceFocus: workspaceMemory.payload?.workspace_focus || "",
      activeGoalCount: Number(workspaceMemory.payload?.active_goal_count || 0),
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
      openclawWarningCount: Number(lab.payload?.failure_aware_observability?.openclaw_warning_count || 0),
      latestRunFailures: lab.payload?.failure_aware_observability?.latest_run_failures || [],
      sourcePaths: lab.payload?.failure_aware_observability?.source_paths || {},
      source: statMeta(lab.path, lab.payload?.generated_at || ""),
    },
    activeRuns: lab.payload?.active_runs || [],
    latestRunReports: lab.payload?.latest_run_reports || [],
    evalStatus: lab.payload?.eval_status || { status: "missing" },
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
  return {
    generatedAt: exportState.payload?.generated_at || "",
    retrievalQuality: exportState.payload?.retrieval_quality || { status: "missing" },
    codeContextSearch: exportState.payload?.code_context_search || { status: "missing" },
    skillRegistry: exportState.payload?.skill_registry || { status: "missing" },
    skillUsage: exportState.payload?.skill_usage || { status: "missing" },
    codexProductivity: exportState.payload?.codex_productivity || { status: "missing" },
    tokenContextWaste: exportState.payload?.token_context_waste || { status: "missing" },
    modelRouting: exportState.payload?.model_routing || { status: "missing" },
    toolUsage: exportState.payload?.tool_usage || { status: "missing" },
    aiResponse: exportState.payload?.ai_response || { status: "missing" },
    aiResponseUsage: exportState.payload?.ai_response_usage || { status: "missing" },
    promptCacheEfficiency: exportState.payload?.prompt_cache_efficiency || { status: "missing" },
    costByModel: exportState.payload?.cost_by_model || { status: "missing", entries: [] },
    costByGoal: exportState.payload?.cost_by_goal || { status: "missing", entries: [] },
    tokensPerVerifiedRun: exportState.payload?.tokens_per_verified_run || { status: "missing" },
    budgetDrift: exportState.payload?.budget_drift || { status: "missing" },
    research: exportState.payload?.research || { status: "missing" },
    memory: exportState.payload?.memory || { status: "missing" },
    tokenGovernor: exportState.payload?.token_governor || { status: "missing" },
    hermesRuntime: exportState.payload?.hermes_runtime || { status: "missing", state: "missing", installed: false, fallback_used: false, state_counts: [] },
    agentTrace: exportState.payload?.agent_trace || { status: "missing" },
    cacheLedger: exportState.payload?.cache_ledger || { status: "missing" },
    redundantWork: exportState.payload?.redundant_work || { status: "missing" },
    tokenEconomy: exportState.payload?.token_economy || { status: "missing" },
    accountAnalytics: exportState.payload?.account_analytics || { status: "missing" },
    tokenEconomyReport: exportState.payload?.token_economy_report || { status: "missing" },
    failureAwareObservability: exportState.payload?.failure_aware_observability || { status: "missing" },
    guardrailEvents: exportState.payload?.guardrail_events || { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    aiActivityExplorer: exportState.payload?.ai_activity_explorer || {
      status: "missing",
      overview: { status: "missing" },
      trends: { status: "missing" },
      explore: { status: "missing" },
      guardrails: { status: "ok", count: 0, by_type: [], by_status: [], recent_events: [], latest_event: {} },
    },
    recentEvents: exportState.payload?.recent_events || [],
    source: statMeta(exportState.path, exportState.payload?.generated_at || ""),
  };
}

function buildCommercialReadiness() {
  const report = readJsonFirst([commercialReadinessPath], {});
  const productIntel = readJsonFirst([productIntelPath], {});
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
    },
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
const commercialReadiness = buildCommercialReadiness();
const hostAudit = buildHostAudit(system, localAiControl);

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
  commercialReadiness,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
