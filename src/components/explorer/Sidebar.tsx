import {t, type Locale} from '../../lib/i18n'
import type {Bookmark, FileEntry, KnownFolder} from '../../types/fs'

interface SidebarProps {
	locale: Locale
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	currentPath: string
	onNavigate: (path: string) => void
	onRemoveBookmark: (id: string) => void
}

export function Sidebar({
	locale,
	drives,
	known,
	bookmarks,
	currentPath,
	onNavigate,
	onRemoveBookmark,
}: SidebarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const item = (active: boolean) =>
		`w-full text-left rounded px-2 py-1.5 text-sm truncate ${
			active ? 'bg-[var(--xp-select)]' : 'hover:bg-[var(--xp-hover)]'
		}`

	return (
		<aside className="flex w-52 shrink-0 flex-col gap-3 overflow-auto border-r border-[var(--xp-border)] bg-[var(--xp-panel)] p-2 text-sm">
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('folders')}
				</h2>
				{known.map(f => (
					<button
						key={f.id}
						type="button"
						className={item(currentPath === f.path)}
						onClick={() => onNavigate(f.path)}
					>
						{f.label}
					</button>
				))}
			</section>
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('drives')}
				</h2>
				{drives.map(d => (
					<button
						key={d.path}
						type="button"
						className={item(
							currentPath.toLowerCase().startsWith(d.path.toLowerCase()),
						)}
						onClick={() => onNavigate(d.path)}
					>
						{d.name}
					</button>
				))}
			</section>
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('bookmarks')}
				</h2>
				{bookmarks.length === 0 && <p className="px-2 text-xs opacity-40">—</p>}
				{bookmarks.map(b => (
					<div
						key={b.id}
						className="group flex items-center gap-1"
					>
						<button
							type="button"
							className={`${item(currentPath === b.path)} flex-1`}
							onClick={() => onNavigate(b.path)}
						>
							{b.label}
						</button>
						<button
							type="button"
							className="hidden px-1 opacity-50 group-hover:inline hover:opacity-100"
							onClick={() => onRemoveBookmark(b.id)}
							title={L('removeBookmark')}
						>
							×
						</button>
					</div>
				))}
			</section>
		</aside>
	)
}
