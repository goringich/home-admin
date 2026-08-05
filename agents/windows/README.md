# Project Atlas Windows Device Agent

Исходящий Windows-агент для Fleet Control Plane. Он не открывает входящие порты и не предоставляет произвольную удалённую оболочку.

## Возможности

- heartbeat каждые 30 секунд;
- CPU, RAM, uptime, диски, GPU/NVIDIA, IP/Tailscale, процессы и reboot-pending;
- инвентаризация камер;
- статус RustDesk, Sunshine и RDP;
- HMAC-SHA256 подпись каждого запроса, timestamp и replay protection;
- allowlisted команды: refresh, health check, lock, agent restart, camera snapshot, RustDesk/Sunshine service start, restart/shutdown;
- опасные команды требуют точного имени устройства в Atlas UI;
- секрет устройства хранится через Windows DPAPI `LocalMachine`, каталог ограничен ACL для `SYSTEM` и Administrators.

## Подготовка Atlas-хоста

В systemd environment сервиса Atlas задайте случайный enrollment token:

```bash
PROJECT_ATLAS_ENROLLMENT_TOKEN=<long-random-secret>
```

Atlas остаётся привязанным к `127.0.0.1`. Для другого компьютера используйте Tailscale/SSH tunnel или отдельный TLS reverse proxy; не публикуйте HTTP endpoint напрямую в интернет.

## Установка на Windows

Откройте PowerShell от администратора в каталоге `agents/windows`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-atlas-device-agent.ps1 `
  -ServerUrl "http://127.0.0.1:4174" `
  -EnrollmentToken "<same-token>" `
  -DeviceName "Main Windows PC"
```

Для подключения через SSH tunnel сначала поднимите локальный tunnel Windows → Atlas host и укажите его localhost URL.

## Камеры

Инвентаризация работает через PnP. JPEG snapshot требует `ffmpeg.exe` в `PATH` и доступность камеры через DirectShow. Live desktop/camera streaming намеренно делегирован RustDesk/Sunshine: Atlas управляет состоянием и безопасными действиями, но не реализует собственный небезопасный TeamViewer-клон.

## Диагностика

```powershell
Get-ScheduledTask -TaskPath "\Project Atlas\"
Get-ScheduledTaskInfo -TaskPath "\Project Atlas\" -TaskName "Windows Device Agent"
Get-Content "$env:ProgramData\ProjectAtlas\DeviceAgent\agent.json"
```

Секрет в config зашифрован DPAPI и не пригоден на другом компьютере.
