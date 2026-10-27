import {formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {FileEntry} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface SearchResultsPanelProps {
	locale: Locale
	query: string
	rootPath: string
	entries: FileEntry[]
	selected: Set<string>
	searching: boolean
	truncated: boolean
	cancelled: boolean
	onSelect: (entry: FileEntry, e: React.MouseEvent) => void
	onOpen: (entry: FileEntry) => void
	onOpenContaining: (entry: FileEntry) => void
	onCancelSearch: () => void
	onClearSearch: () => void
	onContextMenu: (entry: FileEntry, e: React.MouseEvent) => void
}

function parentLabel(path: string): string {
	const normalized = path.replace(/[\\/]+$/, '')
	const idx = Math.max(
		normalized.lastIndexOf('\\'),
		normalized.lastIndexOf('/'),
	)
	if (idx <= 0) return normalized
	return normalized.slice(0, idx)
}

export function SearchResultsPanel({
	locale,
	query,
	rootPath,
	entries,
	selected,
	searching,
	truncated,
	cancelled,
	onSelect,
	onOpen,
	onOpenContaining,
	onCancelSearch,
	onClearSearch,
	onContextMenu,
}: SearchResultsPanelProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex items-center gap-2 border-b border-[var(--xp-border)] px-3 py-2 text-sm">
				<div className="min-w-0 flex-1">
					<div className="font-medium">
						{L('searchResults')}
						{query ? <span className="opacity-70"> · “{query}”</span> : null}
					</div>
					<div className="truncate text-xs opacity-60">
						{rootPath}
						{' · '}
						{searching
							? L('searchSearching')
							: cancelled
								? L('searchCancelled')
								: `${entries.length} ${L('items')}`}
						{truncated ? ` · ${L('truncated')}` : ''}
					</div>
				</div>
				{searching ? (
					<button
						type="button"
						className="shrink-0 rounded border border-[var(--xp-border)] px-2 py-1 text-xs hover:bg-[var(--xp-hover)]"
						onClick={onCancelSearch}
					>
						{L('cancel')}
					</button>
				) : (
					<button
						type="button"
						className="shrink-0 rounded border border-[var(--xp-border)] px-2 py-1 text-xs hover:bg-[var(--xp-hover)]"
						onClick={onClearSearch}
					>
						{L('clearSearch')}
					</button>
				)}
			</div>

			{searching && entries.length === 0 ? (
				<div className="flex flex-1 items-center justify-center text-sm opacity-50">
					{L('searchSearching')}…
				</div>
			) : entries.length === 0 ? (
				<div className="flex flex-1 items-center justify-center text-sm opacity-50">
					{cancelled ? L('searchCancelled') : L('searchNoResults')}
				</div>
			) : (
				<ul className="min-h-0 flex-1 overflow-auto">
					{entries.map(entry => {
						const isSelected = selected.has(entry.path)
						const parent = parentLabel(entry.path)
						return (
							<li
								key={entry.path}
								data-path={entry.path}
								className={`flex items-center gap-2 border-b border-[var(--xp-border)]/40 px-3 py-1.5 text-sm ${
									isSelected
										? 'bg-[var(--xp-select)]'
										: 'hover:bg-[var(--xp-hover)]'
								}`}
								onClick={e => onSelect(entry, e)}
								onDoubleClick={() => onOpen(entry)}
								onContextMenu={e => onContextMenu(entry, e)}
							>
								<FileIcon entry={entry} />
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium">{entry.name}</div>
									<div
										className="truncate text-xs opacity-50"
										title={parent}
									>
										{parent}
									</div>
								</div>
								{!entry.isDir && entry.size > 0 ? (
									<span className="shrink-0 text-xs opacity-50">
										{formatSize(entry.size)}
									</span>
								) : null}
								<button
									type="button"
									className="shrink-0 rounded border border-[var(--xp-border)] px-2 py-0.5 text-xs opacity-80 hover:bg-[var(--xp-hover)] hover:opacity-100"
									title={L('openContaining')}
									onClick={e => {
										e.stopPropagation()
										onOpenContaining(entry)
									}}
								>
									{L('openContaining')}
								</button>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
