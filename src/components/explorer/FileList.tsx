import {formatDate, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {
	FileEntry,
	SortKey,
	SortState,
	TagDef,
	TagMap,
	ViewMode,
} from '../../types/fs'
import {FileIcon} from './FileIcon'

export const DND_MIME = 'application/x-xp-paths'

interface FileListProps {
	locale: Locale
	entries: FileEntry[]
	selected: Set<string>
	viewMode: ViewMode
	sort: SortState
	renaming: string | null
	renameValue: string
	dropTarget: string | null
	tagDefs: TagDef[]
	tagMap: TagMap
	/** path → folder byte size when showFolderSizes is on */
	folderSizes?: Record<string, number | null>
	showFolderSizes?: boolean
	onSort: (key: SortKey) => void
	onRenameValue: (v: string) => void
	onCommitRename: () => void
	onCancelRename: () => void
	onClick: (entry: FileEntry, e: React.MouseEvent) => void
	onDoubleClick: (entry: FileEntry) => void
	onContextMenu: (entry: FileEntry, e: React.MouseEvent) => void
	onDragStart: (entry: FileEntry, e: React.DragEvent) => void
	onDragOverEntry: (entry: FileEntry, e: React.DragEvent) => void
	onDragLeaveEntry: (entry: FileEntry) => void
	onDropOnEntry: (entry: FileEntry, e: React.DragEvent) => void
	onDragOverPane: (e: React.DragEvent) => void
	onDropOnPane: (e: React.DragEvent) => void
}

function TagDots({
	path,
	tagDefs,
	tagMap,
}: {
	path: string
	tagDefs: TagDef[]
	tagMap: TagMap
}) {
	const ids = tagMap[path] ?? []
	const tags = tagDefs.filter(d => ids.includes(d.id))
	if (tags.length === 0) return null
	return (
		<span className="flex shrink-0 gap-0.5">
			{tags.slice(0, 4).map(tag => (
				<span
					key={tag.id}
					className="h-2 w-2 rounded-full"
					style={{background: tag.color}}
					title={tag.name}
				/>
			))}
		</span>
	)
}

function sortMark(sort: SortState, key: SortKey): string {
	if (sort.key !== key) return ''
	return sort.dir === 'asc' ? ' ▲' : ' ▼'
}

function dropClass(path: string, dropTarget: string | null, isDir: boolean) {
	if (!isDir || dropTarget !== path) return ''
	return 'ring-1 ring-[var(--xp-fg)] bg-[var(--xp-select)]'
}

export function FileList({
	locale,
	entries,
	selected,
	viewMode,
	sort,
	renaming,
	renameValue,
	dropTarget,
	tagDefs,
	tagMap,
	folderSizes = {},
	showFolderSizes = false,
	onSort,
	onRenameValue,
	onCommitRename,
	onCancelRename,
	onClick,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDragOverEntry,
	onDragLeaveEntry,
	onDropOnEntry,
	onDragOverPane,
	onDropOnPane,
}: FileListProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	const sizeLabel = (entry: FileEntry): string => {
		if (!entry.isDir) return formatSize(entry.size)
		if (!showFolderSizes) return ''
		const v = folderSizes[entry.path]
		if (v === undefined) return '…'
		if (v === null) return '…'
		return formatSize(v)
	}

	if (entries.length === 0) {
		return (
			<div
				className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center"
				onDragOver={onDragOverPane}
				onDrop={onDropOnPane}
			>
				<p className="text-sm opacity-50">{L('empty')}</p>
				<p className="max-w-xs text-xs opacity-35">{L('emptyHint')}</p>
			</div>
		)
	}

	if (viewMode === 'icons') {
		return (
			<div
				className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 overflow-auto p-3 content-start"
				onDragOver={onDragOverPane}
				onDrop={onDropOnPane}
			>
				{entries.map(entry => (
					<button
						key={entry.path}
						type="button"
						draggable
						data-path={entry.path}
						className={`flex flex-col items-center gap-1 rounded p-2 text-center text-xs ${
							selected.has(entry.path)
								? 'bg-[var(--xp-select)]'
								: 'hover:bg-[var(--xp-hover)]'
						} ${dropClass(entry.path, dropTarget, entry.isDir)}`}
						onClick={e => onClick(entry, e)}
						onDoubleClick={() => onDoubleClick(entry)}
						onContextMenu={e => onContextMenu(entry, e)}
						onDragStart={e => onDragStart(entry, e)}
						onDragOver={e => onDragOverEntry(entry, e)}
						onDragLeave={() => onDragLeaveEntry(entry)}
						onDrop={e => onDropOnEntry(entry, e)}
					>
						<FileIcon
							entry={entry}
							size={32}
						/>
						<span className="w-full truncate">{entry.name}</span>
						<TagDots
							path={entry.path}
							tagDefs={tagDefs}
							tagMap={tagMap}
						/>
					</button>
				))}
			</div>
		)
	}

	const headerBtn =
		'cursor-pointer select-none rounded px-1 hover:bg-[var(--xp-hover)] hover:opacity-100'

	return (
		<div
			className="flex flex-1 flex-col overflow-auto"
			onDragOver={onDragOverPane}
			onDrop={onDropOnPane}
		>
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
							draggable
							data-path={entry.path}
							className={`grid cursor-default grid-cols-[minmax(0,1fr)_100px_160px] items-center gap-2 px-3 py-1.5 text-sm ${
								isSelected
									? 'bg-[var(--xp-select)]'
									: 'hover:bg-[var(--xp-hover)]'
							} ${viewMode === 'list' ? 'grid-cols-1' : ''} ${dropClass(entry.path, dropTarget, entry.isDir)}`}
							onClick={e => onClick(entry, e)}
							onDoubleClick={() => onDoubleClick(entry)}
							onContextMenu={e => onContextMenu(entry, e)}
							onDragStart={e => onDragStart(entry, e)}
							onDragOver={e => onDragOverEntry(entry, e)}
							onDragLeave={() => onDragLeaveEntry(entry)}
							onDrop={e => onDropOnEntry(entry, e)}
						>
							<span className="flex min-w-0 items-center gap-2">
								<FileIcon entry={entry} />
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
										className={`truncate ${entry.isDir ? 'font-semibold text-white' : 'text-[var(--xp-fg-dim)]'} ${entry.hidden ? 'opacity-50' : ''}`}
									>
										{entry.name}
									</span>
								)}
								<TagDots
									path={entry.path}
									tagDefs={tagDefs}
									tagMap={tagMap}
								/>
							</span>
							{viewMode === 'details' && (
								<>
									<span className="text-right text-xs opacity-60">
										{sizeLabel(entry)}
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
