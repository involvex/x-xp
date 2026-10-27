# Changelog

## 0.2.0 — 2026-10-27

### Added

- **Tags** — edit/remove from context menu; full TagDef CRUD in Settings
- **File icon colors** by kind (folder, archive, image, code, …)
- **Who’s locking…** — File Locksmith CLI (`--json` / `--kill`) modal
- **Peek** — Ctrl+Space launches PowerToys Peek (Space / F4 keep in-app preview)
- **Open in Terminal** — involvex-term (`nt -d`) with Settings path override
- **About** in Settings (app name + version) and first-run “what’s new” toast
- Empty-folder / empty-search hints

### Changed

- Version bump to **0.2.0** (package, Tauri, Cargo)

### Fixed

- Terminal path probe prefers D:\ involvex-term install when present

## 0.1.0

Initial Windows explorer: tabs, dual-pane, preview, search, bookmarks, tags,
session restore, MSI default-handler install path, undo/redo, sidebar polish.
