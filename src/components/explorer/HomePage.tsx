import {useState, type ReactNode} from 'react'
import {api, pathBasename} from '../../lib/api'
import type {
	BuiltinMenuAction,
	ContextMenuSettings,
} from '../../lib/contextMenuConfig'
import {t, type Locale} from '../../lib/i18n'
import {setNavDragData} from '../../lib/navDnD'
import type {Bookmark, FileEntry, KnownFolder} from '../../types/fs'
import {ContextMenu, type ContextMenuState} from './ContextMenu'
import {FileIcon} from './FileIcon'

const QA_DND = 'application/x-xp-quickaccess-index'

interface HomePageProps {
	locale: Locale
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	recent: string[]
	menuSettings: ContextMenuSettings
	onNavigate: (path: string) => void
	onRenameQuickAccess: (id: string, label: string) => void
	onReorderQuickAccess: (fromIndex: number, toIndex: number) => void
	onHideQuickAccess: (id: string) => void
	onOpenNewTab: (path: string) => void
	onOpenOtherPane: (path: string) => void
	onAddBookmark: (path: string, label: string) => void
	onCustomizeMenu: () => void
	onToast: (msg: string) => void
}

function Section({title, children}: {title: string; children: ReactNode}) {
	return (
		<section className="mb-6">
			<h2 className="mb-2 text-xs uppercase tracking-wide opacity-50">
				{title}
			</h2>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
				{children}
			</div>
		</section>
	)
}

function Tile({
	label,
	sub,
	isDir,
	extension = '',
	active,
	draggable,
	onClick,
	onContextMenu,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
	onDragEnd,
	actions,
}: {
	label: string
	sub?: string
	isDir: boolean
	extension?: string
	active?: boolean
	draggable?: boolean
	onClick: () => void
	onContextMenu?: (e: React.MouseEvent) => void
	onDragStart?: (e: React.DragEvent) => void
	onDragOver?: (e: React.DragEvent) => void
	onDragLeave?: () => void
	onDrop?: (e: React.DragEvent) => void
	onDragEnd?: () => void
	actions?: ReactNode
}) {
	return (
		<div
			className={`group relative flex items-center gap-3 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-3 py-2.5 text-left hover:bg-[var(--xp-hover)] ${
				active ? 'ring-1 ring-[var(--xp-fg)]' : ''
			}`}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			onContextMenu={onContextMenu}
		>
			<button
				type="button"
				onClick={onClick}
				className="flex min-w-0 flex-1 items-center gap-3 text-left"
			>
				<FileIcon
					entry={{isDir, extension}}
					size={22}
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-white">
						{label}
					</span>
					{sub && (
						<span className="block truncate text-xs opacity-50">{sub}</span>
					)}
				</span>
			</button>
			{actions ? (
				<div className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
					{actions}
				</div>
			) : null}
		</div>
	)
}

export function HomePage({
	locale,
	drives,
	known,
	bookmarks,
	recent,
	menuSettings,
	onNavigate,
	onRenameQuickAccess,
	onReorderQuickAccess,
	onHideQuickAccess,
	onOpenNewTab,
	onOpenOtherPane,
	onAddBookmark,
	onCustomizeMenu,
	onToast,
}: HomePageProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const [qaDrag, setQaDrag] = useState<number | null>(null)
	const [qaDrop, setQaDrop] = useState<number | null>(null)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')
	const [menu, setMenu] = useState<ContextMenuState | null>(null)

	const commitEdit = () => {
		if (!editingId) return
		const next = editValue.trim()
		if (next) onRenameQuickAccess(editingId, next)
		setEditingId(null)
	}

	const openQaMenu = (e: React.MouseEvent, f: KnownFolder) => {
		e.preventDefault()
		setMenu({
			x: e.clientX,
			y: e.clientY,
			path: f.path,
			isDir: true,
			sidebar: {kind: 'quick', id: f.id},
		})
	}

	const handleAction = (action: BuiltinMenuAction) => {
		const path = menu?.path
		const id = menu?.sidebar?.id
		switch (action) {
			case 'open':
				if (path) onNavigate(path)
				break
			case 'openNewTab':
				if (path) onOpenNewTab(path)
				break
			case 'openOtherPane':
				if (path) onOpenOtherPane(path)
				break
			case 'addBookmark':
				if (path) onAddBookmark(path, pathBasename(path) || path)
				break
			case 'copyPath':
				if (path) {
					void navigator.clipboard.writeText(path).then(
						() => onToast(t('pathCopied', locale)),
						err => onToast(String(err)),
					)
				}
				break
			case 'rename':
				if (id) {
					const f = known.find(k => k.id === id)
					if (f) {
						setEditingId(id)
						setEditValue(f.label)
					}
				}
				break
			case 'hideQuickAccess':
				if (id) onHideQuickAccess(id)
				break
			case 'customizeMenu':
				onCustomizeMenu()
				break
			default:
				break
		}
		setMenu(null)
	}

	const iconBtn =
		'rounded px-1.5 py-0.5 text-xs bg-[var(--xp-bg)]/80 opacity-80 hover:opacity-100'

	return (
		<div className="flex-1 overflow-auto p-4">
			<h1 className="mb-4 text-lg font-semibold text-white">{L('home')}</h1>

			<Section title={L('quickAccess')}>
				{known.map((f, index) => {
					if (editingId === f.id) {
						return (
							<div
								key={f.id}
								className="flex items-center gap-2 rounded border border-[var(--xp-fg)] bg-[var(--xp-panel)] px-3 py-2"
							>
								<input
									autoFocus
									value={editValue}
									onChange={e => setEditValue(e.target.value)}
									onBlur={commitEdit}
									onKeyDown={e => {
										if (e.key === 'Enter') commitEdit()
										if (e.key === 'Escape') setEditingId(null)
									}}
									className="min-w-0 flex-1 rounded bg-[var(--xp-bg)] px-2 py-1 text-sm outline-none"
								/>
							</div>
						)
					}
					return (
						<Tile
							key={f.id}
							label={f.label}
							sub={f.path}
							isDir
							active={qaDrop === index && qaDrag !== index}
							draggable
							onClick={() => onNavigate(f.path)}
							onContextMenu={e => openQaMenu(e, f)}
							onDragStart={e => {
								e.dataTransfer.setData(QA_DND, String(index))
								setNavDragData(e.dataTransfer, f.path)
								e.dataTransfer.effectAllowed = 'copyMove'
								setQaDrag(index)
							}}
							onDragEnd={() => {
								setQaDrag(null)
								setQaDrop(null)
							}}
							onDragOver={e => {
								if (![...e.dataTransfer.types].includes(QA_DND)) return
								e.preventDefault()
								e.stopPropagation()
								e.dataTransfer.dropEffect = 'move'
								setQaDrop(index)
							}}
							onDragLeave={() =>
								setQaDrop(prev => (prev === index ? null : prev))
							}
							onDrop={e => {
								const raw = e.dataTransfer.getData(QA_DND)
								if (!raw) return
								e.preventDefault()
								e.stopPropagation()
								const from = Number.parseInt(raw, 10)
								setQaDrag(null)
								setQaDrop(null)
								if (Number.isFinite(from) && from !== index) {
									onReorderQuickAccess(from, index)
								}
							}}
							actions={
								<>
									<button
										type="button"
										className={iconBtn}
										title={L('rename')}
										onClick={e => {
											e.stopPropagation()
											setEditingId(f.id)
											setEditValue(f.label)
										}}
									>
										✎
									</button>
									<button
										type="button"
										className={iconBtn}
										title={L('hideQuickAccess')}
										onClick={e => {
											e.stopPropagation()
											onHideQuickAccess(f.id)
										}}
									>
										×
									</button>
								</>
							}
						/>
					)
				})}
			</Section>

			<Section title={L('drives')}>
				{drives.map(d => (
					<Tile
						key={d.path}
						label={d.name}
						sub={d.path}
						isDir
						draggable
						onClick={() => onNavigate(d.path)}
						onDragStart={e => setNavDragData(e.dataTransfer, d.path)}
						onContextMenu={e => {
							e.preventDefault()
							setMenu({
								x: e.clientX,
								y: e.clientY,
								path: d.path,
								isDir: true,
								sidebar: {kind: 'drive'},
							})
						}}
					/>
				))}
			</Section>

			{bookmarks.length > 0 && (
				<Section title={L('bookmarks')}>
					{bookmarks.map(b => (
						<Tile
							key={b.id}
							label={b.label}
							sub={b.path}
							isDir
							draggable
							onClick={() => onNavigate(b.path)}
							onDragStart={e => setNavDragData(e.dataTransfer, b.path)}
							onContextMenu={e => {
								e.preventDefault()
								setMenu({
									x: e.clientX,
									y: e.clientY,
									path: b.path,
									isDir: true,
									sidebar: {kind: 'bookmark', id: b.id},
								})
							}}
						/>
					))}
				</Section>
			)}

			{recent.length > 0 && (
				<Section title={L('recent')}>
					{recent.map(p => (
						<Tile
							key={p}
							label={pathBasename(p) || p}
							sub={p}
							isDir
							draggable
							onClick={() => onNavigate(p)}
							onDragStart={e => setNavDragData(e.dataTransfer, p)}
						/>
					))}
				</Section>
			)}

			<ContextMenu
				locale={locale}
				menu={menu}
				canPaste={false}
				dualPane
				hasSelection={!!menu?.path}
				isArchive={false}
				tagDefs={[]}
				activeTagIds={[]}
				menuSettings={menuSettings}
				onClose={() => setMenu(null)}
				onOpenWith={app => {
					if (!menu?.path) return
					void api
						.openWith(menu.path, app.program, app.args)
						.catch(err => onToast(String(err)))
					setMenu(null)
				}}
				onToggleTag={() => undefined}
				onAction={handleAction}
			/>
		</div>
	)
}
