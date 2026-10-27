/** Sentinel path for the Files-style Home page. */
export const HOME_PATH = 'home:'

export function isHomePath(path: string): boolean {
	return path === HOME_PATH || path.startsWith('home:')
}

export function displayPathTitle(path: string): string {
	if (isHomePath(path)) return 'Home'
	const normalized = path.replace(/[\\/]+$/, '')
	const parts = normalized.split(/[\\/]/)
	return parts[parts.length - 1] || path
}
