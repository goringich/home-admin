import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const agent = fs.readFileSync(new URL("../agents/windows/atlas-device-agent.ps1", import.meta.url), "utf8");
const installer = fs.readFileSync(new URL("../agents/windows/install-atlas-device-agent.ps1", import.meta.url), "utf8");

test("Windows agent keeps per-device authentication and secret protection", () => {
  assert.match(agent, /HMACSHA256/);
  assert.match(agent, /DataProtectionScope\]::LocalMachine/);
  assert.match(agent, /X-Atlas-Device-Id/);
  assert.match(agent, /X-Atlas-Timestamp/);
  assert.match(agent, /X-Atlas-Nonce/);
  assert.match(agent, /X-Atlas-Signature/);
});

test("Windows agent exposes only governed commands", () => {
  assert.doesNotMatch(agent, /Invoke-Expression|\biex\b|EncodedCommand|ScriptBlock\.Create/i);
  assert.doesNotMatch(agent, /powershell(?:\.exe)?\s+-Command/i);
  assert.match(agent, /"refresh_telemetry"/);
  assert.match(agent, /"camera_snapshot"/);
  assert.match(agent, /"restart_pc"/);
  assert.match(agent, /"shutdown_pc"/);
});

test("Windows telemetry handles modern CIM DateTime and camera artifact limits", () => {
  assert.match(agent, /LastBootUpTime -is \[DateTime\]/);
  assert.match(agent, /camera_snapshot_too_large/);
  assert.match(agent, /2MB/);
  assert.match(agent, /Get-PnpDevice/);
});

test("installer creates a SYSTEM startup task and locks ACLs", () => {
  assert.match(installer, /New-ScheduledTaskPrincipal -UserId "SYSTEM"/);
  assert.match(installer, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(installer, /Register-ScheduledTask/);
  assert.match(installer, /icacls\.exe/);
  assert.doesNotMatch(installer, /\\\s*$/m);
});
