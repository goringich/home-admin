[CmdletBinding()]
param(
  [string]$ServerUrl = "",
  [string]$EnrollmentToken = "",
  [string]$DeviceName = "",
  [string]$ConfigPath = "$env:ProgramData\ProjectAtlas\DeviceAgent\agent.json",
  [switch]$EnrollOnly,
  [switch]$Run
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"
$AgentVersion = "1.0.0"
$HeartbeatIntervalSeconds = 30
$CommandPollIntervalSeconds = 10

function ConvertTo-Hex {
  param([byte[]]$Bytes)
  return -join ($Bytes | ForEach-Object { $_.ToString("x2") })
}

function Protect-AtlasSecret {
  param([string]$Secret)
  $bytes = [Text.Encoding]::UTF8.GetBytes($Secret)
  $protected = [Security.Cryptography.ProtectedData]::Protect(
    $bytes,
    $null,
    [Security.Cryptography.DataProtectionScope]::LocalMachine
  )
  return [Convert]::ToBase64String($protected)
}

function Unprotect-AtlasSecret {
  param([string]$ProtectedSecret)
  $bytes = [Convert]::FromBase64String($ProtectedSecret)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $bytes,
    $null,
    [Security.Cryptography.DataProtectionScope]::LocalMachine
  )
  return [Text.Encoding]::UTF8.GetString($plain)
}

function Save-AtlasConfig {
  param([hashtable]$Config)
  $directory = Split-Path -Parent $ConfigPath
  New-Item -Path $directory -ItemType Directory -Force | Out-Null
  $Config | ConvertTo-Json -Depth 8 | Set-Content -Path $ConfigPath -Encoding UTF8
  & icacls.exe $directory /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
}

function Load-AtlasConfig {
  if (-not (Test-Path $ConfigPath)) {
    throw "Agent config not found: $ConfigPath"
  }
  $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
  return @{
    serverUrl = [string]$config.serverUrl
    deviceId = [string]$config.deviceId
    deviceName = [string]$config.deviceName
    protectedSecret = [string]$config.protectedSecret
    heartbeatIntervalSeconds = [int]$config.heartbeatIntervalSeconds
    commandPollIntervalSeconds = [int]$config.commandPollIntervalSeconds
  }
}

function Get-AtlasRequestSignature {
  param(
    [string]$Secret,
    [string]$Method,
    [string]$PathWithQuery,
    [string]$Timestamp,
    [string]$Nonce,
    [string]$Body
  )
  $bodyHasher = [Security.Cryptography.SHA256]::Create()
  try {
    $bodyHash = ConvertTo-Hex ($bodyHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($Body)))
  } finally {
    $bodyHasher.Dispose()
  }
  $canonical = "$($Method.ToUpper())`n$PathWithQuery`n$Timestamp`n$Nonce`n$bodyHash"
  $hmac = New-Object Security.Cryptography.HMACSHA256
  try {
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($Secret)
    return ConvertTo-Hex ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)))
  } finally {
    $hmac.Dispose()
  }
}

function Invoke-AtlasSignedRequest {
  param(
    [hashtable]$Config,
    [ValidateSet("GET", "POST")][string]$Method,
    [string]$Path,
    [object]$Payload = $null
  )
  $baseUri = $Config.serverUrl.TrimEnd("/")
  $uri = [Uri]("$baseUri$Path")
  $body = ""
  if ($null -ne $Payload) {
    $body = $Payload | ConvertTo-Json -Depth 12 -Compress
  }
  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
  $nonce = [Guid]::NewGuid().ToString("N")
  $secret = Unprotect-AtlasSecret $Config.protectedSecret
  $signature = Get-AtlasRequestSignature `
    -Secret $secret `
    -Method $Method `
    -PathWithQuery $uri.PathAndQuery `
    -Timestamp $timestamp `
    -Nonce $nonce `
    -Body $body
  $headers = @{
    "X-Atlas-Device-Id" = $Config.deviceId
    "X-Atlas-Timestamp" = $timestamp
    "X-Atlas-Nonce" = $nonce
    "X-Atlas-Signature" = $signature
  }
  $parameters = @{
    Uri = $uri.AbsoluteUri
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
    TimeoutSec = 30
  }
  if ($body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = $body
  }
  return Invoke-RestMethod @parameters
}

function Get-AtlasRebootPending {
  $paths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"
  )
  foreach ($path in $paths) {
    if (Test-Path $path) { return $true }
  }
  try {
    $pending = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager" -Name PendingFileRenameOperations -ErrorAction Stop).PendingFileRenameOperations
    return $null -ne $pending
  } catch {
    return $false
  }
}

function Get-AtlasGpuTelemetry {
  $gpus = @()
  $nvidia = Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
  if ($nvidia) {
    try {
      $lines = & $nvidia.Source --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>$null
      foreach ($line in $lines) {
        $parts = @($line -split "," | ForEach-Object { $_.Trim() })
        if ($parts.Count -ge 5) {
          $gpus += @{
            name = $parts[0]
            utilizationPercent = [double]$parts[1]
            memoryUsedMb = [double]$parts[2]
            memoryTotalMb = [double]$parts[3]
            temperatureC = [double]$parts[4]
            source = "nvidia-smi"
          }
        }
      }
    } catch {}
  }
  if ($gpus.Count -eq 0) {
    try {
      foreach ($gpu in Get-CimInstance Win32_VideoController) {
        $gpus += @{
          name = [string]$gpu.Name
          utilizationPercent = 0
          memoryUsedMb = 0
          memoryTotalMb = if ($gpu.AdapterRAM) { [math]::Round([double]$gpu.AdapterRAM / 1MB, 0) } else { 0 }
          temperatureC = 0
          source = "wmi"
        }
      }
    } catch {}
  }
  return $gpus
}

function Get-AtlasCameraTelemetry {
  $cameras = @()
  try {
    $devices = Get-PnpDevice -PresentOnly -ErrorAction Stop | Where-Object { $_.Class -in @("Camera", "Image") }
    foreach ($camera in $devices) {
      $cameras += @{
        id = [string]$camera.InstanceId
        name = [string]$camera.FriendlyName
        status = [string]$camera.Status
        ffmpegName = [string]$camera.FriendlyName
      }
    }
  } catch {}
  return $cameras
}

function Get-AtlasRemoteTelemetry {
  $rustdeskCommand = Get-Command rustdesk.exe -ErrorAction SilentlyContinue
  $rustdeskService = Get-Service -Name RustDesk -ErrorAction SilentlyContinue
  $sunshineService = Get-Service -Name SunshineService, Sunshine -ErrorAction SilentlyContinue | Select-Object -First 1
  $rustdeskId = ""
  if ($rustdeskCommand) {
    try { $rustdeskId = [string](& $rustdeskCommand.Source --get-id 2>$null | Select-Object -First 1) } catch {}
  }
  $rdpEnabled = $false
  try {
    $rdpEnabled = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name fDenyTSConnections).fDenyTSConnections -eq 0
  } catch {}
  $tailscaleIp = ""
  $tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
  if ($tailscale) {
    try { $tailscaleIp = [string](& $tailscale.Source ip -4 2>$null | Select-Object -First 1) } catch {}
  }
  return @{
    rustdeskInstalled = [bool]($rustdeskCommand -or $rustdeskService)
    rustdeskRunning = [bool](Get-Process rustdesk -ErrorAction SilentlyContinue) -or ($rustdeskService -and $rustdeskService.Status -eq "Running")
    rustdeskId = $rustdeskId.Trim()
    sunshineInstalled = [bool]$sunshineService
    sunshineRunning = [bool]($sunshineService -and $sunshineService.Status -eq "Running")
    rdpEnabled = $rdpEnabled
    tailscaleConnected = [bool]$tailscaleIp
    tailscaleIp = $tailscaleIp.Trim()
  }
}

function Get-AtlasTelemetry {
  param([string]$LastError = "")
  $os = Get-CimInstance Win32_OperatingSystem
  $processors = @(Get-CimInstance Win32_Processor)
  $cpuPercent = if ($processors.Count) { [math]::Round(($processors | Measure-Object LoadPercentage -Average).Average, 1) } else { 0 }
  $memoryTotalGb = [math]::Round([double]$os.TotalVisibleMemorySize / 1MB, 2)
  $memoryFreeGb = [math]::Round([double]$os.FreePhysicalMemory / 1MB, 2)
  $memoryUsedGb = [math]::Round($memoryTotalGb - $memoryFreeGb, 2)
  $memoryPercent = if ($memoryTotalGb -gt 0) { [math]::Round(($memoryUsedGb / $memoryTotalGb) * 100, 1) } else { 0 }
  $bootTime = if ($os.LastBootUpTime -is [DateTime]) {
    [DateTime]$os.LastBootUpTime
  } else {
    [Management.ManagementDateTimeConverter]::ToDateTime([string]$os.LastBootUpTime)
  }
  $uptimeSeconds = [math]::Max(0, [math]::Round(((Get-Date) - $bootTime).TotalSeconds))

  $disks = @()
  foreach ($disk in Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3") {
    $sizeGb = if ($disk.Size) { [math]::Round([double]$disk.Size / 1GB, 2) } else { 0 }
    $freeGb = if ($disk.FreeSpace) { [math]::Round([double]$disk.FreeSpace / 1GB, 2) } else { 0 }
    $disks += @{
      name = [string]$disk.DeviceID
      label = [string]$disk.VolumeName
      sizeGb = $sizeGb
      freeGb = $freeGb
      freePercent = if ($sizeGb -gt 0) { [math]::Round(($freeGb / $sizeGb) * 100, 1) } else { 0 }
    }
  }

  $ipv4 = @()
  try {
    $ipv4 = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike "127.*" -and $_.AddressState -eq "Preferred" } |
      Select-Object -ExpandProperty IPAddress -Unique)
  } catch {}

  $processes = @()
  try {
    $processes = @(Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 12 | ForEach-Object {
      @{
        name = $_.ProcessName
        pid = $_.Id
        cpuSeconds = if ($null -ne $_.CPU) { [math]::Round($_.CPU, 1) } else { 0 }
        workingSetMb = [math]::Round($_.WorkingSet64 / 1MB, 1)
      }
    })
  } catch {}

  $remote = Get-AtlasRemoteTelemetry
  $ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  $cameras = @(Get-AtlasCameraTelemetry)
  $capabilities = @("telemetry", "signed_commands", "process_inventory", "remote_status")
  if ($cameras.Count) { $capabilities += "camera_inventory" }
  if ($cameras.Count -and $ffmpeg) { $capabilities += "camera_snapshot" }
  if ($remote.rustdeskInstalled) { $capabilities += "rustdesk" }
  if ($remote.sunshineInstalled) { $capabilities += "sunshine" }

  return @{
    capabilities = $capabilities
    telemetry = @{
      collectedAt = [DateTime]::UtcNow.ToString("o")
      system = @{
        cpuPercent = $cpuPercent
        memoryPercent = $memoryPercent
        memoryUsedGb = $memoryUsedGb
        memoryTotalGb = $memoryTotalGb
        uptimeSeconds = $uptimeSeconds
        rebootPending = Get-AtlasRebootPending
        powerSource = ""
      }
      os = @{
        caption = [string]$os.Caption
        version = [string]$os.Version
        build = [string]$os.BuildNumber
        architecture = [string]$os.OSArchitecture
      }
      disks = $disks
      gpus = @(Get-AtlasGpuTelemetry)
      network = @{
        ipv4 = $ipv4
        tailscaleIp = [string]$remote.tailscaleIp
        defaultGateway = ""
      }
      cameras = $cameras
      processes = $processes
      remote = @{
        rustdeskInstalled = $remote.rustdeskInstalled
        rustdeskRunning = $remote.rustdeskRunning
        rustdeskId = $remote.rustdeskId
        sunshineInstalled = $remote.sunshineInstalled
        sunshineRunning = $remote.sunshineRunning
        rdpEnabled = $remote.rdpEnabled
        tailscaleConnected = $remote.tailscaleConnected
      }
      agent = @{
        version = $AgentVersion
        serviceState = "running"
        lastError = $LastError
      }
    }
  }
}

function Invoke-AtlasEnrollment {
  if (-not $ServerUrl) { throw "ServerUrl is required for enrollment" }
  if (-not $EnrollmentToken) { throw "EnrollmentToken is required for enrollment" }
  $name = if ($DeviceName) { $DeviceName } else { $env:COMPUTERNAME }
  $os = Get-CimInstance Win32_OperatingSystem
  $payload = @{
    name = $name
    hostname = $env:COMPUTERNAME
    osVersion = "$($os.Caption) $($os.Version)"
    agentVersion = $AgentVersion
    capabilities = @("telemetry", "signed_commands")
  } | ConvertTo-Json -Depth 8 -Compress
  $response = Invoke-RestMethod `
    -Uri "$($ServerUrl.TrimEnd('/'))/api/fleet/enroll" `
    -Method POST `
    -Headers @{ "X-Atlas-Enrollment-Token" = $EnrollmentToken } `
    -ContentType "application/json" `
    -Body $payload `
    -UseBasicParsing `
    -TimeoutSec 30
  if (-not $response.ok) { throw "Enrollment failed" }
  $config = @{
    serverUrl = $ServerUrl.TrimEnd("/")
    deviceId = [string]$response.data.device.id
    deviceName = [string]$response.data.device.name
    protectedSecret = Protect-AtlasSecret ([string]$response.data.secret)
    heartbeatIntervalSeconds = [int]$response.data.heartbeatIntervalSeconds
    commandPollIntervalSeconds = [int]$response.data.commandPollIntervalSeconds
  }
  Save-AtlasConfig $config
  Write-Host "Enrolled device: $($config.deviceName) [$($config.deviceId)]"
  return $config
}

function Invoke-AtlasCameraSnapshot {
  param([string]$CameraName)
  $ffmpeg = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
  if (-not $ffmpeg) { throw "ffmpeg_not_installed" }
  if (-not $CameraName) { throw "camera_name_required" }
  $temporaryPath = Join-Path $env:TEMP "atlas-camera-$([Guid]::NewGuid().ToString('N')).jpg"
  try {
    & $ffmpeg.Source -hide_banner -loglevel error -f dshow -i "video=$CameraName" -frames:v 1 -y $temporaryPath 2>&1 | Out-Null
    if (-not (Test-Path $temporaryPath)) { throw "camera_capture_failed" }
    $bytes = [IO.File]::ReadAllBytes($temporaryPath)
    if ($bytes.Length -gt 2MB) { throw "camera_snapshot_too_large" }
    return @{
      kind = "camera_snapshot"
      contentType = "image/jpeg"
      base64 = [Convert]::ToBase64String($bytes)
      filename = [IO.Path]::GetFileName($temporaryPath)
    }
  } finally {
    Remove-Item $temporaryPath -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-AtlasCommand {
  param([object]$Command)
  $result = @{
    status = "succeeded"
    result = @{ message = "completed"; exitCode = 0; data = $null }
    artifact = $null
    exitAfterAck = $false
  }
  switch ([string]$Command.type) {
    "refresh_telemetry" {
      $result.result.message = "telemetry refresh scheduled"
    }
    "run_health_check" {
      $health = Get-AtlasTelemetry
      $result.result.message = "health check completed"
      $result.result.data = @{
        cpuPercent = $health.telemetry.system.cpuPercent
        memoryPercent = $health.telemetry.system.memoryPercent
        rebootPending = $health.telemetry.system.rebootPending
        cameraCount = @($health.telemetry.cameras).Count
        gpuCount = @($health.telemetry.gpus).Count
      }
    }
    "lock_screen" {
      Start-Process rundll32.exe -ArgumentList "user32.dll,LockWorkStation" -WindowStyle Hidden
      $result.result.message = "lock request sent"
    }
    "restart_agent" {
      $result.result.message = "agent will exit after acknowledgement and Task Scheduler will restart it"
      $result.exitAfterAck = $true
    }
    "camera_snapshot" {
      $cameraName = [string]$Command.payload.cameraName
      $result.artifact = Invoke-AtlasCameraSnapshot -CameraName $cameraName
      $result.result.message = "camera snapshot captured"
    }
    "open_rustdesk" {
      $service = Get-Service -Name RustDesk -ErrorAction SilentlyContinue
      if ($service) {
        Start-Service $service.Name
        $result.result.message = "RustDesk service started"
      } else {
        $result.status = "manual_required"
        $result.result.message = "RustDesk service is not installed; interactive desktop launch is intentionally not emulated from SYSTEM"
      }
    }
    "open_sunshine" {
      $service = Get-Service -Name SunshineService, Sunshine -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($service) {
        Start-Service $service.Name
        $result.result.message = "Sunshine service started"
      } else {
        $result.status = "manual_required"
        $result.result.message = "Sunshine service is not installed"
      }
    }
    "restart_pc" {
      & shutdown.exe /r /t 30 /c "Project Atlas requested a signed restart" | Out-Null
      $result.result.message = "restart scheduled in 30 seconds"
    }
    "shutdown_pc" {
      & shutdown.exe /s /t 30 /c "Project Atlas requested a signed shutdown" | Out-Null
      $result.result.message = "shutdown scheduled in 30 seconds"
    }
    default {
      $result.status = "failed"
      $result.result.message = "unsupported_command"
      $result.result.exitCode = 1
    }
  }
  return $result
}

function Start-AtlasAgentLoop {
  $config = Load-AtlasConfig
  $lastHeartbeat = [DateTime]::MinValue
  $lastError = ""
  while ($true) {
    try {
      if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge [math]::Max(10, $config.heartbeatIntervalSeconds)) {
        $snapshot = Get-AtlasTelemetry -LastError $lastError
        $heartbeat = @{
          name = $config.deviceName
          hostname = $env:COMPUTERNAME
          osVersion = $snapshot.telemetry.os.caption
          agentVersion = $AgentVersion
          capabilities = $snapshot.capabilities
          telemetry = $snapshot.telemetry
        }
        Invoke-AtlasSignedRequest -Config $config -Method POST -Path "/api/fleet/heartbeat" -Payload $heartbeat | Out-Null
        $lastHeartbeat = Get-Date
        $lastError = ""
      }

      $commandPath = "/api/fleet/commands?deviceId=$([Uri]::EscapeDataString($config.deviceId))"
      $response = Invoke-AtlasSignedRequest -Config $config -Method GET -Path $commandPath
      foreach ($command in @($response.data)) {
        $execution = $null
        try {
          $execution = Invoke-AtlasCommand -Command $command
        } catch {
          $execution = @{
            status = "failed"
            result = @{ message = $_.Exception.Message; exitCode = 1; data = $null }
            artifact = $null
            exitAfterAck = $false
          }
        }
        $ack = @{
          status = $execution.status
          result = $execution.result
        }
        if ($execution.artifact) { $ack.artifact = $execution.artifact }
        Invoke-AtlasSignedRequest `
          -Config $config `
          -Method POST `
          -Path "/api/fleet/commands/$([Uri]::EscapeDataString([string]$command.id))/ack" `
          -Payload $ack | Out-Null
        if ($execution.exitAfterAck) { exit 1 }
      }
    } catch {
      $lastError = $_.Exception.Message
      Start-Sleep -Seconds 10
    }
    Start-Sleep -Seconds ([math]::Max(5, $config.commandPollIntervalSeconds))
  }
}

if ($EnrollOnly) {
  Invoke-AtlasEnrollment | Out-Null
  exit 0
}

if (-not (Test-Path $ConfigPath)) {
  Invoke-AtlasEnrollment | Out-Null
}

if ($Run -or (-not $EnrollOnly)) {
  Start-AtlasAgentLoop
}
