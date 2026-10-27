import {
	register,
	unregister,
	unregisterAll,
} from '@tauri-apps/plugin-global-shortcut'
import {api} from './api'

let current: string | null = null

/** Register a global summon hotkey (empty string clears). */
export async function applyGlobalHotkey(shortcut: string): Promise<void> {
	const next = shortcut.trim()
	try {
		if (current) {
			await unregister(current).catch(() => undefined)
			current = null
		} else {
			await unregisterAll().catch(() => undefined)
		}
	} catch {
		/* ignore */
	}
	if (!next) return
	await register(next, event => {
		if (event.state !== 'Pressed') return
		void api.toggleMainWindow()
	})
	current = next
}

/** Convert a keyboard event into a Tauri-style accelerator string. */
export function eventToAccelerator(e: {
	key: string
	ctrlKey: boolean
	altKey: boolean
	shiftKey: boolean
	metaKey: boolean
}): string | null {
	if (
		e.key === 'Control' ||
		e.key === 'Shift' ||
		e.key === 'Alt' ||
		e.key === 'Meta'
	) {
		return null
	}
	const parts: string[] = []
	if (e.ctrlKey) parts.push('Ctrl')
	if (e.altKey) parts.push('Alt')
	if (e.shiftKey) parts.push('Shift')
	if (e.metaKey) parts.push('Super')
	let key = e.key
	if (key === ' ') key = 'Space'
	else if (key.length === 1) key = key.toUpperCase()
	else if (key.startsWith('Arrow')) key = key.slice(5)
	else if (/^F\d{1,2}$/i.test(key)) key = key.toUpperCase()
	else return null
	if (parts.length === 0) return null
	parts.push(key)
	return parts.join('+')
}
