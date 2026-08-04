import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  dispatchGovernedAgentTask,
  resolveProjectTarget,
} from "./atlas-agent-dispatch.mjs";

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-agent-dispatch-test-"));
  const projectRoot = path.join(root, "project-atlas");
  const targetsPath = path.join(root, "targets.json");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(
    targetsPath,
    JSON.stringify({
      repos: [
        {
          id: "project-atlas",
          title: "Project Atlas",
          type: "system",
          path: projectRoot,
          allowed_verify_commands: [],
        },
      ],
    }),
  );
  return { root, projectRoot, targetsPath };
}

test("dispatch uses a private task file and the exact governed command sequence", () => {
  const fixture = createFixture();
  const calls = [];
  const policyCalls = [];
  const rawTask = "Implement the governed Atlas handoff without exposing this text in argv.";
  let taskFilePath = "";

  try {
    const result = dispatchGovernedAgentTask(
      {
        projectId: "project-atlas",
        workItemId: "atlas-work-item",
        task: rawTask,
        focusFiles: [path.join(fixture.projectRoot, "scripts", "atlas-host.mjs")],
        verificationCommands: ["npm test"],
      },
      {
        targetsPath: fixture.targetsPath,
        localAgentRunScript: "/tools/local-agent-run",
        localAgentExecScript: "/tools/local-agent-exec",
        tempRoot: fixture.root,
        enforcePolicy(input) {
          policyCalls.push(input);
          return {
            schema_version: "1",
            decision: "allow",
            enforcement: "blocking",
            input: { work_item_id: input.work_item_id },
          };
        },
        execFileSync(command, args) {
          calls.push({ command, args: [...args] });
          if (command === "/tools/local-agent-run") {
            taskFilePath = args[args.indexOf("--task-file") + 1];
            assert.equal(fs.statSync(path.dirname(taskFilePath)).mode & 0o777, 0o700);
            assert.equal(fs.statSync(taskFilePath).mode & 0o777, 0o600);
            assert.match(fs.readFileSync(taskFilePath, "utf8"), new RegExp(rawTask.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
            return JSON.stringify({
              run_id: "run-123",
              status: "prepared",
              run_report_path: "/runtime/run-reports/run-123.json",
              context_pack_path: "/runtime/agent-runs/run-123/context-pack.json",
              checks_path: "/runtime/agent-runs/run-123/checks.json",
              diff_path: "/runtime/agent-runs/run-123/diff.json",
            });
          }
          assert.equal(command, "/tools/local-agent-exec");
          return JSON.stringify({
            run_id: "run-123",
            status: "queued",
            run_report_path: "/runtime/run-reports/run-123.json",
            dispatch: {
              queue_task_id: "queue-456",
              queue_task_path: "/runtime/codex-orchestrator/queue/queue-456.task",
            },
          });
        },
      },
    );

    assert.deepEqual(calls[0], {
      command: "/tools/local-agent-run",
      args: ["--repo", "project-atlas", "--task-file", taskFilePath],
    });
    assert.deepEqual(calls[1], {
      command: "/tools/local-agent-exec",
      args: ["--run-id", "run-123", "--agent", "codex", "--dispatch", "queue"],
    });
    assert.equal(calls.some((call) => call.args.includes(rawTask)), false);
    assert.equal(policyCalls.length, 1);
    assert.equal(policyCalls[0].repository, "project-atlas");
    assert.equal(fs.existsSync(taskFilePath), false);
    assert.equal(result.runId, "run-123");
    assert.equal(result.reportId, "run-123");
    assert.equal(result.queueTaskId, "queue-456");
    assert.equal(result.reportPath, "/runtime/run-reports/run-123.json");
    assert.equal(result.queueTaskPath, "/runtime/codex-orchestrator/queue/queue-456.task");
    assert.equal(result.taskPath, result.queueTaskPath);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("project resolution accepts only registry ids or exact registered paths", () => {
  const fixture = createFixture();
  try {
    assert.equal(
      resolveProjectTarget({ projectId: "project-atlas" }, { targetsPath: fixture.targetsPath }).id,
      "project-atlas",
    );
    assert.equal(
      resolveProjectTarget({ workdir: fixture.projectRoot }, { targetsPath: fixture.targetsPath }).id,
      "project-atlas",
    );
    assert.throws(
      () => resolveProjectTarget({ projectId: "unknown" }, { targetsPath: fixture.targetsPath }),
      /unsupported project id/i,
    );
    assert.throws(
      () => resolveProjectTarget({ workdir: path.join(fixture.projectRoot, "nested") }, { targetsPath: fixture.targetsPath }),
      /unsupported project path/i,
    );
    assert.throws(
      () =>
        resolveProjectTarget(
          { projectId: "project-atlas", workdir: path.join(fixture.root, "other") },
          { targetsPath: fixture.targetsPath },
        ),
      /project target mismatch/i,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("unsafe project input fails before policy or command execution", () => {
  const fixture = createFixture();
  let policyCalled = false;
  let commandCalled = false;
  try {
    assert.throws(
      () =>
        dispatchGovernedAgentTask(
          {
            projectId: "unsupported-project",
            workItemId: "atlas-work-item",
            task: "This must fail closed.",
          },
          {
            targetsPath: fixture.targetsPath,
            tempRoot: fixture.root,
            enforcePolicy() {
              policyCalled = true;
              return {};
            },
            execFileSync() {
              commandCalled = true;
              return "{}";
            },
          },
        ),
      /unsupported project id/i,
    );
    assert.equal(policyCalled, false);
    assert.equal(commandCalled, false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("command failure removes the private task file and never reaches dispatch", () => {
  const fixture = createFixture();
  let taskFilePath = "";
  let commandCount = 0;

  try {
    assert.throws(
      () =>
        dispatchGovernedAgentTask(
          {
            projectId: "project-atlas",
            workItemId: "atlas-work-item",
            task: "Prepare this safely, then simulate a failed governed run.",
          },
          {
            targetsPath: fixture.targetsPath,
            localAgentRunScript: "/tools/local-agent-run",
            localAgentExecScript: "/tools/local-agent-exec",
            tempRoot: fixture.root,
            enforcePolicy() {
              return {
                schema_version: "1",
                decision: "allow",
                enforcement: "blocking",
                input: { work_item_id: "atlas-work-item" },
              };
            },
            execFileSync(command, args) {
              commandCount += 1;
              assert.equal(command, "/tools/local-agent-run");
              taskFilePath = args[args.indexOf("--task-file") + 1];
              const error = new Error("simulated command failure");
              error.stderr = "governed preparation failed";
              throw error;
            },
          },
        ),
      /local-agent-run failed: governed preparation failed/i,
    );
    assert.equal(commandCount, 1);
    assert.ok(taskFilePath);
    assert.equal(fs.existsSync(taskFilePath), false);
    assert.equal(fs.existsSync(path.dirname(taskFilePath)), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("Atlas source no longer invokes codex-agent-enqueue directly", () => {
  const hostSource = fs.readFileSync(new URL("./atlas-host.mjs", import.meta.url), "utf8");
  const snapshotSource = fs.readFileSync(new URL("./build-snapshot.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(hostSource, /codex-agent-enqueue/);
  assert.doesNotMatch(snapshotSource, /codex-agent-enqueue/);
  assert.match(hostSource, /local-agent-run/);
  assert.match(hostSource, /local-agent-exec/);
  assert.match(hostSource, /\/api\/local-agent\/dispatch/);
  assert.match(hostSource, /\/api\/codex-orchestrator\/enqueue/);
});
