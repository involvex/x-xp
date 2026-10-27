import {formatDate, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {FileEntry, SortKey, SortState, ViewMode} from '../../types/fs'

interface FileListProps {
	locale: Locale
	entries: FileEntry[]
	selected: Set<string>
	viewMode: ViewMode
	sort: SortState
	renaming: string | null
	renameValue: string
	onSort: (key: SortKey) => void
	onRenameValue: (v: string) => void
	onCommitRename: () => void
	onCancelRename: () => void
	onClick: (entry: FileEntry, e: React.MouseEvent) => void
	onDoubleClick: (entry: FileEntry) => void
	onContextMenu: (entry: FileEntry, e: React.MouseEvent) => void
}

function icon(entry: FileEntry): string {
	if (entry.isDir) return '📁'
	const ext = entry.extension.toLowerCase()
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
		return '🖼'
	if (['txt', 'md', 'json', 'ts', 'tsx', 'js', 'rs', 'toml'].includes(ext))
		return '📄'
	if (['mp3', 'wav', 'flac'].includes(ext)) return '🎵'
	if (['mp4', 'mkv', 'webm'].includes(ext)) return '🎬'
	return '📄'
}

function sortMark(sort: SortState, key: SortKey): string {
	if (sort.key !== key) return ''
	return sort.dir === 'asc' ? ' ▲' : ' ▼'
}

export function FileList({
	locale,
	entries,
	selected,
	viewMode,
	sort,
	renaming,
	renameValue,
	onSort,
	onRenameValue,
	onCommitRename,
	onCancelRename,
	onClick,
	onDoubleClick,
	onContextMenu,
}: FileListProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	if (entries.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center opacity-40 text-sm">
				{L('empty')}
			</div>
		)
	}

	if (viewMode === 'icons') {
		return (
			<div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 overflow-auto p-3 content-start">
				{entries.map(entry => (
					<button
						key={entry.path}
						type="button"
						className={`flex flex-col items-center gap-1 rounded p-2 text-center text-xs ${
							selected.has(entry.path)
								? 'bg-[var(--xp-select)]'
								: 'hover:bg-[var(--xp-hover)]'
						}`}
						onClick={e => onClick(entry, e)}
						onDoubleClick={() => onDoubleClick(entry)}
						onContextMenu={e => onContextMenu(entry, e)}
					>
						<span className="text-2xl">{icon(entry)}</span>
						<span className="w-full truncate">{entry.name}</span>
					</button>
				))}
			</div>
		)
	}

	const headerBtn =
		'cursor-pointer select-none rounded px-1 hover:bg-[var(--xp-hover)] hover:opacity-100'

	return (
		<div className="flex flex-1 flex-col overflow-auto">
			{viewMode === 'details' && (
				<div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_100px_160px] gap-2 border-b border-[var(--xp-border)] bg-[var(--xp-bg)] px-3 py-1.5 text-xs uppercase tracking-wide opacity-80">
					<button
						type="button"
						className={`${headerBtn} text-left`}
						onClick={() => onSort('name')}
					>
						{L('name')}
						{sortMark(sort, 'name')}
					</button>
					<button
						type="button"
						className={`${headerBtn} text-right`}
						onClick={() => onSort('size')}
					>
						{L('size')}
						{sortMark(sort, 'size')}
					</button>
					<button
						type="button"
						className={`${headerBtn} text-left`}
						onClick={() => onSort('modified')}
					>
						{L('modified')}
						{sortMark(sort, 'modified')}
					</button>
				</div>
			)}
			<ul className="flex flex-col">
				{entries.map(entry => {
					const isSelected = selected.has(entry.path)
					const isRenaming = renaming === entry.path
					return (
						<li
							key={entry.path}
							className={`grid cursor-default grid-cols-[minmax(0,1fr)_100px_160px] items-center gap-2 px-3 py-1.5 text-sm ${
								isSelected
									? 'bg-[var(--xp-select)]'
									: 'hover:bg-[var(--xp-hover)]'
							} ${viewMode === 'list' ? 'grid-cols-1' : ''}`}
							onClick={e => onClick(entry, e)}
							onDoubleClick={() => onDoubleClick(entry)}
							onContextMenu={e => onContextMenu(entry, e)}
						>
							<span className="flex min-w-0 items-center gap-2">
								<span>{icon(entry)}</span>
								{isRenaming ? (
									<input
										autoFocus
										value={renameValue}
										onChange={e => onRenameValue(e.target.value)}
										onBlur={onCommitRename}
										onKeyDown={e => {
											if (e.key === 'Enter') onCommitRename()
											if (e.key === 'Escape') onCancelRename()
										}}
										onClick={e => e.stopPropagation()}
										className="min-w-0 flex-1 rounded border border-[var(--xp-fg)] bg-[var(--xp-panel)] px-1 py-0.5 outline-none"
									/>
								) : (
									<span
										className={`truncate ${entry.isDir ? 'font-semibold text-white' : 'text-[var(--xp-fg-dim)]'}`}
									>
										{entry.name}
									</span>
								)}
							</span>
							{viewMode === 'details' && (
								<>
									<span className="text-right text-xs opacity-60">
										{entry.isDir ? '' : formatSize(entry.size)}
									</span>
									<span className="text-xs opacity-60">
										{formatDate(entry.modified)}
									</span>
								</>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
