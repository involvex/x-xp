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

export interface Bookmark {
	id: string
	label: string
	path: string
}
