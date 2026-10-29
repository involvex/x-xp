# AGENTS.md - x-xp

This document provides instructions for AI agents working on the x-xp codebase. It covers useful commands, technologies, best practices, and guidelines to ensure consistent, high-quality development.

## Project Overview

**x-xp** is a Windows-first file explorer built with **Tauri 2** + **React**. It serves as a modern alternative to Windows Explorer with features like tabs, dual-pane view, preview, search, bookmarks, color tags, and optional default folder handler registration.

- **Version:** 0.2.0
- **License:** Private / Involvex
- **Platform:** Windows-first (designed primarily for Windows, though Tauri is cross-platform)
- **Type:** Desktop application (Tauri)

## Useful Commands

### Development

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start Vite dev server only (frontend) |
| `bun run tauri:dev` | Start full Tauri app in development mode (frontend + Rust backend) |
| `bun run preview` | Preview built frontend with Vite |

### Building

| Command | Purpose |
| --- | --- |
| `bun run build` | Build frontend only (TypeScript check + Vite build) |
| `bun run tauri:build` | Build full production app (MSI/NSIS installer) |
| `bun run prebuild` | Pre-build hook (runs check + lint) |

### Code Quality

| Command | Purpose |
| --- | --- |
| `bun run check` | Type check with TypeScript (`tsc --noEmit`) |
| `bun run lint` | Lint with ESLint and auto-fix (`eslint src --fix`) |
| `bun run format` | Format code with Prettier |
| `bun run format:check` | Check formatting without modifying files |

### CLI

| Command | Purpose |
| --- | --- |
| `bun link` | Link the CLI tool globally |
| `x-xp .` or `x-xp <path>` | Open a path in x-xp from terminal (resolves relative paths) |

*Note:* Override binary discovery with `X_XP_BIN` environment variable if needed.

## Technologies

### Frontend
- **[React](https://react.dev/)** ^19.1.0 - UI framework with modern hooks
- **[TypeScript](https://www.typescriptlang.org/)** ~6.0.3 - Type-safe JavaScript
- **[Vite](https://vitejs.dev/)** ^8.0.16 - Build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** ^4.3.3 - Utility-first CSS framework
- **[@tailwindcss/vite](https://tailwindcss.com/docs/installation/using-vite)** - Vite plugin for Tailwind v4

### Backend (Tauri/Rust)
- **[Tauri](https://v2.tauri.app/)** ^2 - Desktop app framework
- **[Rust](https://www.rust-lang.org/)** - Backend language for native operations
- Key Tauri plugins:
  - `@tauri-apps/plugin-fs` ^2.7.1 - File system operations
  - `@tauri-apps/plugin-global-shortcut` ^2.4.1 - Global keyboard shortcuts
  - `@tauri-apps/plugin-opener` ^2 - Open files/URLs with system apps
  - `@tauri-apps/plugin-store` ^2.5.0 - Persistent key-value storage
  - `@tauri-apps/plugin-window-state` ^2.5.0 - Window state persistence

### Build & Dev Tools
- **[Bun](https://bun.sh/)** - Package manager and runtime (required)
- **[ESLint](https://eslint.org/)** ^10.13.0 - Linting
- **[Prettier](https://prettier.io/)** ^3.9.10 - Code formatting
- **[@involvex/prettier-config](https://github.com/involvex/prettier-config)** - Shared Prettier config

## Project Structure

```
x-xp/
├── src/                    # Frontend React/TypeScript code
│   ├── components/         # React components
│   │   ├── explorer/       # Main explorer UI components
│   │   └── Toast.tsx       # Toast notifications
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries and helpers
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Tauri/Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   └── main.rs/lib.rs  # Rust entry points
│   ├── capabilities/       # Tauri permissions/capabilities
│   ├── tauri.conf.json     # Tauri configuration
│   └── Cargo.toml          # Rust dependencies
├── bin/                    # CLI entry point
├── public/                 # Static assets
└── package.json            # Frontend dependencies and scripts
```

## Best Practices and Guidelines

### General Development

- **Use Bun**: This project uses Bun as the package manager. Always use `bun` commands, not `npm`/`yarn`/`pnpm`.
- **Type Safety**: TypeScript strict mode is enabled. Avoid `any` types where possible - use proper typing or `unknown` with type guards.
- **Windows-First**: Features are designed primarily for Windows. Be mindful of Windows-specific paths, APIs, and behaviors (Recycle Bin, default handlers, PowerToys integration, etc.).
- **Check Before Commit**: Always run `bun run check && bun run lint` before committing. The prebuild script enforces this.
- **Format Code**: Use `bun run format` to ensure consistent code style.

### Frontend (React/TypeScript)

- **Functional Components**: Use functional components with hooks. No class components.
- **Hooks Best Practices**: Follow React hooks rules. Create custom hooks in `src/hooks/` for reusable logic.
- **Component Organization**: Explorer-specific components go in `src/components/explorer/`. Shared components go in `src/components/`.
- **State Management**: Use Zustand-like patterns via `src/lib/store.ts` or React hooks. Check existing patterns before introducing new state solutions.
- **Styling**: Use Tailwind CSS utility classes. Follow the existing design patterns in the codebase.
- **Type Definitions**: Place shared types in `src/types/`. Component-specific types can be defined in the component file.
- **Performance**: Be mindful of re-renders, especially in file list views with large directories. Use `useMemo`, `useCallback` where appropriate.

### Backend (Rust/Tauri)

- **Commands**: Tauri commands go in `src-tauri/src/commands/`. Add new command modules to `commands/mod.rs` and register them in `main.rs`/`lib.rs`.
- **Error Handling**: Return proper `Result<T, E>` types from commands. Use `serde` for serialization.
- **Permissions**: Add necessary permissions to `src-tauri/capabilities/default.json` when using Tauri plugins or APIs.
- **Windows APIs**: When using Windows-specific APIs (registry, shell, etc.), use appropriate crates and handle Windows paths correctly.
- **Safety**: Be careful with file operations, especially when dealing with Recycle Bin, default handlers, or system registry modifications.

### File Operations & Features

- **Path Handling**: Use forward slashes where possible in the codebase, but be mindful of Windows paths. The CLI canonicalizes relative paths to absolute paths.
- **Recycle Bin**: Deletion goes through Recycle Bin by default (see `src-tauri/src/commands/recycle.rs`).
- **Undo/Redo**: Support undo/redo for file operations where applicable (see `src/lib/undo.ts`).
- **Drag & Drop**: Implement drag-and-drop for move/copy operations (see `src/lib/navDnD.ts`).
- **History**: Maintain navigation history for back/forward (see `src/hooks/useHistory.ts`).
- **Selection**: Use the selection hook (`src/hooks/useSelection.ts`) for multi-select logic.
- **Tabs & Dual-Pane**: The app supports tabs and dual-pane view (F3 toggle). Maintain state consistency across panes.

### Integration Points

- **PowerToys Peek**: Ctrl+Space launches PowerToys Peek. F4/Space use in-app preview.
- **Terminal Integration**: "Open in Terminal" uses `involvex-term` (`nt -d`) with configurable path in Settings.
- **File Locksmith**: "Who's locking..." feature uses `File Locksmith` CLI with `--json`/`--kill` flags.
- **Default Handler**: MSI installer can register as default folder/drive/directory handler. Changes are Windows registry-based with backup/restore support.

### Code Quality Standards

- **Linting**: ESLint is configured with strict rules. Fix all lint errors before committing.
- **Formatting**: Prettier with `@involvex/prettier-config` enforces consistent formatting.
- **Type Checking**: Zero TypeScript errors required (`strict: true` enabled).
- **Imports**: Use ES module imports. Vite handles bundling.
- **Comments**: Add comments for complex logic, especially Windows-specific workarounds or non-obvious behavior.
- **Error Messages**: Provide user-friendly error messages in the UI (see `Toast.tsx` for notifications).

### Testing & Debugging

- **Dev Mode**: Use `bun run tauri:dev` for full app debugging with hot reload.
- **Rust Logs**: Check Tauri console output for Rust errors.
- **Browser DevTools**: In dev mode, you can use browser dev tools for React debugging.
- **Type Checking**: Run `bun run check` frequently during development to catch type errors early.

### Version Management

- Version is tracked in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. When bumping version, update all three locations.
- Update `CHANGELOG.md` with release notes following the existing format.
- Current version: **0.2.0**

### Security & System Changes

- **Default Handler Registration**: Modifying default folder handlers touches Windows Registry. Always create backups/restore points (as the app does). Be extremely careful with registry operations.
- **Permissions**: Only request necessary Tauri capabilities. Review `src-tauri/capabilities/default.json`.
- **File System Access**: Respect user permissions and handle errors gracefully when accessing files/directories.
- **External Tools**: Integration with external tools (PowerToys, involvex-term, File Locksmith) should be defensive with path detection and graceful fallbacks.

## Contributing Guidelines

1. **Follow Existing Patterns**: Study similar components/commands before implementing new features.
2. **Keep Changes Focused**: Make atomic, well-described commits.
3. **Update Documentation**: Update `CHANGELOG.md` for user-facing changes. Update this `AGENTS.md` if development workflows change.
4. **Test on Windows**: Since it's Windows-first, test changes on Windows when possible.
5. **Check for Regressions**: Ensure existing features (tabs, dual-pane, preview, etc.) still work after changes.

## Additional Resources

- [Tauri 2 Documentation](https://v2.tauri.app/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [CHANGELOG.md](./CHANGELOG.md) - Release history and recent changes
- [README.md](./README.md) - User-facing documentation
