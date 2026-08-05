# Project Atlas

Локальный command center для всей проектной карты: репозитории, состояние worktree, задачи, релизные окна, AI runtime, системный контекст и управление компьютерами.

## Что уже умеет

- читает `system-bootstrap/docs/repo-inventory.md` и строит реестр репозиториев;
- подтягивает `git`-состояние, dirty count, последний коммит, команды и стек;
- выделяет фокусные проекты через `data/project-overrides.json`;
- разделяет данные на рабочие пространства `Обзор`, `Company`, `Revenue`, `AI Control`, `Проекты`, `Запуски`, `Админки`, `Remote`;
- показывает Local Codex Lab, Agent Operations, commercial readiness и governed dispatch;
- сохраняет старый single-host Linux Remote как обратимый fallback;
- предоставляет новый Windows Fleet Control Plane для множества компьютеров:
  - registry, enrollment и heartbeat;
  - статусы `online`, `stale`, `offline` и health assessment;
  - CPU, RAM, uptime, диски, GPU/NVIDIA, сеть, процессы и reboot-pending;
  - инвентаризация камер и JPEG snapshot через ffmpeg;
  - статус RustDesk, Sunshine, RDP и Tailscale;
  - подписанная HMAC-SHA256 очередь allowlisted команд;
  - command history, device timeline и device-scoped AI prompting;
  - DPAPI-защищённый Windows secret и отсутствие arbitrary remote shell.

## Локальная разработка

```bash
npm install
npm run dev
```

`npm run dev` пересобирает snapshot, запускает fleet gateway и Vite. Vite проксирует `/api` и `/snapshot.json` на Atlas gateway. Только UI без gateway можно запустить командой `npm run dev:ui`.

Production/local service host:

```bash
npm run build
npm run host
```

Gateway слушает `127.0.0.1:4174`, запускает существующий Atlas host на внутреннем порту и проксирует его старые API без изменения контрактов. Старый host отдельно: `npm run host:legacy`.

## Windows Fleet

Новый UI открывается в workspace `Remote` (`#/remote`). Старый Linux Remote доступен через `?legacyRemote=1#/remote`.

### 1. Включить enrollment

Задайте длинный случайный секрет в environment сервиса Atlas:

```bash
PROJECT_ATLAS_ENROLLMENT_TOKEN=<long-random-secret>
```

Перезапустите Atlas service после изменения environment.

### 2. Дать Windows безопасный путь к Atlas

Atlas намеренно остаётся loopback-only. Для другого компьютера используйте Tailscale/SSH tunnel или корректный TLS reverse proxy. Не публикуйте незашифрованный endpoint напрямую в интернет.

### 3. Установить Windows agent

Откройте PowerShell от администратора в каталоге `agents/windows`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-atlas-device-agent.ps1 `
  -ServerUrl "http://127.0.0.1:4174" `
  -EnrollmentToken "<same-token>" `
  -DeviceName "Main Windows PC"
```

Installer:

- регистрирует устройство;
- шифрует device secret через DPAPI `LocalMachine`;
- ограничивает каталог ACL для `SYSTEM` и Administrators;
- создаёт startup task `\Project Atlas\Windows Device Agent` от SYSTEM;
- включает автоматический restart при сбое.

Подробности: `agents/windows/README.md`.

## Fleet security model

1. Enrollment доступен только при заданном `PROJECT_ATLAS_ENROLLMENT_TOKEN`.
2. Каждое устройство получает отдельный 256-bit secret.
3. Windows хранит secret через DPAPI `LocalMachine`.
4. Heartbeat, command poll и acknowledgement подписаны HMAC-SHA256 с timestamp, nonce и hash body.
5. Gateway отклоняет просроченные и replayed запросы.
6. Command catalog allowlisted; arbitrary PowerShell/shell отсутствует.
7. Restart и shutdown требуют точного имени устройства в UI.
8. Camera artifacts ограничены JPEG/PNG и 2 MB.
9. UI mutations доступны только с loopback и разрешённого origin.

## Fleet API

- `GET /api/fleet/state` — агрегированное состояние устройств;
- `POST /api/fleet/enroll` — enrollment по отдельному token;
- `POST /api/fleet/heartbeat` — подписанная телеметрия;
- `GET /api/fleet/commands?deviceId=...` — подписанный command poll;
- `POST /api/fleet/commands/:id/ack` — подписанный результат команды;
- `POST /api/fleet/devices/:id/commands` — постановка allowlisted команды из UI;
- `POST /api/fleet/dev/prepare` — device-scoped prompt;
- `GET /api/fleet/artifacts/:deviceId/:filename` — последний разрешённый camera artifact.

## Важные файлы

- `scripts/build-snapshot.mjs` — генератор `public/snapshot.json`;
- `scripts/atlas-host.mjs` — существующий Atlas host и legacy API;
- `scripts/device-fleet-host.mjs` — fleet gateway, signed agent endpoints и legacy proxy;
- `scripts/device-fleet-store.mjs` — registry, telemetry, commands, events и artifacts;
- `scripts/dev-stack.mjs` — совместный dev-запуск Vite и gateway;
- `scripts/remote-control.mjs` — legacy Linux remote helper;
- `agents/windows/atlas-device-agent.ps1` — Windows telemetry/command agent;
- `agents/windows/install-atlas-device-agent.ps1` — secure installer;
- `src/DeviceFleetApp.tsx` — Windows Fleet UI;
- `src/App.tsx` — остальные Atlas workspaces;
- `src/styles/` — visual system;
- `data/project-overrides.json` — curated слой проектов, задач и связей.

## Codex Orchestrator Bridge

Atlas продолжает использовать существующий governed local-agent path:

1. точный repository ID разрешается через server-side `targets.json`;
2. blocking operation policy должен вернуть `allow`;
3. task передаётся через приватный временный файл, а не process arguments;
4. запуск и dispatch выполняются существующими `local-agent-run` и `local-agent-exec`;
5. Atlas не создаёт вторую очередь и не открывает unrestricted command execution.

Fleet dev prompting также не исполняет shell. Он формирует outcome-first prompt из свежего device context и передаёт дальнейшую реализацию в существующий governed AI layer.
