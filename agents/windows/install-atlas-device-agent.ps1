[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerUrl,
  [Parameter(Mandatory = $true)][string]$EnrollmentToken,
  [string]$DeviceName = $env:COMPUTERNAME,
  [string]$InstallRoot = "$env:ProgramData\ProjectAtlas\DeviceAgent"
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run PowerShell as Administrator"
}

$sourceAgent = Join-Path $PSScriptRoot "atlas-device-agent.ps1"
if (-not (Test-Path $sourceAgent)) {
  throw "Agent script not found next to installer: $sourceAgent"
}

New-Item -Path $InstallRoot -ItemType Directory -Force | Out-Null
$targetAgent = Join-Path $InstallRoot "atlas-device-agent.ps1"
$configPath = Join-Path $InstallRoot "agent.json"
Copy-Item -Path $sourceAgent -Destination $targetAgent -Force
& icacls.exe $InstallRoot /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
& $powerShell `
  -NoProfile `
  -ExecutionPolicy Bypass `
  -File $targetAgent `
  -ServerUrl $ServerUrl `
  -EnrollmentToken $EnrollmentToken `
  -DeviceName $DeviceName `
  -ConfigPath $configPath `
  -EnrollOnly
if ($LASTEXITCODE -ne 0) {
  throw "Device enrollment failed with exit code $LASTEXITCODE"
}

$action = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$targetAgent`" -ConfigPath `"$configPath`" -Run"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName "Windows Device Agent" `
  -TaskPath "\Project Atlas\" `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Signed telemetry and governed commands for Project Atlas Windows Fleet" `
  -Force | Out-Null

Start-ScheduledTask -TaskName "Windows Device Agent" -TaskPath "\Project Atlas\"
Write-Host "Project Atlas Windows Device Agent installed and started."
Write-Host "Config: $configPath"
Write-Host "Task: \Project Atlas\Windows Device Agent"
