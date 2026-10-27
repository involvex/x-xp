import {LazyStore} from '@tauri-apps/plugin-store'
import type {Bookmark, ViewMode} from '../types/fs'
import type {Locale} from './i18n'
import {HOME_PATH, isHomePath} from './paths'

const store = new LazyStore('settings.json')
const RECENT_CAP = 20

export async function loadLastPath(): Promise<string | null> {
	return (await store.get<string>('lastPath')) ?? null
}

export async function saveLastPath(path: string): Promise<void> {
	await store.set('lastPath', path)
	await store.save()
}

export async function loadViewMode(): Promise<ViewMode> {
	return (await store.get<ViewMode>('viewMode')) ?? 'details'
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

export {HOME_PATH}
