import fs from "node:fs";
import path from "node:path";

const home = "/home/goringich";

export const defaultTargetsPath = path.join(
  home,
  "__home_organized",
  "local-codex-stack",
  "configs",
  "targets.json",
);

function text(value, limit = 12000) {
  return String(value ?? "").trim().slice(0, limit);
}

function readTargets(options = {}) {
  const targetsPath = options.targetsPath || defaultTargetsPath;
  const payload = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  if (!Array.isArray(payload?.repos) || payload.repos.length === 0) {
    throw new Error("project registry has no supported repositories");
  }
  return payload.repos.map((entry) => {
    const id = text(entry?.id, 160);
    const targetPath = text(entry?.path, 2000);
    if (!id || !path.isAbsolute(targetPath)) {
      throw new Error("project registry contains an invalid repository target");
    }
    return {
      id,
      title: text(entry?.title || id, 240),
      type: text(entry?.type, 80),
      path: path.resolve(targetPath),
      sourceNote: text(entry?.source_note, 2000),
      allowedVerifyCommands: Array.isArray(entry?.allowed_verify_commands)
        ? entry.allowed_verify_commands
            .filter((command) => Array.isArray(command) && command.length > 0)
            .map((command) => command.map((part) => text(part, 1000)))
        : [],
    };
  });
}

function singleMatch(matches, unsupportedMessage, ambiguousMessage) {
  if (matches.length === 0) throw new Error(unsupportedMessage);
  if (matches.length > 1) throw new Error(ambiguousMessage);
  return matches[0];
}

export function resolveProjectTarget(input = {}, options = {}) {
  const targets = readTargets(options);
  const projectId = text(input.projectId, 160);
  const requestedPath = text(input.workdir, 2000);

  if (!projectId && !requestedPath) {
    throw new Error("projectId or an exact registered workdir is required");
  }

  const byId = projectId
    ? singleMatch(
        targets.filter((target) => target.id === projectId),
        `unsupported project id: ${projectId}`,
        `ambiguous project id in registry: ${projectId}`,
      )
    : null;

  const resolvedPath = requestedPath ? path.resolve(requestedPath) : "";
  if (byId && resolvedPath && byId.path !== resolvedPath) {
    throw new Error(`project target mismatch: id ${byId.id} does not own ${resolvedPath}`);
  }

  const byPath = resolvedPath
    ? singleMatch(
        targets.filter((target) => target.path === resolvedPath),
        `unsupported project path: ${resolvedPath}`,
        `ambiguous project path in registry: ${resolvedPath}`,
      )
    : null;

  if (byId && byPath && byId.id !== byPath.id) {
    throw new Error(`project target mismatch: id ${byId.id} does not own ${resolvedPath}`);
  }
  return byId || byPath;
}

export function selectProjectTarget(input = {}, options = {}) {
  const preferredProjectId = text(input.preferredProjectId, 160);
  if (preferredProjectId) {
    return resolveProjectTarget({ projectId: preferredProjectId }, options);
  }

  const targets = readTargets(options);
  const focusFiles = Array.isArray(input.focusFiles) ? input.focusFiles : [];
  const scores = new Map(targets.map((target) => [target.id, 0]));

  for (const entry of focusFiles) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const resolved = path.resolve(entry);
    const match = targets
      .filter(
        (target) =>
          resolved === target.path || resolved.startsWith(`${target.path}${path.sep}`),
      )
      .sort((left, right) => right.path.length - left.path.length)[0];
    if (match) scores.set(match.id, (scores.get(match.id) || 0) + 1);
  }

  const ranked = targets
    .map((target, index) => ({
      target,
      score: scores.get(target.id) || 0,
      index,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.target.path.length - left.target.path.length ||
        left.index - right.index,
    );

  if (ranked[0]?.score > 0) return ranked[0].target;
  return resolveProjectTarget(
    { projectId: text(input.fallbackProjectId, 160) || "project-atlas" },
    options,
  );
}

export function prepareGovernedAgentTask(payload = {}, options = {}) {
  const target = resolveProjectTarget(payload, options);
  const task = text(payload.task || payload.prompt, 12000);
  const workItemId = text(payload.workItemId, 160);
  if (!task) throw new Error("task is required");
  if (!workItemId) throw new Error("workItemId is required");

  const focusFiles = [...new Set(
    (Array.isArray(payload.focusFiles) ? payload.focusFiles : [])
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => path.resolve(entry))
      .filter(
        (entry) =>
          entry === target.path || entry.startsWith(`${target.path}${path.sep}`),
      ),
  )].slice(0, 12);

  return {
    mode: "prepared-only",
    projectId: target.id,
    projectTitle: target.title,
    projectPath: target.path,
    workItemId,
    task,
    focusFiles,
    executionAuthority: "single-governed-producer",
    ownerActionRequired: true,
    queueCreated: false,
    nextAction:
      "Submit the prepared request through the governed producer after owner approval.",
  };
}
