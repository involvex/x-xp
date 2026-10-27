import {useState} from 'react'
import {t, type Locale} from '../../lib/i18n'
import {
	HOME_PATH,
	isHomePath,
	isRecyclePath,
	RECYCLE_PATH,
} from '../../lib/paths'
import type {Bookmark, FileEntry, KnownFolder, TagDef} from '../../types/fs'

const BM_DND = 'application/x-xp-bookmark-index'
const QA_DND = 'application/x-xp-quickaccess-index'

interface SidebarProps {
	locale: Locale
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	tagDefs: TagDef[]
	activeTagFilter: string | null
	currentPath: string
	onNavigate: (path: string) => void
	onRemoveBookmark: (id: string) => void
	onRenameBookmark: (id: string, label: string) => void
	onReorderBookmarks: (fromIndex: number, toIndex: number) => void
	onRenameQuickAccess: (id: string, label: string) => void
	onReorderQuickAccess: (fromIndex: number, toIndex: number) => void
	onHideQuickAccess: (id: string) => void
	onTagFilter: (tagId: string | null) => void
}

type EditTarget =
	{kind: 'bookmark'; id: string} | {kind: 'quick'; id: string} | null

export function Sidebar({
	locale,
	drives,
	known,
	bookmarks,
	tagDefs,
	activeTagFilter,
	currentPath,
	onNavigate,
	onRemoveBookmark,
	onRenameBookmark,
	onReorderBookmarks,
	onRenameQuickAccess,
	onReorderQuickAccess,
	onHideQuickAccess,
	onTagFilter,
}: SidebarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const [editing, setEditing] = useState<EditTarget>(null)
	const [editValue, setEditValue] = useState('')
	const [bmDrag, setBmDrag] = useState<number | null>(null)
	const [bmDrop, setBmDrop] = useState<number | null>(null)
	const [qaDrag, setQaDrag] = useState<number | null>(null)
	const [qaDrop, setQaDrop] = useState<number | null>(null)

	const item = (active: boolean) =>
		`w-full text-left rounded px-2 py-1.5 text-sm truncate ${
			active ? 'bg-[var(--xp-select)]' : 'hover:bg-[var(--xp-hover)]'
		}`

	const startEdit = (kind: 'bookmark' | 'quick', id: string, label: string) => {
		setEditing({kind, id})
		setEditValue(label)
	}

	const commitEdit = () => {
		if (!editing) return
		const next = editValue.trim()
		if (next) {
			if (editing.kind === 'bookmark') onRenameBookmark(editing.id, next)
			else onRenameQuickAccess(editing.id, next)
		}
		setEditing(null)
	}

	const isEditing = (kind: 'bookmark' | 'quick', id: string) =>
		editing?.kind === kind && editing.id === id

	return (
		<aside className="flex w-52 shrink-0 flex-col gap-3 overflow-auto border-r border-[var(--xp-border)] bg-[var(--xp-panel)] p-2 text-sm">
			<section>
				<button
					type="button"
					className={item(isHomePath(currentPath))}
					onClick={() => onNavigate(HOME_PATH)}
				>
					{L('home')}
				</button>
			</section>
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('quickAccess')}
				</h2>
				{known.length === 0 && (
					<p className="px-2 text-xs opacity-40">{L('bookmarkDragHint')}</p>
				)}
				{known.map((f, index) => {
					const isDropTarget = qaDrop === index && qaDrag !== index
					return (
						<div
							key={f.id}
							draggable={!isEditing('quick', f.id)}
							className={`group flex items-center gap-0.5 rounded ${
								isDropTarget ? 'ring-1 ring-[var(--xp-fg)]' : ''
							} ${qaDrag === index ? 'opacity-40' : ''}`}
							onDragStart={e => {
								e.dataTransfer.setData(QA_DND, String(index))
								e.dataTransfer.effectAllowed = 'move'
								setQaDrag(index)
							}}
							onDragEnd={() => {
								setQaDrag(null)
								setQaDrop(null)
							}}
							onDragOver={e => {
								e.preventDefault()
								e.dataTransfer.dropEffect = 'move'
								setQaDrop(index)
							}}
							onDragLeave={() => {
								setQaDrop(prev => (prev === index ? null : prev))
							}}
							onDrop={e => {
								e.preventDefault()
								const raw = e.dataTransfer.getData(QA_DND)
								const from = Number.parseInt(raw, 10)
								setQaDrag(null)
								setQaDrop(null)
								if (Number.isFinite(from) && from !== index) {
									onReorderQuickAccess(from, index)
								}
							}}
						>
							<span
								className="cursor-grab px-0.5 text-xs opacity-30 group-hover:opacity-70 active:cursor-grabbing"
								title={L('reorderBookmark')}
								aria-hidden
							>
								⋮⋮
							</span>
							{isEditing('quick', f.id) ? (
								<input
									autoFocus
									value={editValue}
									onChange={e => setEditValue(e.target.value)}
									onBlur={commitEdit}
									onKeyDown={e => {
										if (e.key === 'Enter') commitEdit()
										if (e.key === 'Escape') setEditing(null)
									}}
									onClick={e => e.stopPropagation()}
									className="min-w-0 flex-1 rounded border border-[var(--xp-fg)] bg-[var(--xp-bg)] px-1.5 py-1 text-sm outline-none"
								/>
							) : (
								<button
									type="button"
									className={`${item(currentPath === f.path)} flex-1`}
									onClick={() => onNavigate(f.path)}
									onDoubleClick={e => {
										e.preventDefault()
										e.stopPropagation()
										startEdit('quick', f.id, f.label)
									}}
									title={`${f.path}\n${L('editBookmarkHint')}`}
								>
									{f.label}
								</button>
							)}
							<button
								type="button"
								className="hidden px-1 opacity-50 group-hover:inline hover:opacity-100"
								onClick={e => {
									e.stopPropagation()
									startEdit('quick', f.id, f.label)
								}}
								title={L('rename')}
							>
								✎
							</button>
							<button
								type="button"
								className="hidden px-1 opacity-50 group-hover:inline hover:opacity-100"
								onClick={() => onHideQuickAccess(f.id)}
								title={L('hideQuickAccess')}
							>
								×
							</button>
						</div>
					)
				})}
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
							!isHomePath(currentPath) &&
								!isRecyclePath(currentPath) &&
								currentPath.toLowerCase().startsWith(d.path.toLowerCase()),
						)}
						onClick={() => onNavigate(d.path)}
					>
						{d.name}
					</button>
				))}
				<button
					type="button"
					className={item(isRecyclePath(currentPath))}
					onClick={() => onNavigate(RECYCLE_PATH)}
				>
					{L('recycleBin')}
				</button>
			</section>
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('tags')}
				</h2>
				<button
					type="button"
					className={item(activeTagFilter === null)}
					onClick={() => onTagFilter(null)}
				>
					—
				</button>
				{tagDefs.map(tag => (
					<button
						key={tag.id}
						type="button"
						className={`${item(activeTagFilter === tag.id)} flex items-center gap-2`}
						onClick={() =>
							onTagFilter(activeTagFilter === tag.id ? null : tag.id)
						}
					>
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{background: tag.color}}
						/>
						{tag.name}
					</button>
				))}
			</section>
			<section>
				<h2 className="mb-1 px-2 text-xs uppercase tracking-wide opacity-50">
					{L('bookmarks')}
				</h2>
				{bookmarks.length === 0 && (
					<p className="px-2 text-xs opacity-40">{L('bookmarkDragHint')}</p>
				)}
				{bookmarks.map((b, index) => {
					const isDropTarget = bmDrop === index && bmDrag !== index
					return (
						<div
							key={b.id}
							draggable={!isEditing('bookmark', b.id)}
							className={`group flex items-center gap-0.5 rounded ${
								isDropTarget ? 'ring-1 ring-[var(--xp-fg)]' : ''
							} ${bmDrag === index ? 'opacity-40' : ''}`}
							onDragStart={e => {
								e.dataTransfer.setData(BM_DND, String(index))
								e.dataTransfer.effectAllowed = 'move'
								setBmDrag(index)
							}}
							onDragEnd={() => {
								setBmDrag(null)
								setBmDrop(null)
							}}
							onDragOver={e => {
								e.preventDefault()
								e.dataTransfer.dropEffect = 'move'
								setBmDrop(index)
							}}
							onDragLeave={() => {
								setBmDrop(prev => (prev === index ? null : prev))
							}}
							onDrop={e => {
								e.preventDefault()
								const raw = e.dataTransfer.getData(BM_DND)
								const from = Number.parseInt(raw, 10)
								setBmDrag(null)
								setBmDrop(null)
								if (Number.isFinite(from) && from !== index) {
									onReorderBookmarks(from, index)
								}
							}}
						>
							<span
								className="cursor-grab px-0.5 text-xs opacity-30 group-hover:opacity-70 active:cursor-grabbing"
								title={L('reorderBookmark')}
								aria-hidden
							>
								⋮⋮
							</span>
							{isEditing('bookmark', b.id) ? (
								<input
									autoFocus
									value={editValue}
									onChange={e => setEditValue(e.target.value)}
									onBlur={commitEdit}
									onKeyDown={e => {
										if (e.key === 'Enter') commitEdit()
										if (e.key === 'Escape') setEditing(null)
									}}
									onClick={e => e.stopPropagation()}
									className="min-w-0 flex-1 rounded border border-[var(--xp-fg)] bg-[var(--xp-bg)] px-1.5 py-1 text-sm outline-none"
								/>
							) : (
								<button
									type="button"
									className={`${item(currentPath === b.path)} flex-1`}
									onClick={() => onNavigate(b.path)}
									onDoubleClick={e => {
										e.preventDefault()
										e.stopPropagation()
										startEdit('bookmark', b.id, b.label)
									}}
									title={`${b.path}\n${L('editBookmarkHint')}`}
								>
									{b.label}
								</button>
							)}
							<button
								type="button"
								className="hidden px-1 opacity-50 group-hover:inline hover:opacity-100"
								onClick={e => {
									e.stopPropagation()
									startEdit('bookmark', b.id, b.label)
								}}
								title={L('rename')}
							>
								✎
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
					)
				})}
			</section>
		</aside>
	)
}
