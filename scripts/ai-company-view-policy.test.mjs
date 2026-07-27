import assert from "node:assert/strict";
import test from "node:test";
import {
  groupMissionTasks,
  missionTone,
  operationTone,
} from "../src/ai-company-view-policy.ts";


const trustedState = {
  availability: "available",
  freshness: "fresh",
  verification: "verified",
  dataClass: "real",
};

const achievedMission = {
  mission_id: "mission_1",
  status: "completed",
  implementation_status: "verified",
  outcome_status: "achieved",
  data_class: "real",
};


test("mission green requires real data plus fresh trusted root and mission section states", () => {
  assert.equal(missionTone(achievedMission, trustedState, trustedState), "ok");

  assert.equal(
    missionTone({ ...achievedMission, data_class: "fixture" }, trustedState, trustedState),
    "attention",
  );

  for (const [label, state] of [
    ["stale", { ...trustedState, freshness: "stale" }],
    ["unavailable", { ...trustedState, availability: "unavailable", freshness: "unavailable" }],
    ["unverified", { ...trustedState, verification: "unverified" }],
  ]) {
    assert.equal(missionTone(achievedMission, state, trustedState), "attention", `root ${label}`);
    assert.equal(missionTone(achievedMission, trustedState, state), "attention", `mission section ${label}`);
  }
});


test("failed mission remains risk even when projection trust is degraded", () => {
  assert.equal(
    missionTone(
      { ...achievedMission, status: "failed" },
      { ...trustedState, verification: "unverified" },
      trustedState,
    ),
    "risk",
  );
});


test("commercial operations only render success for fresh verified real data", () => {
  assert.equal(operationTone(trustedState), "ok");
  assert.equal(operationTone({ ...trustedState, dataClass: "unknown" }), "attention");
  assert.equal(operationTone({ ...trustedState, freshness: "stale" }), "attention");
  assert.equal(operationTone({ ...trustedState, verification: "unknown" }), "attention");
  assert.equal(
    operationTone({
      ...trustedState,
      availability: "unavailable",
      freshness: "unavailable",
      dataClass: "unavailable",
    }),
    "attention",
  );
});


test("task groups preserve connected workstreams and keep unresolved linkage explicit", () => {
  const groups = groupMissionTasks(
    [
      { workstream_id: "workstream_a", name: "Architecture" },
      { workstream_id: "workstream_b", name: "Verification" },
    ],
    [
      { task_id: "task_a", workstream_id: "workstream_a" },
      { task_id: "task_b", workstream_id: "workstream_b" },
      { task_id: "task_unknown", workstream_id: "workstream_missing" },
    ],
  );

  assert.deepEqual(groups.map((group) => group.workstream?.workstream_id ?? null), [
    "workstream_a", "workstream_b", null,
  ]);
  assert.deepEqual(groups.map((group) => group.tasks.map((task) => task.task_id)), [
    ["task_a"], ["task_b"], ["task_unknown"],
  ]);
  assert.equal(groups[2].workstream, null, "missing workstream metadata must not be fabricated");
});
