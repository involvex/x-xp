import {useCallback, useEffect, useMemo, useState} from 'react'
import {api, pathBasename, pathJoin} from '../../lib/api'
import type {Locale} from '../../lib/i18n'
import type {
	ClipboardState,
	FileEntry,
	SortKey,
	SortState,
	ViewMode,
} from '../../types/fs'
import {AddressBar} from './AddressBar'
import {ContextMenu, type ContextMenuState} from './ContextMenu'
import {FileList} from './FileList'
import {StatusBar} from './StatusBar'

interface ExplorerPaneProps {
	locale: Locale
	path: string
	viewMode: ViewMode
	clipboard: ClipboardState | null
	searchQuery: string
	active: boolean
	onPathChange: (path: string) => void
	onClipboard: (clip: ClipboardState | null) => void
	onFocus: () => void
	onToast: (msg: string) => void
	onPreviewEntry: (entry: FileEntry | null) => void
	onAddBookmark: (path: string, label: string) => void
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

export function ExplorerPane({
	locale,
	path,
	viewMode,
	clipboard,
	searchQuery,
	active,
	onPathChange,
	onClipboard,
	onFocus,
	onToast,
	onPreviewEntry,
	onAddBookmark,
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

	const toggleSort = (key: SortKey) => {
		setSort(prev =>
			prev.key === key
				? {key, dir: prev.dir === 'asc' ? 'desc' : 'asc'}
				: {key, dir: key === 'name' ? 'asc' : 'desc'},
		)
	}

	const load = useCallback(
		async (p: string) => {
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
	}, [path, load])

	useEffect(() => {
		if (!searchQuery.trim()) {
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
	}, [searchQuery, path, onToast])

	const visible = useMemo(
		() => sortEntries(searchEntries ?? entries, sort),
		[searchEntries, entries, sort],
	)

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
		if (!window.confirm('Move selected items to the Recycle Bin?')) return
		try {
			await api.deleteEntries(paths)
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doPaste = async () => {
		if (!clipboard || clipboard.paths.length === 0) return
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
		const name = window.prompt('Folder name', 'New folder')
		if (!name) return
		try {
			await api.createDir(pathJoin(path, name))
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

	useEffect(() => {
		if (!active) return
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

			if (e.key === 'F5') {
				e.preventDefault()
				void load(path)
			}
			if (e.key === 'Delete') {
				e.preventDefault()
				void doDelete()
			}
			if (e.key === 'F2') {
				e.preventDefault()
				startRename()
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'a') {
				e.preventDefault()
				setSelected(new Set(visible.map(x => x.path)))
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'c') {
				e.preventDefault()
				onClipboard({mode: 'copy', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'x') {
				e.preventDefault()
				onClipboard({mode: 'cut', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'v') {
				e.preventDefault()
				void doPaste()
			}
			if (e.key === 'Enter' && selectedEntries[0]) {
				e.preventDefault()
				void openEntry(selectedEntries[0])
			}
			if (e.key === 'Backspace' && e.altKey) {
				e.preventDefault()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [active, path, selected, selectedEntries, visible, clipboard])

	return (
		<div
			className={`flex min-w-0 flex-1 flex-col ${active ? '' : 'opacity-80'}`}
			onClick={onFocus}
			onContextMenu={e => {
				if ((e.target as HTMLElement).closest('li,button')) return
				e.preventDefault()
				setMenu({x: e.clientX, y: e.clientY, path: null, isDir: false})
			}}
		>
			<AddressBar
				path={path}
				onNavigate={navigate}
			/>
			{loading && <div className="px-3 py-1 text-xs opacity-50">Loading…</div>}
			<FileList
				locale={locale}
				entries={visible}
				selected={selected}
				viewMode={viewMode}
				sort={sort}
				renaming={renaming}
				renameValue={renameValue}
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
			/>
			<StatusBar
				locale={locale}
				itemCount={visible.length}
				selectedCount={selected.size}
				path={path}
				searchActive={!!searchQuery.trim()}
				truncated={truncated}
			/>
			<ContextMenu
				locale={locale}
				menu={menu}
				canPaste={!!clipboard && clipboard.paths.length > 0}
				onClose={() => setMenu(null)}
				onOpen={() => {
					const entry = visible.find(x => x.path === menu?.path)
					if (entry) void openEntry(entry)
					setMenu(null)
				}}
				onOpenSystem={() => {
					if (menu?.path)
						void api.openPath(menu.path).catch(e => onToast(String(e)))
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
				onAddBookmark={() => {
					if (menu?.path && menu.isDir) {
						onAddBookmark(menu.path, pathBasename(menu.path) || menu.path)
					}
					setMenu(null)
				}}
			/>
			{/* expose helpers via data attributes for parent — unused */}
			<span
				className="hidden"
				data-basename={pathBasename(path)}
			/>
		</div>
	)
}

export type ExplorerPaneHandle = {
	refresh: () => void
	newFolder: () => void
}
