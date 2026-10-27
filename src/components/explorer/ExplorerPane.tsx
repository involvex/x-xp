import {useCallback, useEffect, useMemo, useState} from 'react'
import {api, pathBasename, pathJoin} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import {isHomePath} from '../../lib/paths'
import type {
	Bookmark,
	ClipboardState,
	FileEntry,
	KnownFolder,
	SortKey,
	SortState,
	TagDef,
	TagMap,
	ViewMode,
} from '../../types/fs'
import {AddressBar} from './AddressBar'
import {ColumnsView} from './ColumnsView'
import {ContextMenu, type ContextMenuState} from './ContextMenu'
import {DND_MIME, FileList} from './FileList'
import {HomePage} from './HomePage'
import {PropertiesModal} from './PropertiesModal'
import {StatusBar} from './StatusBar'

interface ExplorerPaneProps {
	locale: Locale
	path: string
	viewMode: ViewMode
	clipboard: ClipboardState | null
	searchQuery: string
	active: boolean
	reloadToken: number
	showHidden: boolean
	dualPane: boolean
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	recent: string[]
	tagDefs: TagDef[]
	tagMap: TagMap
	tagFilter: string | null
	onPathChange: (path: string) => void
	onClipboard: (clip: ClipboardState | null) => void
	onFocus: () => void
	onToast: (msg: string) => void
	onPreviewEntry: (entry: FileEntry | null) => void
	onAddBookmark: (path: string, label: string) => void
	onOpenNewTab: (path: string) => void
	onOpenOtherPane: (path: string) => void
	onGoUp: () => void
	onToggleTag: (paths: string[], tagId: string) => void
	onDropComplete?: () => void
}

function sortEntries(entries: FileEntry[], sort: SortState): FileEntry[] {
	const dir = sort.dir === 'asc' ? 1 : -1
	return [...entries].sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
		const cmp =
			sort.key === 'size'
				? a.size - b.size
				: sort.key === 'modified'
					? (a.modified ?? 0) - (b.modified ?? 0)
					: a.name.localeCompare(b.name, undefined, {sensitivity: 'base'})
		return cmp * dir
	})
}

function parseDragPaths(e: React.DragEvent): string[] {
	const raw = e.dataTransfer.getData(DND_MIME)
	if (!raw) return []
	try {
		const parsed = JSON.parse(raw) as unknown
		return Array.isArray(parsed)
			? parsed.filter((p): p is string => typeof p === 'string')
			: []
	} catch {
		return []
	}
}

export function ExplorerPane({
	locale,
	path,
	viewMode,
	clipboard,
	searchQuery,
	active,
	reloadToken,
	showHidden,
	dualPane,
	drives,
	known,
	bookmarks,
	recent,
	tagDefs,
	tagMap,
	tagFilter,
	onPathChange,
	onClipboard,
	onFocus,
	onToast,
	onPreviewEntry,
	onAddBookmark,
	onOpenNewTab,
	onOpenOtherPane,
	onGoUp,
	onToggleTag,
	onDropComplete,
}: ExplorerPaneProps) {
	const [entries, setEntries] = useState<FileEntry[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [anchor, setAnchor] = useState<string | null>(null)
	const [menu, setMenu] = useState<ContextMenuState | null>(null)
	const [renaming, setRenaming] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const [searchEntries, setSearchEntries] = useState<FileEntry[] | null>(null)
	const [truncated, setTruncated] = useState(false)
	const [loading, setLoading] = useState(false)
	const [sort, setSort] = useState<SortState>({key: 'name', dir: 'asc'})
	const [dropTarget, setDropTarget] = useState<string | null>(null)
	const [propsEntry, setPropsEntry] = useState<FileEntry | null>(null)
	const atHome = isHomePath(path)

	const toggleSort = (key: SortKey) => {
		setSort(prev =>
			prev.key === key
				? {key, dir: prev.dir === 'asc' ? 'desc' : 'asc'}
				: {key, dir: key === 'name' ? 'asc' : 'desc'},
		)
	}

	const load = useCallback(
		async (p: string) => {
			if (isHomePath(p)) {
				setEntries([])
				setSelected(new Set())
				setSearchEntries(null)
				setTruncated(false)
				setLoading(false)
				return
			}
			setLoading(true)
			try {
				const res = await api.readDir(p)
				setEntries(res)
				setSelected(new Set())
				setSearchEntries(null)
				setTruncated(false)
			} catch (e) {
				onToast(String(e))
			} finally {
				setLoading(false)
			}
		},
		[onToast],
	)

	useEffect(() => {
		void load(path)
	}, [path, load, reloadToken])

	useEffect(() => {
		if (atHome || !searchQuery.trim()) {
			setSearchEntries(null)
			setTruncated(false)
			return
		}
		const handle = window.setTimeout(() => {
			void api
				.searchByName(path, searchQuery.trim())
				.then(res => {
					setSearchEntries(res.entries)
					setTruncated(res.truncated)
				})
				.catch(e => onToast(String(e)))
		}, 250)
		return () => window.clearTimeout(handle)
	}, [searchQuery, path, onToast, atHome])

	const visible = useMemo(() => {
		const base = searchEntries ?? entries
		let filtered = showHidden ? base : base.filter(e => !e.hidden)
		if (tagFilter) {
			filtered = filtered.filter(e =>
				(tagMap[e.path] ?? []).includes(tagFilter),
			)
		}
		return sortEntries(filtered, sort)
	}, [searchEntries, entries, sort, showHidden, tagFilter, tagMap])

	const selectedEntries = useMemo(
		() => visible.filter(e => selected.has(e.path)),
		[visible, selected],
	)

	useEffect(() => {
		if (!active) return
		onPreviewEntry(selectedEntries[0] ?? null)
	}, [selectedEntries, active, onPreviewEntry])

	const navigate = (next: string) => {
		onPathChange(next)
	}

	const openEntry = async (entry: FileEntry) => {
		if (entry.isDir) navigate(entry.path)
		else {
			try {
				await api.openPath(entry.path)
			} catch (e) {
				onToast(String(e))
			}
		}
	}

	const onClick = (entry: FileEntry, e: React.MouseEvent) => {
		onFocus()
		if (e.ctrlKey || e.metaKey) {
			setSelected(prev => {
				const next = new Set(prev)
				if (next.has(entry.path)) next.delete(entry.path)
				else next.add(entry.path)
				return next
			})
			setAnchor(entry.path)
			return
		}
		if (e.shiftKey) {
			const startPath = anchor ?? entry.path
			const start = visible.findIndex(x => x.path === startPath)
			const end = visible.findIndex(x => x.path === entry.path)
			if (start >= 0 && end >= 0) {
				const [a, b] = start < end ? [start, end] : [end, start]
				const next = new Set<string>()
				for (let i = a; i <= b; i++) next.add(visible[i].path)
				setSelected(next)
			}
			return
		}
		setSelected(new Set([entry.path]))
		setAnchor(entry.path)
	}

	const doDelete = async () => {
		const paths = [...selected]
		if (paths.length === 0) return
		if (!window.confirm(t('confirmDelete', locale))) return
		try {
			await api.deleteEntries(paths)
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doPaste = async () => {
		if (atHome || !clipboard || clipboard.paths.length === 0) return
		try {
			if (clipboard.mode === 'copy') {
				await api.copyEntries(clipboard.paths, path)
			} else {
				await api.moveEntries(clipboard.paths, path)
				onClipboard(null)
			}
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doNewFolder = async () => {
		if (atHome) return
		const name = window.prompt('Folder name', 'New folder')
		if (!name) return
		try {
			await api.createDir(pathJoin(path, name))
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doNewFile = async () => {
		if (atHome) return
		const name = window.prompt('File name', 'New file.txt')
		if (!name) return
		try {
			await api.createFile(pathJoin(path, name))
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const startRename = () => {
		const entry = selectedEntries[0]
		if (!entry) return
		setRenaming(entry.path)
		setRenameValue(entry.name)
		setMenu(null)
	}

	const commitRename = async () => {
		if (!renaming) return
		const parent = renaming.replace(/[\\/][^\\/]+$/, '') || path
		const next = pathJoin(parent, renameValue)
		try {
			if (next !== renaming) await api.renameEntry(renaming, next)
			setRenaming(null)
			await load(path)
		} catch (e) {
			onToast(String(e))
			setRenaming(null)
		}
	}

	const transferTo = async (
		sources: string[],
		destDir: string,
		copy: boolean,
	) => {
		const filtered = sources.filter(s => {
			const destNorm = destDir.replace(/[\\/]+$/, '').toLowerCase()
			const srcNorm = s.replace(/[\\/]+$/, '').toLowerCase()
			return srcNorm !== destNorm && !destNorm.startsWith(srcNorm + '\\')
		})
		if (filtered.length === 0) return
		try {
			if (copy) await api.copyEntries(filtered, destDir)
			else await api.moveEntries(filtered, destDir)
			await load(path)
			onDropComplete?.()
		} catch (e) {
			onToast(String(e))
		}
	}

	const onDragStart = (entry: FileEntry, e: React.DragEvent) => {
		const paths = selected.has(entry.path) ? [...selected] : [entry.path]
		e.dataTransfer.setData(DND_MIME, JSON.stringify(paths))
		e.dataTransfer.effectAllowed = 'copyMove'
	}

	const onDragOverEntry = (entry: FileEntry, e: React.DragEvent) => {
		if (!entry.isDir) return
		e.preventDefault()
		e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move'
		setDropTarget(entry.path)
	}

	const onDragLeaveEntry = (entry: FileEntry) => {
		setDropTarget(prev => (prev === entry.path ? null : prev))
	}

	const onDropOnEntry = (entry: FileEntry, e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setDropTarget(null)
		if (!entry.isDir) return
		const sources = parseDragPaths(e)
		if (sources.length === 0) return
		void transferTo(sources, entry.path, e.ctrlKey || e.altKey)
	}

	const onDragOverPane = (e: React.DragEvent) => {
		if (atHome) return
		e.preventDefault()
		e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move'
		setDropTarget(path)
	}

	const onDropOnPane = (e: React.DragEvent) => {
		e.preventDefault()
		setDropTarget(null)
		if (atHome) return
		const sources = parseDragPaths(e)
		if (sources.length === 0) return
		void transferTo(sources, path, e.ctrlKey || e.altKey)
	}

	useEffect(() => {
		if (!active) return
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

			if (e.key === 'F5') {
				e.preventDefault()
				void load(path)
			}
			if (e.key === 'Delete' && !atHome) {
				e.preventDefault()
				void doDelete()
			}
			if (e.key === 'F2' && !atHome) {
				e.preventDefault()
				startRename()
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'a' && !atHome) {
				e.preventDefault()
				setSelected(new Set(visible.map(x => x.path)))
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'c' && !atHome) {
				e.preventDefault()
				onClipboard({mode: 'copy', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'x' && !atHome) {
				e.preventDefault()
				onClipboard({mode: 'cut', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'v' && !atHome) {
				e.preventDefault()
				void doPaste()
			}
			if (e.key === 'Enter' && selectedEntries[0]) {
				e.preventDefault()
				void openEntry(selectedEntries[0])
			}
			if (e.key === 'Backspace' && e.altKey) {
				e.preventDefault()
				onGoUp()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	return (
		<div
			className={`flex min-w-0 flex-1 flex-col ${active ? '' : 'opacity-80'} ${dropTarget === path ? 'ring-1 ring-inset ring-[var(--xp-fg)]' : ''}`}
			onClick={onFocus}
			onContextMenu={e => {
				if (atHome) return
				if ((e.target as HTMLElement).closest('li,button')) return
				e.preventDefault()
				setMenu({x: e.clientX, y: e.clientY, path: null, isDir: false})
			}}
			onDragOver={onDragOverPane}
			onDrop={onDropOnPane}
		>
			<AddressBar
				path={path}
				onNavigate={navigate}
			/>
			{loading && <div className="px-3 py-1 text-xs opacity-50">Loading…</div>}
			{atHome ? (
				<HomePage
					locale={locale}
					drives={drives}
					known={known}
					bookmarks={bookmarks}
					recent={recent}
					onNavigate={navigate}
				/>
			) : viewMode === 'columns' ? (
				<ColumnsView
					locale={locale}
					rootPath={path}
					showHidden={showHidden}
					selected={selected}
					tagDefs={tagDefs}
					tagMap={tagMap}
					reloadToken={reloadToken}
					onSelect={onClick}
					onOpenFile={entry => void openEntry(entry)}
					onNavigateRoot={navigate}
					onContextMenu={(entry, e) => {
						e.preventDefault()
						if (!selected.has(entry.path)) setSelected(new Set([entry.path]))
						setMenu({
							x: e.clientX,
							y: e.clientY,
							path: entry.path,
							isDir: entry.isDir,
						})
					}}
				/>
			) : (
				<FileList
					locale={locale}
					entries={visible}
					selected={selected}
					viewMode={viewMode}
					sort={sort}
					renaming={renaming}
					renameValue={renameValue}
					dropTarget={dropTarget}
					tagDefs={tagDefs}
					tagMap={tagMap}
					onSort={toggleSort}
					onRenameValue={setRenameValue}
					onCommitRename={() => void commitRename()}
					onCancelRename={() => setRenaming(null)}
					onClick={onClick}
					onDoubleClick={entry => void openEntry(entry)}
					onContextMenu={(entry, e) => {
						e.preventDefault()
						if (!selected.has(entry.path)) setSelected(new Set([entry.path]))
						setMenu({
							x: e.clientX,
							y: e.clientY,
							path: entry.path,
							isDir: entry.isDir,
						})
					}}
					onDragStart={onDragStart}
					onDragOverEntry={onDragOverEntry}
					onDragLeaveEntry={onDragLeaveEntry}
					onDropOnEntry={onDropOnEntry}
					onDragOverPane={onDragOverPane}
					onDropOnPane={onDropOnPane}
				/>
			)}
			<StatusBar
				locale={locale}
				itemCount={atHome ? 0 : visible.length}
				selectedCount={selected.size}
				path={path}
				searchActive={!!searchQuery.trim() && !atHome}
				truncated={truncated}
			/>
			<ContextMenu
				locale={locale}
				menu={menu}
				canPaste={!!clipboard && clipboard.paths.length > 0 && !atHome}
				dualPane={dualPane}
				tagDefs={tagDefs}
				activeTagIds={menu?.path ? (tagMap[menu.path] ?? []) : []}
				onClose={() => setMenu(null)}
				onOpen={() => {
					const entry =
						visible.find(x => x.path === menu?.path) ??
						entries.find(x => x.path === menu?.path)
					if (entry) void openEntry(entry)
					else if (menu?.path && menu.isDir) navigate(menu.path)
					setMenu(null)
				}}
				onOpenSystem={() => {
					if (menu?.path)
						void api.openPath(menu.path).catch(e => onToast(String(e)))
					setMenu(null)
				}}
				onOpenNewTab={() => {
					if (menu?.path && menu.isDir) onOpenNewTab(menu.path)
					setMenu(null)
				}}
				onOpenOtherPane={() => {
					if (menu?.path && menu.isDir) onOpenOtherPane(menu.path)
					setMenu(null)
				}}
				onCopy={() => {
					onClipboard({mode: 'copy', paths: [...selected]})
					setMenu(null)
				}}
				onCut={() => {
					onClipboard({mode: 'cut', paths: [...selected]})
					setMenu(null)
				}}
				onPaste={() => {
					void doPaste()
					setMenu(null)
				}}
				onRename={startRename}
				onDelete={() => {
					void doDelete()
					setMenu(null)
				}}
				onNewFolder={() => {
					void doNewFolder()
					setMenu(null)
				}}
				onNewFile={() => {
					void doNewFile()
					setMenu(null)
				}}
				onCopyPath={() => {
					if (menu?.path) {
						void navigator.clipboard.writeText(menu.path).then(
							() => onToast(t('pathCopied', locale)),
							e => onToast(String(e)),
						)
					}
					setMenu(null)
				}}
				onProperties={() => {
					const entry =
						visible.find(x => x.path === menu?.path) ??
						entries.find(x => x.path === menu?.path)
					if (entry) setPropsEntry(entry)
					setMenu(null)
				}}
				onAddBookmark={() => {
					if (menu?.path && menu.isDir) {
						onAddBookmark(menu.path, pathBasename(menu.path) || menu.path)
					}
					setMenu(null)
				}}
				onToggleTag={tagId => {
					const paths =
						selected.size > 0 ? [...selected] : menu?.path ? [menu.path] : []
					if (paths.length > 0) onToggleTag(paths, tagId)
				}}
			/>
			{propsEntry && (
				<PropertiesModal
					locale={locale}
					entry={propsEntry}
					onClose={() => setPropsEntry(null)}
				/>
			)}
		</div>
	)
}
