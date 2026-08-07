$ErrorActionPreference = "Stop"

$files = @(
  "agents/windows/atlas-device-agent.ps1",
  "agents/windows/install-atlas-device-agent.ps1"
)

foreach ($file in $files) {
  $tokens = $null
  $errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path $file),
    [ref]$tokens,
    [ref]$errors
  ) | Out-Null
  if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error "${file}: $($_.Message)" }
    throw "PowerShell parser rejected $file"
  }
  Write-Host "PASS: $file"
}
