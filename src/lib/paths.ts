/** Sentinel path for the Files-style Home page. */
export const HOME_PATH = 'home:'

/** Sentinel path for the Recycle Bin view. */
export const RECYCLE_PATH = 'recycle:'

export function isHomePath(path: string): boolean {
	return path === HOME_PATH || path.startsWith('home:')
}

export function isRecyclePath(path: string): boolean {
	return path === RECYCLE_PATH || path.startsWith('recycle:')
}

export function isVirtualPath(path: string): boolean {
	return isHomePath(path) || isRecyclePath(path)
}

export function displayPathTitle(path: string): string {
	if (isHomePath(path)) return 'Home'
	if (isRecyclePath(path)) return 'Recycle Bin'
	const normalized = path.replace(/[\\/]+$/, '')
	const parts = normalized.split(/[\\/]/)
	return parts[parts.length - 1] || path
}
