import {LazyStore} from '@tauri-apps/plugin-store'
import type {Bookmark, TagDef, TagMap, ViewMode} from '../types/fs'
import type {Locale} from './i18n'
import {HOME_PATH, isHomePath} from './paths'

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

export async function loadShowPreview(): Promise<boolean> {
	return (await store.get<boolean>('showPreview')) ?? false
}

export async function saveShowPreview(value: boolean): Promise<void> {
	await store.set('showPreview', value)
	await store.save()
}

export async function loadShowHidden(): Promise<boolean> {
	return (await store.get<boolean>('showHidden')) ?? false
}

export async function saveShowHidden(value: boolean): Promise<void> {
	await store.set('showHidden', value)
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
	if (!path || isHomePath(path)) {
		return loadRecentPaths()
	}
	const prev = await loadRecentPaths()
	const next = [path, ...prev.filter(p => p !== path)].slice(0, RECENT_CAP)
	await store.set('recentPaths', next)
	await store.save()
	return next
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

export {DEFAULT_TAGS, HOME_PATH}
