import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const home = os.homedir();
const rootDir = path.join(home, "Desktop", "project-atlas");
const inventoryPath = path.join(home, "system-bootstrap", "docs", "repo-inventory.md");
const overridesPath = path.join(rootDir, "data", "project-overrides.json");
const outputPath = path.join(rootDir, "public", "snapshot.json");

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
  projects,
  tasks,
  recentCommits,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
