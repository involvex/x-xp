/** Drag payload for sidebar / home folder shortcuts (open / snap to pane). */
export const NAV_DND_MIME = 'application/x-xp-nav-path'

export function setNavDragData(dt: DataTransfer, path: string): void {
	dt.setData(NAV_DND_MIME, path)
	dt.effectAllowed = 'copyMove'
}

export function getNavDragPath(dt: DataTransfer): string | null {
	const p = dt.getData(NAV_DND_MIME)
	return p.trim() ? p : null
}

export function hasNavDrag(dt: DataTransfer): boolean {
	return [...dt.types].includes(NAV_DND_MIME)
}
