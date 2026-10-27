/** Built-in context menu action ids. */
export type BuiltinMenuAction =
	| 'open'
	| 'openSystem'
	| 'openNewTab'
	| 'openNewWindow'
	| 'openOtherPane'
	| 'addBookmark'
	| 'openWith'
	| 'copyPath'
	| 'cut'
	| 'copy'
	| 'paste'
	| 'newFolder'
	| 'newFile'
	| 'rename'
	| 'delete'
	| 'properties'
	| 'tags'
	| 'extractHere'
	| 'extractTo'
	| 'compressZip'
	| 'customizeMenu'
	| 'separator'

export type MenuTarget =
	'any' | 'item' | 'dir' | 'file' | 'empty' | 'archive' | 'selection'

export interface OpenWithApp {
	id: string
	label: string
	program: string
	/** Use `{path}` placeholder; path is appended if missing. */
	args: string[]
	/** Where this app appears */
	targets: 'both' | 'dir' | 'file'
	enabled: boolean
}

export interface ContextMenuItemConfig {
	id: string
	/** Builtin action or custom open-with id prefixed with `ow:` */
	action: BuiltinMenuAction | `ow:${string}`
	enabled: boolean
	/** When this row is shown */
	when: MenuTarget
}

export interface ContextMenuSettings {
	version: 1
	items: ContextMenuItemConfig[]
	openWith: OpenWithApp[]
}

export const DEFAULT_OPEN_WITH: OpenWithApp[] = [
	{
		id: 'notepad',
		label: 'Notepad',
		program: 'notepad.exe',
		args: ['{path}'],
		targets: 'file',
		enabled: true,
	},
	{
		id: 'wt',
		label: 'Windows Terminal',
		program: 'wt.exe',
		args: ['-d', '{path}'],
		targets: 'dir',
		enabled: true,
	},
	{
		id: 'cmd',
		label: 'Command Prompt',
		program: 'cmd.exe',
		args: ['/K', 'cd /d "{path}"'],
		targets: 'dir',
		enabled: true,
	},
	{
		id: 'powershell',
		label: 'PowerShell',
		program: 'powershell.exe',
		args: ['-NoExit', '-Command', "Set-Location -LiteralPath '{path}'"],
		targets: 'dir',
		enabled: true,
	},
	{
		id: 'cursor',
		label: 'Cursor',
		program: 'cursor',
		args: ['{path}'],
		targets: 'both',
		enabled: true,
	},
	{
		id: 'code',
		label: 'VS Code',
		program: 'code',
		args: ['{path}'],
		targets: 'both',
		enabled: false,
	},
]

export const DEFAULT_MENU_ITEMS: ContextMenuItemConfig[] = [
	{id: 'open', action: 'open', enabled: true, when: 'item'},
	{id: 'openSystem', action: 'openSystem', enabled: true, when: 'item'},
	{id: 'openNewTab', action: 'openNewTab', enabled: true, when: 'dir'},
	{id: 'openNewWindow', action: 'openNewWindow', enabled: true, when: 'dir'},
	{id: 'openOtherPane', action: 'openOtherPane', enabled: true, when: 'dir'},
	{id: 'addBookmark', action: 'addBookmark', enabled: true, when: 'dir'},
	{id: 'sep1', action: 'separator', enabled: true, when: 'item'},
	{id: 'openWith', action: 'openWith', enabled: true, when: 'item'},
	{id: 'sep2', action: 'separator', enabled: true, when: 'any'},
	{id: 'copyPath', action: 'copyPath', enabled: true, when: 'item'},
	{id: 'cut', action: 'cut', enabled: true, when: 'item'},
	{id: 'copy', action: 'copy', enabled: true, when: 'item'},
	{id: 'paste', action: 'paste', enabled: true, when: 'any'},
	{id: 'sep3', action: 'separator', enabled: true, when: 'any'},
	{id: 'extractHere', action: 'extractHere', enabled: true, when: 'archive'},
	{id: 'extractTo', action: 'extractTo', enabled: true, when: 'archive'},
	{id: 'compressZip', action: 'compressZip', enabled: true, when: 'selection'},
	{id: 'sepArchive', action: 'separator', enabled: true, when: 'any'},
	{id: 'newFolder', action: 'newFolder', enabled: true, when: 'any'},
	{id: 'newFile', action: 'newFile', enabled: true, when: 'any'},
	{id: 'rename', action: 'rename', enabled: true, when: 'item'},
	{id: 'delete', action: 'delete', enabled: true, when: 'item'},
	{id: 'sep4', action: 'separator', enabled: true, when: 'item'},
	{id: 'tags', action: 'tags', enabled: true, when: 'item'},
	{id: 'properties', action: 'properties', enabled: true, when: 'item'},
	{id: 'sep5', action: 'separator', enabled: true, when: 'any'},
	{id: 'customizeMenu', action: 'customizeMenu', enabled: true, when: 'any'},
]

export function defaultContextMenuSettings(): ContextMenuSettings {
	return {
		version: 1,
		items: DEFAULT_MENU_ITEMS.map(i => ({...i})),
		openWith: DEFAULT_OPEN_WITH.map(a => ({...a, args: [...a.args]})),
	}
}

export function isZipPath(path: string | null | undefined): boolean {
	if (!path) return false
	return /\.zip$/i.test(path)
}

export function matchesTarget(
	when: MenuTarget,
	ctx: {
		hasPath: boolean
		isDir: boolean
		isArchive: boolean
		hasSelection: boolean
	},
): boolean {
	switch (when) {
		case 'any':
			return true
		case 'item':
			return ctx.hasPath
		case 'dir':
			return ctx.hasPath && ctx.isDir
		case 'file':
			return ctx.hasPath && !ctx.isDir
		case 'empty':
			return !ctx.hasPath
		case 'archive':
			return ctx.hasPath && !ctx.isDir && ctx.isArchive
		case 'selection':
			return ctx.hasSelection
		default:
			return true
	}
}

export function actionLabelKey(action: BuiltinMenuAction): string | null {
	switch (action) {
		case 'open':
			return 'open'
		case 'openSystem':
			return 'openSystem'
		case 'openNewTab':
			return 'openNewTab'
		case 'openNewWindow':
			return 'openNewWindow'
		case 'openOtherPane':
			return 'openOtherPane'
		case 'addBookmark':
			return 'addBookmark'
		case 'openWith':
			return 'openWith'
		case 'copyPath':
			return 'copyPath'
		case 'cut':
			return 'cut'
		case 'copy':
			return 'copy'
		case 'paste':
			return 'paste'
		case 'newFolder':
			return 'newFolder'
		case 'newFile':
			return 'newFile'
		case 'rename':
			return 'rename'
		case 'delete':
			return 'delete'
		case 'properties':
			return 'properties'
		case 'tags':
			return 'tags'
		case 'extractHere':
			return 'extractHere'
		case 'extractTo':
			return 'extractTo'
		case 'compressZip':
			return 'compressZip'
		case 'customizeMenu':
			return 'customizeMenu'
		default:
			return null
	}
}

/** Merge persisted menu with new default rows so upgrades pick up actions. */
export function mergeContextMenuSettings(
	raw: ContextMenuSettings | null | undefined,
): ContextMenuSettings {
	const defaults = defaultContextMenuSettings()
	if (!raw || raw.version !== 1 || !Array.isArray(raw.items)) {
		return defaults
	}
	const byId = new Map(raw.items.map(i => [i.id, i]))
	const items: ContextMenuItemConfig[] = []
	for (const def of defaults.items) {
		const existing = byId.get(def.id)
		if (existing) {
			items.push({
				...def,
				enabled: existing.enabled,
				when: existing.when ?? def.when,
			})
			byId.delete(def.id)
		} else {
			items.push({...def})
		}
	}
	for (const leftover of byId.values()) {
		items.push(leftover)
	}
	return {
		version: 1,
		items,
		openWith:
			Array.isArray(raw.openWith) && raw.openWith.length > 0
				? raw.openWith
				: defaults.openWith,
	}
}
