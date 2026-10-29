import type {FileEntry} from '../types/fs'

/** Strip the final extension, e.g. `report.pdf` → `report`. */
export function stripExtension(name: string): string {
	const dot = name.lastIndexOf('.')
	// Keep dotfiles (`.gitignore`) and names without an extension intact.
	if (dot <= 0 || dot === name.length - 1) return name
	return name.slice(0, dot)
}

/**
 * Name shown in the listing. Folders never carry an extension, and the
 * rename input keeps using the raw `entry.name`.
 */
export function displayName(entry: FileEntry, showExtensions: boolean): string {
	if (showExtensions || entry.isDir) return entry.name
	return stripExtension(entry.name)
}
