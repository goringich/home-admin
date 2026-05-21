# Project Atlas

Локальный command center для всей твоей проектной карты: репозитории, состояние worktree, quick-open, задачи, релизные окна, системный и GPU-контекст.

## Что уже умеет

- читает `system-bootstrap/docs/repo-inventory.md` и строит реестр всех реп;
- подтягивает `git`-состояние, dirty count, последний коммит, базовые команды и стек;
- выделяет фокусные проекты через `data/project-overrides.json`;
- показывает карту зависимостей, task matrix, release radar, intelligence rail и реестр всех реп;
- добавляет machine-level контекст: safe mode, system status, GPU temp / VRAM.

## Запуск

```bash
npm install
npm run dev
```

Снимок данных пересобирается перед `dev` и `build`.

## Важные файлы

- `scripts/build-snapshot.mjs` — генератор `public/snapshot.json`
- `data/project-overrides.json` — curated слой по ключевым проектам, задачам и связям
- `src/App.tsx` — основная UI-оболочка
- `src/index.css` — визуальная система

## Следующий слой

- live deploy probes для production / staging;
- writable task store, а не только curated JSON;
- локальный bridge для настоящего `open repo / open docs / run command` из UI.
