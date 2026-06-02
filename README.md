# Project Atlas

Локальный command center для всей твоей проектной карты: репозитории, состояние worktree, quick-open, задачи, релизные окна, системный и GPU-контекст.

## Что уже умеет

- читает `system-bootstrap/docs/repo-inventory.md` и строит реестр всех реп;
- подтягивает `git`-состояние, dirty count, последний коммит, базовые команды и стек;
- выделяет фокусные проекты через `data/project-overrides.json`;
- показывает карту зависимостей, task matrix, release radar, intelligence rail и реестр всех реп;
- добавляет machine-level контекст: safe mode, system status, GPU temp / VRAM.
- показывает `Local Codex Lab` на основе compact runtime artifacts, а не сырых transcript'ов:
  - goal capsules
  - run summaries
  - token-waste metrics
  - retrieval policy / denylist
  - OpenClaw reliability classes
  - repo-intel freshness
  - model routing baseline

## Запуск

```bash
npm install
npm run dev
```

Снимок данных пересобирается перед `dev` и `build`.

## Важные файлы

- `scripts/build-snapshot.mjs` — генератор `public/snapshot.json`
- `scripts/atlas-host.mjs` — local host с read-only API endpoints:
  - `/api/local-codex-lab`
  - `/api/goal-capsules`
  - `/api/token-efficiency`
  - `/api/openclaw-reliability`
- `scripts/remote-control.mjs` — allowlisted remote-ops helper для atlas host (`remote_safe_on/off`, `wayvnc_start/stop`, `dev_bridge_restart`)
- `data/project-overrides.json` — curated слой по ключевым проектам, задачам и связям
- `src/App.tsx` — основная UI-оболочка
- `src/index.css` — визуальная система

## Следующий слой

- live deploy probes для production / staging;
- writable task store, а не только curated JSON;
- локальный bridge для настоящего `open repo / open docs / run command` из UI.
