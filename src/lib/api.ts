import {invoke} from '@tauri-apps/api/core'
import type {
	EntryProperties,
	FileEntry,
	KnownFolder,
	RecycleItem,
	RegistryBackupStatus,
	SearchResult,
} from '../types/fs'

export const api = {
	readDir: (path: string) => invoke<FileEntry[]>('read_dir', {path}),
	getDrives: () => invoke<FileEntry[]>('get_drives'),
	createDir: (path: string) => invoke<FileEntry>('create_dir', {path}),
	createFile: (path: string) => invoke<FileEntry>('create_file', {path}),
	renameEntry: (from: string, to: string) =>
		invoke<FileEntry>('rename_entry', {from, to}),
	deleteEntries: (paths: string[]) => invoke<void>('delete_entries', {paths}),
	copyEntries: (sources: string[], destDir: string, jobId?: string) =>
		invoke<FileEntry[]>('copy_entries', {
			sources,
			destDir,
			jobId: jobId ?? null,
		}),
	moveEntries: (sources: string[], destDir: string, jobId?: string) =>
		invoke<FileEntry[]>('move_entries', {
			sources,
			destDir,
			jobId: jobId ?? null,
		}),
	cancelTransfer: (jobId: string) => invoke<void>('cancel_transfer', {jobId}),
	openPath: (path: string) => invoke<void>('open_path', {path}),
	openWith: (path: string, program: string, args: string[] = []) =>
		invoke<void>('open_with', {path, program, args}),
	openInNewWindow: (path: string) => invoke<void>('open_in_new_window', {path}),
	getEntryProperties: (path: string) =>
		invoke<EntryProperties>('get_entry_properties', {path}),
	getFolderSize: (path: string) => invoke<number>('get_folder_size', {path}),
	extractArchive: (path: string, dest?: string | null) =>
		invoke<string>('extract_archive', {path, dest: dest ?? null}),
	compressEntries: (paths: string[], destZip: string) =>
		invoke<string>('compress_entries', {paths, destZip}),
	listRecycleBin: () => invoke<RecycleItem[]>('list_recycle_bin'),
	restoreRecycleItem: (id: string) =>
		invoke<void>('restore_recycle_item', {id}),
	restoreByOriginalPaths: (paths: string[]) =>
		invoke<number>('restore_by_original_paths', {paths}),
	deleteRecycleItem: (id: string) => invoke<void>('delete_recycle_item', {id}),
	setCloseToTray: (enabled: boolean) =>
		invoke<void>('set_close_to_tray', {enabled}),
	setStartMinimized: (enabled: boolean) =>
		invoke<void>('set_start_minimized', {enabled}),
	syncTrayRecents: (paths: string[]) =>
		invoke<void>('sync_tray_recents', {paths}),
	toggleMainWindow: () => invoke<void>('toggle_main_window_cmd'),
	readTextPreview: (path: string, maxBytes?: number) =>
		invoke<string>('read_text_preview', {path, maxBytes}),
	getHome: () => invoke<string>('get_home'),
	getKnownFolders: () => invoke<KnownFolder[]>('get_known_folders'),
	getStartupPath: () => invoke<string | null>('get_startup_path'),
	parentPath: (path: string) => invoke<string | null>('parent_path', {path}),
	resolvePath: (path: string) => invoke<FileEntry>('resolve_path', {path}),
	searchByName: (
		root: string,
		query: string,
		maxResults?: number,
		jobId?: string,
	) =>
		invoke<SearchResult>('search_by_name', {
			root,
			query,
			maxResults,
			jobId: jobId ?? null,
		}),
	cancelSearch: (jobId: string) => invoke<void>('cancel_search', {jobId}),
	getRegistryStatus: () => invoke<RegistryBackupStatus>('get_registry_status'),
	backupFolderHandlers: () => invoke<string>('backup_folder_handlers'),
	setAsDefault: () => invoke<string>('set_as_default_folder_handler'),
	restoreDefaults: () => invoke<string>('restore_folder_handlers'),
	createRestorePoint: (description?: string) =>
		invoke<string>('create_system_restore_point', {description}),
	fileLocksmithQuery: (paths: string[], kill = false, exe?: string | null) =>
		invoke<LocksmithResult>('file_locksmith_query', {
			paths,
			kill,
			exe: exe ?? null,
		}),
	openPeek: (path: string, exe?: string | null) =>
		invoke<void>('open_peek', {path, exe: exe ?? null}),
	openTerminal: (path: string, exe?: string | null) =>
		invoke<void>('open_terminal', {path, exe: exe ?? null}),
}

export type LocksmithProcess = {
	pid: number
	name: string
	user: string
	files: string[]
}

export type LocksmithResult = {
	processes: LocksmithProcess[]
}

export function formatSize(bytes: number): string {
	if (bytes <= 0) return ''
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let value = bytes
	let i = 0
	while (value >= 1024 && i < units.length - 1) {
		value /= 1024
		i += 1
	}
	return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

export function formatDate(ts: number | null): string {
	if (ts == null) return ''
	try {
		return new Date(ts).toLocaleString(undefined, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		})
	} catch {
		return ''
	}
}

export function pathJoin(parent: string, name: string): string {
	if (!parent) return name
	const sep = parent.includes('\\') ? '\\' : '/'
	if (parent.endsWith(sep) || /^[A-Za-z]:$/.test(parent)) {
		return `${parent}${parent.endsWith(sep) ? '' : sep}${name}`
	}
	return `${parent}${sep}${name}`
}

export function pathBasename(path: string): string {
	const normalized = path.replace(/[\\/]+$/, '')
	const parts = normalized.split(/[\\/]/)
	return parts[parts.length - 1] || path
}

export function splitPath(path: string): {root: string; parts: string[]} {
	if (/^[A-Za-z]:[\\/]?/.test(path)) {
		const root = path.slice(0, 2) + '\\'
		const rest = path.slice(2).replace(/^[\\/]/, '')
		return {
			root,
			parts: rest ? rest.split(/[\\/]/).filter(Boolean) : [],
		}
	}
	const parts = path.split('/').filter(Boolean)
	return {root: '/', parts}
}
