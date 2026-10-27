# x-xp

Windows-first file explorer built with **Tauri 2** + **React**.  
Use it as a modern Explorer alternative with CLI opening, tabs, dual-pane, preview, and optional default-folder-handler registration.

## Features

**Core:** navigate, breadcrumbs, history, multi-select, copy/cut/paste, rename, delete (Recycle Bin), new folder, keyboard shortcuts, list/details/icons views, sidebar (drives + known folders).

**Plus:** tabs, dual-pane (F3), quick text preview (F4), bookmarks, recursive name search, `x-xp <path>` CLI, single-instance focus.

**Install / defaults (Windows):** MSI can register x-xp as the classic Directory/Folder/Drive open handler, create a System Restore point (`Before x-xp default explorer`), and backup prior registry values under `HKLM\Software\Involvex\x-xp\Backup`. In-app **Settings** can set/restore user-level handlers.

> This does **not** replace the Windows desktop shell (`explorer.exe` / Winlogon). Only folder open handlers are changed. Win10/11 “Default apps” / UserChoice may still override classic verbs.

## Dev

```bash
bun install
bun run tauri:dev
```

Open a path from another terminal once built/installed:

```bash
x-xp "C:\Users\Public"
```

## Scripts

| Script                | Purpose             |
| --------------------- | ------------------- |
| `bun run tauri:dev`   | Dev app             |
| `bun run tauri:build` | Production MSI/NSIS |
| `bun run check`       | TypeScript          |
| `bun run lint`        | ESLint              |
| `bun run format`      | Prettier            |

## Rollback

1. In-app Settings → **Restore previous defaults**
2. Or System Restore → point **Before x-xp default explorer**
3. Uninstall the MSI (removes App Paths / PATH / context menus)

Before changing system defaults, Settings tries to create a restore point and registry backup. You can also run `src-tauri/scripts/install-backup.ps1` elevated before MSI install.

## License

Private / Involvex
