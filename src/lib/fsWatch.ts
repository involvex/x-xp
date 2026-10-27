import {invoke} from '@tauri-apps/api/core'
import {listen, type UnlistenFn} from '@tauri-apps/api/event'

export type FsChangedPayload = {path: string}

export function pathsEqual(a: string, b: string): boolean {
	return (
		a.replace(/[\\/]+$/, '').toLowerCase() ===
		b.replace(/[\\/]+$/, '').toLowerCase()
	)
}

export async function watchDir(path: string): Promise<void> {
	await invoke('watch_dir', {path})
}

export async function unwatchDir(path: string): Promise<void> {
	await invoke('unwatch_dir', {path})
}

export function listenFsChanged(
	handler: (path: string) => void,
): Promise<UnlistenFn> {
	return listen<FsChangedPayload>('fs-changed', event => {
		handler(event.payload.path)
	})
}
