import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync as defaultExecFileSync } from "node:child_process";

const home = "/home/goringich";

export const defaultTargetsPath = path.join(
  home,
  "__home_organized",
  "local-codex-stack",
  "configs",
  "targets.json",
);
export const defaultLocalAgentRunScript = path.join(home, ".local", "bin", "local-agent-run");
export const defaultLocalAgentExecScript = path.join(home, ".local", "bin", "local-agent-exec");

function text(value, limit = 12000) {
  return String(value ?? "").trim().slice(0, limit);
}

function readTargets(options = {}) {
  const targetsPath = options.targetsPath || defaultTargetsPath;
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  } catch (error) {
    throw new Error(
      `project registry is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
  if (matches.length === 0) {
    throw new Error(unsupportedMessage);
  }
  if (matches.length > 1) {
    throw new Error(ambiguousMessage);
  }
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
    throw new Error(
      `project target mismatch: id ${byId.id} does not own ${resolvedPath}`,
    );
  }
  const byPath = resolvedPath
    ? singleMatch(
        targets.filter((target) => target.path === resolvedPath),
        `unsupported project path: ${resolvedPath}`,
        `ambiguous project path in registry: ${resolvedPath}`,
      )
    : null;

  if (byId && byPath && byId.id !== byPath.id) {
    throw new Error(
      `project target mismatch: id ${byId.id} does not own ${resolvedPath}`,
    );
  }

  return byId || byPath;
}

export function selectProjectTarget(input = {}, options = {}) {
  const preferredProjectId = text(input.preferredProjectId, 160);
  if (preferredProjectId) {
    return resolveProjectTarget({ projectId: preferredProjectId }, options);
  }

  const targets = readTargets(options);
  const scores = new Map(targets.map((target) => [target.id, 0]));
  const focusFiles = Array.isArray(input.focusFiles) ? input.focusFiles : [];

  for (const entry of focusFiles) {
    if (typeof entry !== "string" || !entry.trim()) {
      continue;
    }
    const resolved = path.resolve(entry);
    const matches = targets
      .filter(
        (target) =>
          resolved === target.path || resolved.startsWith(`${target.path}${path.sep}`),
      )
      .sort((left, right) => right.path.length - left.path.length);
    if (matches[0]) {
      scores.set(matches[0].id, (scores.get(matches[0].id) || 0) + 1);
    }
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

  if (ranked[0]?.score > 0) {
    return ranked[0].target;
  }

  return resolveProjectTarget(
    { projectId: text(input.fallbackProjectId, 160) || "project-atlas" },
    options,
  );
}

function isInsideProject(targetPath, projectRoot) {
  const resolved = path.resolve(targetPath);
  return resolved === projectRoot || resolved.startsWith(`${projectRoot}${path.sep}`);
}

function normalizeFocusFiles(payload, target) {
  const focusFiles = Array.isArray(payload.focusFiles) ? payload.focusFiles : [];
  return [
    ...new Set(
      focusFiles
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => path.resolve(entry))
        .filter((entry) => isInsideProject(entry, target.path)),
    ),
  ].slice(0, 12);
}

function commandText(command) {
  return command.map((part) => part.trim()).filter(Boolean).join(" ");
}

function normalizeVerificationCommands(payload, target) {
  const allowed = new Set(target.allowedVerifyCommands.map(commandText));
  const requested = Array.isArray(payload.verificationCommands)
    ? payload.verificationCommands
        .filter((entry) => typeof entry === "string")
        .map((entry) => text(entry, 2000))
        .filter(Boolean)
    : [];
  const selected = requested.filter((entry) => allowed.has(entry));
  return selected.length ? selected.slice(0, 12) : [...allowed].slice(0, 12);
}

function buildTaskDocument(payload, target, focusFiles, verificationCommands) {
  const task = text(payload.task || payload.prompt, 12000);
  return [
    "Task prepared by Project Atlas through the governed local-agent control plane.",
    "",
    `Registered project: ${target.id} (${target.title})`,
    `Repository root: ${target.path}`,
    `Work item: ${text(payload.workItemId, 160)}`,
    "",
    "Requested task:",
    task,
    "",
    "Focus files inside the registered project:",
    ...(focusFiles.length ? focusFiles.map((entry) => `- ${entry}`) : ["- none"]),
    "",
    "Registry-approved verification commands:",
    ...(verificationCommands.length
      ? verificationCommands.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "Keep changes inside the registered repository. Do not deploy, publish, push, or read secret-bearing paths unless a later, explicitly approved operation authorizes it.",
  ].join("\n");
}

function parseJsonOutput(command, stdout) {
  try {
    const payload = JSON.parse(String(stdout || "").trim());
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("expected a JSON object");
    }
    return payload;
  } catch (error) {
    throw new Error(
      `${path.basename(command)} returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function runJsonCommand(execFileSync, command, args, cwd) {
  let stdout;
  try {
    stdout = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
  } catch (error) {
    const detail = text(error?.stderr || error?.stdout || error?.message, 2000);
    throw new Error(
      `${path.basename(command)} failed${detail ? `: ${detail}` : ""}`,
    );
  }
  return parseJsonOutput(command, stdout);
}

export function dispatchGovernedAgentTask(payload = {}, options = {}) {
  const target = resolveProjectTarget(payload, options);
  const task = text(payload.task || payload.prompt, 12000);
  if (!task) {
    throw new Error("task is required");
  }
  const workItemId = text(payload.workItemId, 160);
  if (!workItemId) {
    throw new Error("workItemId from the prepare response is required");
  }

  const focusFiles = normalizeFocusFiles(payload, target);
  const verificationCommands = normalizeVerificationCommands(payload, target);
  const enforcePolicy = options.enforcePolicy;
  if (typeof enforcePolicy !== "function") {
    throw new Error("blocking operation policy is required");
  }

  const policyDecision = enforcePolicy({
    operation: "atlas_codex_enqueue",
    actor: "atlas",
    initiating_surface: "atlas",
    repository: target.id,
    product: "local-ai-os",
    work_item_id: workItemId,
    autonomy_level: "plan",
    risk: "low",
    intended_write_roots: [
      path.join(home, "__home_organized", "runtime", "local-codex-stack"),
      path.join(home, "__home_organized", "runtime", "codex-orchestrator"),
    ],
    network_targets: [],
    deploy_or_publication_target: "",
    approval_reference: "",
    dry_run: false,
    evidence: {
      freshness: "fresh",
      source_paths: focusFiles,
    },
  });
  if (
    policyDecision?.decision !== "allow" ||
    policyDecision?.enforcement !== "blocking"
  ) {
    throw new Error("operation policy did not return a blocking allow decision");
  }

  const execFileSync = options.execFileSync || defaultExecFileSync;
  const localAgentRunScript =
    options.localAgentRunScript || defaultLocalAgentRunScript;
  const localAgentExecScript =
    options.localAgentExecScript || defaultLocalAgentExecScript;
  const tempRoot = options.tempRoot || os.tmpdir();
  const privateDir = fs.mkdtempSync(
    path.join(tempRoot, "atlas-agent-dispatch-"),
  );
  fs.chmodSync(privateDir, 0o700);
  const taskFile = path.join(privateDir, "task.md");

  try {
    fs.writeFileSync(
      taskFile,
      buildTaskDocument({ ...payload, task, workItemId }, target, focusFiles, verificationCommands),
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    fs.chmodSync(taskFile, 0o600);

    const prepared = runJsonCommand(
      execFileSync,
      localAgentRunScript,
      ["--repo", target.id, "--task-file", taskFile],
      target.path,
    );
    const runId = text(prepared.run_id, 240);
    if (!runId) {
      throw new Error("local-agent-run response did not include run_id");
    }

    const dispatched = runJsonCommand(
      execFileSync,
      localAgentExecScript,
      ["--run-id", runId, "--agent", "codex", "--dispatch", "queue"],
      target.path,
    );
    if (text(dispatched.run_id, 240) !== runId) {
      throw new Error("local-agent-exec response run_id did not match the prepared run");
    }

    const queueTaskId = text(dispatched.dispatch?.queue_task_id, 240);
    const queueTaskPath = text(dispatched.dispatch?.queue_task_path, 2000);
    if (!queueTaskId || !queueTaskPath) {
      throw new Error("local-agent-exec response did not include queue task identifiers");
    }

    const reportPath = text(
      dispatched.run_report_path || prepared.run_report_path,
      2000,
    );
    return {
      mode: "governed-queue",
      projectId: target.id,
      projectTitle: target.title,
      projectPath: target.path,
      title: text(payload.title, 120) || `${target.title} governed task`,
      workdir: target.path,
      runId,
      reportId: text(dispatched.report_id || prepared.report_id, 240) || runId,
      queueTaskId,
      runStatus: text(prepared.status, 120),
      dispatchStatus: text(dispatched.status, 120),
      reportPath,
      queueTaskPath,
      taskPath: queueTaskPath,
      contextPackPath: text(
        dispatched.context_pack_path || prepared.context_pack_path,
        2000,
      ),
      checksPath: text(prepared.checks_path, 2000),
      diffPath: text(prepared.diff_path, 2000),
      atlasExportPath: text(
        dispatched.atlas_export_path || prepared.atlas_export_path,
        2000,
      ),
      controlPlanePath: text(
        dispatched.control_plane_path || prepared.control_plane_path,
        2000,
      ),
      policyDecision: {
        schemaVersion: text(policyDecision.schema_version, 120),
        decision: text(policyDecision.decision, 80),
        enforcement: text(policyDecision.enforcement, 80),
        workItemId: text(policyDecision.input?.work_item_id, 160),
      },
    };
  } finally {
    fs.rmSync(privateDir, { recursive: true, force: true });
  }
}
