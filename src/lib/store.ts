import {LazyStore} from '@tauri-apps/plugin-store'
import type {
	Bookmark,
	ExplorerTab,
	KnownFolder,
	QuickAccessPrefs,
	SessionSnapshot,
	SortDir,
	SortKey,
	SortState,
	TagDef,
	TagMap,
	ViewMode,
} from '../types/fs'
import {
	mergeContextMenuSettings,
	type ContextMenuSettings,
} from './contextMenuConfig'
import type {Locale} from './i18n'
import {HOME_PATH, isVirtualPath} from './paths'

export const DEFAULT_GLOBAL_HOTKEY = 'Ctrl+Alt+E'

export interface DesktopPrefs {
	globalHotkey: string
	closeToTray: boolean
	startMinimized: boolean
}

export function defaultDesktopPrefs(): DesktopPrefs {
	return {
		globalHotkey: DEFAULT_GLOBAL_HOTKEY,
		closeToTray: true,
		startMinimized: false,
	}
}

const store = new LazyStore('settings.json')
const RECENT_CAP = 20

const DEFAULT_TAGS: TagDef[] = [
	{id: 'work', name: 'Work', color: '#3b82f6'},
	{id: 'photos', name: 'Photos', color: '#22c55e'},
	{id: 'important', name: 'Important', color: '#ef4444'},
	{id: 'archive', name: 'Archive', color: '#a855f7'},
]

const VIEW_MODES: ViewMode[] = ['details', 'list', 'icons', 'columns']

export async function loadLastPath(): Promise<string | null> {
	return (await store.get<string>('lastPath')) ?? null
}

export async function saveLastPath(path: string): Promise<void> {
	await store.set('lastPath', path)
	await store.save()
}

export async function loadViewMode(): Promise<ViewMode> {
	const v = await store.get<string>('viewMode')
	return VIEW_MODES.includes(v as ViewMode) ? (v as ViewMode) : 'details'
}

export async function saveViewMode(mode: ViewMode): Promise<void> {
	await store.set('viewMode', mode)
	await store.save()
}

export async function loadBookmarks(): Promise<Bookmark[]> {
	return (await store.get<Bookmark[]>('bookmarks')) ?? []
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
	await store.set('bookmarks', bookmarks)
	await store.save()
}

export async function loadDualPane(): Promise<boolean> {
	return (await store.get<boolean>('dualPane')) ?? false
}

export async function saveDualPane(value: boolean): Promise<void> {
	await store.set('dualPane', value)
	await store.save()
}

/** Left pane share of the dual-pane area (0–1). */
export const DUAL_SPLIT_DEFAULT = 0.5
export const DUAL_SPLIT_MIN = 0.2
export const DUAL_SPLIT_MAX = 0.8

export function clampDualSplit(ratio: number): number {
	if (!Number.isFinite(ratio)) return DUAL_SPLIT_DEFAULT
	return Math.min(DUAL_SPLIT_MAX, Math.max(DUAL_SPLIT_MIN, ratio))
}

export async function loadDualSplit(): Promise<number> {
	const v = await store.get<number>('dualSplit')
	return typeof v === 'number' ? clampDualSplit(v) : DUAL_SPLIT_DEFAULT
}

export async function saveDualSplit(ratio: number): Promise<void> {
	await store.set('dualSplit', clampDualSplit(ratio))
	await store.save()
}

export async function loadShowPreview(): Promise<boolean> {
	return (await store.get<boolean>('showPreview')) ?? false
}

export async function saveShowPreview(value: boolean): Promise<void> {
	await store.set('showPreview', value)
	await store.save()
}

export const PREVIEW_WIDTH_DEFAULT = 320
export const PREVIEW_WIDTH_MIN = 220
export const PREVIEW_WIDTH_MAX = 720

export function clampPreviewWidth(width: number): number {
	if (!Number.isFinite(width)) return PREVIEW_WIDTH_DEFAULT
	return Math.min(
		PREVIEW_WIDTH_MAX,
		Math.max(PREVIEW_WIDTH_MIN, Math.round(width)),
	)
}

export async function loadPreviewWidth(): Promise<number> {
	const v = await store.get<number>('previewWidth')
	return typeof v === 'number' ? clampPreviewWidth(v) : PREVIEW_WIDTH_DEFAULT
}

export async function savePreviewWidth(width: number): Promise<void> {
	await store.set('previewWidth', clampPreviewWidth(width))
	await store.save()
}

/** Sidebar rail width in px (was Tailwind w-52 ≈ 208). */
export const SIDEBAR_WIDTH_DEFAULT = 208
export const SIDEBAR_WIDTH_MIN = 160
export const SIDEBAR_WIDTH_MAX = 420

export function clampSidebarWidth(width: number): number {
	if (!Number.isFinite(width)) return SIDEBAR_WIDTH_DEFAULT
	return Math.min(
		SIDEBAR_WIDTH_MAX,
		Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)),
	)
}

export async function loadSidebarWidth(): Promise<number> {
	const v = await store.get<number>('sidebarWidth')
	return typeof v === 'number' ? clampSidebarWidth(v) : SIDEBAR_WIDTH_DEFAULT
}

export async function saveSidebarWidth(width: number): Promise<void> {
	await store.set('sidebarWidth', clampSidebarWidth(width))
	await store.save()
}

export async function loadSidebarCollapsed(): Promise<boolean> {
	return (await store.get<boolean>('sidebarCollapsed')) ?? false
}

export async function saveSidebarCollapsed(value: boolean): Promise<void> {
	await store.set('sidebarCollapsed', value)
	await store.save()
}

export type UiFontStyle = 'mono' | 'sans' | 'serif'

export const FONT_STYLE_STACKS: Record<UiFontStyle, string> = {
	mono: "'Cascadia Code', 'JetBrains Mono', 'Consolas', ui-monospace, monospace",
	sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
	serif: "Georgia, 'Times New Roman', serif",
}

export const UI_FONT_SIZE_DEFAULT = 14
export const UI_FONT_SIZE_MIN = 11
export const UI_FONT_SIZE_MAX = 20
export const UI_ZOOM_DEFAULT = 1
export const UI_ZOOM_MIN = 0.75
export const UI_ZOOM_MAX = 1.5
export const UI_ZOOM_STEP = 0.1

export interface UiAppearance {
	fontStyle: UiFontStyle
	fontSize: number
	zoom: number
}

export function defaultUiAppearance(): UiAppearance {
	return {
		fontStyle: 'mono',
		fontSize: UI_FONT_SIZE_DEFAULT,
		zoom: UI_ZOOM_DEFAULT,
	}
}

export function clampFontSize(size: number): number {
	if (!Number.isFinite(size)) return UI_FONT_SIZE_DEFAULT
	return Math.min(
		UI_FONT_SIZE_MAX,
		Math.max(UI_FONT_SIZE_MIN, Math.round(size)),
	)
}

export function clampUiZoom(zoom: number): number {
	if (!Number.isFinite(zoom)) return UI_ZOOM_DEFAULT
	const stepped = Math.round(zoom / UI_ZOOM_STEP) * UI_ZOOM_STEP
	return Math.min(
		UI_ZOOM_MAX,
		Math.max(UI_ZOOM_MIN, Number(stepped.toFixed(2))),
	)
}

export function applyUiAppearance(appearance: UiAppearance): void {
	const root = document.documentElement
	root.style.setProperty(
		'--xp-font-family',
		FONT_STYLE_STACKS[appearance.fontStyle] ?? FONT_STYLE_STACKS.mono,
	)
	root.style.setProperty(
		'--xp-font-size',
		`${clampFontSize(appearance.fontSize)}px`,
	)
	root.style.setProperty('--xp-ui-zoom', String(clampUiZoom(appearance.zoom)))
}

export async function loadUiAppearance(): Promise<UiAppearance> {
	const raw = await store.get<Partial<UiAppearance>>('uiAppearance')
	const base = defaultUiAppearance()
	if (!raw || typeof raw !== 'object') return base
	const fontStyle =
		raw.fontStyle === 'sans' ||
		raw.fontStyle === 'serif' ||
		raw.fontStyle === 'mono'
			? raw.fontStyle
			: base.fontStyle
	return {
		fontStyle,
		fontSize: clampFontSize(
			typeof raw.fontSize === 'number' ? raw.fontSize : base.fontSize,
		),
		zoom: clampUiZoom(typeof raw.zoom === 'number' ? raw.zoom : base.zoom),
	}
}

export async function saveUiAppearance(
	appearance: UiAppearance,
): Promise<void> {
	await store.set('uiAppearance', {
		fontStyle: appearance.fontStyle,
		fontSize: clampFontSize(appearance.fontSize),
		zoom: clampUiZoom(appearance.zoom),
	})
	await store.save()
}

export async function loadShowHidden(): Promise<boolean> {
	return (await store.get<boolean>('showHidden')) ?? false
}

export async function saveShowHidden(value: boolean): Promise<void> {
	await store.set('showHidden', value)
	await store.save()
}

export async function loadShowFolderSizes(): Promise<boolean> {
	return (await store.get<boolean>('showFolderSizes')) ?? false
}

export async function saveShowFolderSizes(value: boolean): Promise<void> {
	await store.set('showFolderSizes', value)
	await store.save()
}

export async function loadAutoRefreshFolders(): Promise<boolean> {
	return (await store.get<boolean>('autoRefreshFolders')) ?? true
}

export async function saveAutoRefreshFolders(value: boolean): Promise<void> {
	await store.set('autoRefreshFolders', value)
	await store.save()
}

export async function loadLocale(): Promise<Locale> {
	const v = await store.get<string>('locale')
	return v === 'de' ? 'de' : 'en'
}

export async function saveLocale(locale: Locale): Promise<void> {
	await store.set('locale', locale)
	await store.save()
}

export async function loadRecentPaths(): Promise<string[]> {
	return (await store.get<string[]>('recentPaths')) ?? []
}

export async function pushRecentPath(path: string): Promise<string[]> {
	if (!path || isVirtualPath(path)) {
		return loadRecentPaths()
	}
	const prev = await loadRecentPaths()
	const next = [path, ...prev.filter(p => p !== path)].slice(0, RECENT_CAP)
	await store.set('recentPaths', next)
	await store.save()
	return next
}

export async function loadDesktopPrefs(): Promise<DesktopPrefs> {
	const raw = await store.get<Partial<DesktopPrefs>>('desktop')
	const defaults = defaultDesktopPrefs()
	if (!raw || typeof raw !== 'object') return defaults
	return {
		globalHotkey:
			typeof raw.globalHotkey === 'string'
				? raw.globalHotkey
				: defaults.globalHotkey,
		closeToTray:
			typeof raw.closeToTray === 'boolean'
				? raw.closeToTray
				: defaults.closeToTray,
		startMinimized:
			typeof raw.startMinimized === 'boolean'
				? raw.startMinimized
				: defaults.startMinimized,
	}
}

export async function saveDesktopPrefs(prefs: DesktopPrefs): Promise<void> {
	await store.set('desktop', prefs)
	await store.save()
}

export async function loadTagDefs(): Promise<TagDef[]> {
	const v = await store.get<TagDef[]>('tagDefs')
	return v && v.length > 0 ? v : DEFAULT_TAGS
}

export async function saveTagDefs(tags: TagDef[]): Promise<void> {
	await store.set('tagDefs', tags)
	await store.save()
}

export async function loadTagMap(): Promise<TagMap> {
	return (await store.get<TagMap>('tagMap')) ?? {}
}

export async function saveTagMap(map: TagMap): Promise<void> {
	await store.set('tagMap', map)
	await store.save()
}

const SORT_KEYS: SortKey[] = ['name', 'size', 'modified']
const SORT_DIRS: SortDir[] = ['asc', 'desc']

export function defaultSort(): SortState {
	return {key: 'name', dir: 'asc'}
}

function sanitizeSort(raw: unknown): SortState {
	if (!raw || typeof raw !== 'object') return defaultSort()
	const s = raw as Partial<SortState>
	const key = SORT_KEYS.includes(s.key as SortKey) ? (s.key as SortKey) : 'name'
	const dir = SORT_DIRS.includes(s.dir as SortDir) ? (s.dir as SortDir) : 'asc'
	return {key, dir}
}

function sanitizeTab(raw: unknown): ExplorerTab | null {
	if (!raw || typeof raw !== 'object') return null
	const t = raw as Partial<ExplorerTab>
	if (typeof t.path !== 'string' || !t.path) return null
	const history = Array.isArray(t.history)
		? t.history.filter((p): p is string => typeof p === 'string' && !!p)
		: [t.path]
	const historyIndex =
		typeof t.historyIndex === 'number'
			? Math.min(Math.max(0, Math.floor(t.historyIndex)), history.length - 1)
			: history.length - 1
	const path =
		typeof history[historyIndex] === 'string' ? history[historyIndex] : t.path
	return {
		id: typeof t.id === 'string' && t.id ? t.id : crypto.randomUUID(),
		title: typeof t.title === 'string' && t.title ? t.title : path,
		path,
		history: history.length > 0 ? history : [path],
		historyIndex,
	}
}

export async function loadSession(): Promise<SessionSnapshot | null> {
	const raw = await store.get<SessionSnapshot>('session')
	if (!raw || raw.version !== 1 || !Array.isArray(raw.tabs)) return null
	const tabs = raw.tabs.map(sanitizeTab).filter((t): t is ExplorerTab => !!t)
	if (tabs.length === 0) return null
	const activeTabId =
		typeof raw.activeTabId === 'string' &&
		tabs.some(t => t.id === raw.activeTabId)
			? raw.activeTabId
			: tabs[0].id
	return {
		version: 1,
		tabs,
		activeTabId,
		rightPath:
			typeof raw.rightPath === 'string' && raw.rightPath
				? raw.rightPath
				: HOME_PATH,
		activePane: raw.activePane === 'right' ? 'right' : 'left',
		sort: sanitizeSort(raw.sort),
		tagFilter: typeof raw.tagFilter === 'string' ? raw.tagFilter : null,
	}
}

export async function saveSession(session: SessionSnapshot): Promise<void> {
	await store.set('session', session)
	await store.save()
}

export async function loadContextMenuSettings(): Promise<ContextMenuSettings> {
	const raw = await store.get<ContextMenuSettings>('contextMenu')
	return mergeContextMenuSettings(raw)
}

export async function saveContextMenuSettings(
	settings: ContextMenuSettings,
): Promise<void> {
	await store.set('contextMenu', settings)
	await store.save()
}

export function defaultQuickAccessPrefs(): QuickAccessPrefs {
	return {order: [], labels: {}, hidden: []}
}

export async function loadQuickAccessPrefs(): Promise<QuickAccessPrefs> {
	const raw = await store.get<Partial<QuickAccessPrefs>>('quickAccess')
	if (!raw || typeof raw !== 'object') return defaultQuickAccessPrefs()
	return {
		order: Array.isArray(raw.order)
			? raw.order.filter((id): id is string => typeof id === 'string')
			: [],
		labels:
			raw.labels && typeof raw.labels === 'object' && !Array.isArray(raw.labels)
				? Object.fromEntries(
						Object.entries(raw.labels).filter(
							(e): e is [string, string] => typeof e[1] === 'string',
						),
					)
				: {},
		hidden: Array.isArray(raw.hidden)
			? raw.hidden.filter((id): id is string => typeof id === 'string')
			: [],
	}
}

export async function saveQuickAccessPrefs(
	prefs: QuickAccessPrefs,
): Promise<void> {
	await store.set('quickAccess', prefs)
	await store.save()
}

/** Apply saved order / labels / hidden to system known folders. */
export function applyQuickAccessPrefs(
	known: KnownFolder[],
	prefs: QuickAccessPrefs,
): KnownFolder[] {
	const hidden = new Set(prefs.hidden)
	const byId = new Map(known.map(k => [k.id, k]))
	const result: KnownFolder[] = []

	for (const id of prefs.order) {
		const k = byId.get(id)
		if (!k || hidden.has(id)) continue
		result.push({...k, label: prefs.labels[id] ?? k.label})
		byId.delete(id)
	}

	for (const k of known) {
		if (!byId.has(k.id) || hidden.has(k.id)) continue
		result.push({...k, label: prefs.labels[k.id] ?? k.label})
	}

	return result
}

export {DEFAULT_TAGS, HOME_PATH}
