export interface FileEntry {
	name: string
	path: string
	isDir: boolean
	size: number
	extension: string
	modified: number | null
	readonly: boolean
	hidden: boolean
}

export interface KnownFolder {
	id: string
	label: string
	path: string
}

export interface SearchResult {
	entries: FileEntry[]
	truncated: boolean
	cancelled?: boolean
}

export interface RegistryBackupStatus {
	hasBackup: boolean
	isDefault: boolean
	backupKeys: string[]
	message: string
}

export type ViewMode = 'details' | 'list' | 'icons' | 'columns'

export interface TagDef {
	id: string
	name: string
	color: string
}

export interface TagMap {
	/** path → tag ids */
	[path: string]: string[]
}

export type SortKey = 'name' | 'size' | 'modified'

export type SortDir = 'asc' | 'desc'

export interface SortState {
	key: SortKey
	dir: SortDir
}

export type ClipboardMode = 'copy' | 'cut'

export interface ClipboardState {
	mode: ClipboardMode
	paths: string[]
}

export interface ExplorerTab {
	id: string
	title: string
	path: string
	history: string[]
	historyIndex: number
}

/** Persisted window session restored on launch. */
export interface SessionSnapshot {
	version: 1
	tabs: ExplorerTab[]
	activeTabId: string
	rightPath: string
	activePane: 'left' | 'right'
	sort: SortState
	tagFilter: string | null
}

export interface Bookmark {
	id: string
	label: string
	path: string
}

/** User prefs for Quick access / known folders sidebar section. */
export interface QuickAccessPrefs {
	order: string[]
	labels: Record<string, string>
	hidden: string[]
}

export interface EntryProperties {
	name: string
	path: string
	location: string
	isDir: boolean
	kind: string
	extension: string
	size: number
	sizeOnDisk: number
	fileCount: number
	folderCount: number
	created: number | null
	modified: number | null
	readonly: boolean
	hidden: boolean
}

/** Windows Recycle Bin entry surfaced to the UI. */
export interface RecycleItem {
	id: string
	name: string
	originalPath: string
	deletedDate: string
	sizeDisplay: string
	isDir: boolean
}
