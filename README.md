# Project Atlas

Локальный command center для всей твоей проектной карты: репозитории, состояние worktree, quick-open, задачи, релизные окна, системный и GPU-контекст.

## Что уже умеет

- читает `system-bootstrap/docs/repo-inventory.md` и строит реестр всех реп;
- подтягивает `git`-состояние, dirty count, последний коммит, базовые команды и стек;
- выделяет фокусные проекты через `data/project-overrides.json`;
- разделяет данные на семь рабочих пространств: `Обзор`, `Revenue`, `AI Control`, `Проекты`, `Запуски`, `Админки`, `Remote`;
- использует progressive disclosure: обзор показывает одно следующее действие, AI Control раскрывает отдельные слои runtime/context/efficiency/trust, а проекты работают как master-detail browser;
- сохраняет task matrix и release radar внутри проектного workspace вместо одной бесконечной dashboard-страницы;
- добавляет machine-level контекст: safe mode, system status, GPU temp / VRAM.
- показывает `Local Codex Lab` на основе compact runtime artifacts, а не сырых transcript'ов:
  - goal capsules
  - run summaries
  - token-waste metrics
  - retrieval policy / denylist
  - OpenClaw reliability classes
  - repo-intel freshness
  - model routing baseline
- показывает `Agent Operations` внутри workspace `Запуски`:
  - freshness и source authority существующего agent ledger
  - queue/lifecycle counts, verification и locally measured success rate
  - blocked promotions, stale evidence и последние compact run summaries
  - live-запрос `snapshot.json` сначала fail-soft обновляет существующую read-only проекцию `atlas-export`; timeout или ошибка сохраняют предыдущий снимок и не меняют очередь
- показывает в `Revenue` fail-closed цепочку `готовность → публикация → лид → оплата → чек`:
  - только разрешённые статусы и агрегированные счётчики;
  - `unknown`, авторитетный ноль, pending и stale не смешиваются;
  - готовность billing-профиля не считается оплатой, а политика чека — доказательством его выдачи;
  - персональные данные, реквизиты, суммы и документы чеков в snapshot не проецируются.

## Запуск

```bash
npm install
npm run dev
```

Снимок данных пересобирается перед `dev` и `build`.

## Важные файлы

- `scripts/build-snapshot.mjs` — генератор `public/snapshot.json`
- `scripts/atlas-host.mjs` — local host с read-only и строго ограниченными mutation API endpoints:
  - `/api/local-codex-lab`
  - `/api/ai-lab`
  - `/api/ai-lab/tool-inventory`
  - `/api/ai-lab/prepare`
  - `/api/goal-capsules`
  - `/api/token-efficiency`
  - `/api/openclaw-reliability`
  - `/api/codex-orchestrator/status`
  - `/api/codex-orchestrator/queue`
  - `/api/codex-orchestrator/recent-runs`
  - `/api/local-agent/dispatch`
  - `/api/codex-orchestrator/enqueue` — compatibility alias
- `scripts/remote-control.mjs` — allowlisted remote-ops helper для atlas host (`remote_safe_on/off`, `wayvnc_start/stop`, `dev_bridge_restart`)
- `data/project-overrides.json` — curated слой по ключевым проектам, задачам и связям
- `src/App.tsx` — workspace routing, view composition и основная UI-оболочка
- `src/styles/` — tokens, themes, layout, components и responsive visual system

## Следующий слой

- live deploy probes для production / staging;
- writable task store, а не только curated JSON;
- tighter report views over `~/__home_organized/runtime/local-codex-stack/run-reports/`.

## Codex Orchestrator Bridge

Atlas reads codex-orchestrator queue/status/recent-run state from the existing
runtime roots. New work goes through the governed local-agent path:

1. Atlas resolves an exact repository ID from the server-side `targets.json`
   registry and rejects unknown IDs, arbitrary paths, and mismatched legacy
   `workdir` values.
2. The blocking operation policy must return `allow`.
3. Atlas writes the task to a short-lived private directory (`0700`) and prompt
   file (`0600`), then calls `local-agent-run --repo <id> --task-file <file>`.
4. Atlas parses the returned run JSON and calls
   `local-agent-exec --run-id <id> --agent codex --dispatch queue`.
5. The private prompt is removed in a `finally` cleanup, and the API returns the
   run, report, and queue identifiers from the two JSON responses.

The raw task never appears in process arguments. Atlas does not own a second
queue and does not expose unrestricted command execution. The preferred
mutation endpoint is `/api/local-agent/dispatch`; the previous
`/api/codex-orchestrator/enqueue` route remains only as an HTTP compatibility
alias. If the governed wrappers are missing, the UI/API reports the exact fix:

```bash
ln -sf /home/goringich/__home_organized/scripts/local-agent-run /home/goringich/.local/bin/local-agent-run
ln -sf /home/goringich/__home_organized/scripts/local-agent-exec /home/goringich/.local/bin/local-agent-exec
```
