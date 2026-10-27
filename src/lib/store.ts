import {LazyStore} from '@tauri-apps/plugin-store'
import type {Bookmark, ViewMode} from '../types/fs'

const store = new LazyStore('settings.json')

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
