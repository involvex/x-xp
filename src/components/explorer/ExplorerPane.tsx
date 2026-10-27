import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {api, pathBasename, pathJoin} from '../../lib/api'
import {
	isZipPath,
	type BuiltinMenuAction,
	type ContextMenuSettings,
} from '../../lib/contextMenuConfig'
import {
	listenFsChanged,
	pathsEqual,
	unwatchDir,
	watchDir,
} from '../../lib/fsWatch'
import {t, type Locale} from '../../lib/i18n'
import {isHomePath, isRecyclePath, isVirtualPath} from '../../lib/paths'
import {sortEntries} from '../../lib/sort'
import {newTransferJobId} from '../../lib/transfer'
import {pairTransfer, type UndoAction} from '../../lib/undo'
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
import {AddressBar, type AddressBarHandle} from './AddressBar'
import {ColumnsView} from './ColumnsView'
import {ContextMenu, type ContextMenuState} from './ContextMenu'
import {DND_MIME, FileList} from './FileList'
import {HomePage} from './HomePage'
import {PropertiesModal} from './PropertiesModal'
import {RecycleBinView} from './RecycleBinView'
import {SearchResultsPanel} from './SearchResultsPanel'
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
	showFolderSizes: boolean
	autoRefreshFolders: boolean
	dualPane: boolean
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	recent: string[]
	tagDefs: TagDef[]
	tagMap: TagMap
	tagFilter: string | null
	sort: SortState
	menuSettings: ContextMenuSettings
	onSortChange: (sort: SortState) => void
	onPathChange: (path: string) => void
	onClipboard: (clip: ClipboardState | null) => void
	onFocus: () => void
	onToast: (msg: string) => void
	onPreviewEntry: (entry: FileEntry | null) => void
	onAddBookmark: (path: string, label: string) => void
	onOpenNewTab: (path: string) => void
	onOpenOtherPane: (path: string) => void
	onCustomizeMenu: () => void
	onGoUp: () => void
	onTogglePreview: () => void
	onToggleTag: (paths: string[], tagId: string) => void
	onDropComplete?: () => void
	onClearSearch?: () => void
	onPushUndo?: (action: UndoAction) => void
	/** Increment while active to focus the address bar (Ctrl+L). */
	focusAddressNonce?: number
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
	showFolderSizes,
	autoRefreshFolders,
	dualPane,
	drives,
	known,
	bookmarks,
	recent,
	tagDefs,
	tagMap,
	tagFilter,
	sort,
	menuSettings,
	onSortChange,
	onPathChange,
	onClipboard,
	onFocus,
	onToast,
	onPreviewEntry,
	onAddBookmark,
	onOpenNewTab,
	onOpenOtherPane,
	onCustomizeMenu,
	onGoUp,
	onTogglePreview,
	onToggleTag,
	onDropComplete,
	onClearSearch,
	onPushUndo,
	focusAddressNonce = 0,
}: ExplorerPaneProps) {
	const addressRef = useRef<AddressBarHandle>(null)
	const typeaheadRef = useRef({buffer: '', timer: 0 as number})
	const searchJobRef = useRef<string | null>(null)
	const pendingSelectRef = useRef<string | null>(null)
	const [entries, setEntries] = useState<FileEntry[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [anchor, setAnchor] = useState<string | null>(null)
	const [menu, setMenu] = useState<ContextMenuState | null>(null)
	const [renaming, setRenaming] = useState<string | null>(null)
	const [renameValue, setRenameValue] = useState('')
	const [searchEntries, setSearchEntries] = useState<FileEntry[] | null>(null)
	const [truncated, setTruncated] = useState(false)
	const [searching, setSearching] = useState(false)
	const [searchCancelled, setSearchCancelled] = useState(false)
	const [loading, setLoading] = useState(false)
	const [dropTarget, setDropTarget] = useState<string | null>(null)
	const [propsEntry, setPropsEntry] = useState<FileEntry | null>(null)
	const [folderSizes, setFolderSizes] = useState<Record<string, number | null>>(
		{},
	)
	const [lastWatchUpdate, setLastWatchUpdate] = useState<number | null>(null)
	const atHome = isHomePath(path)
	const atRecycle = isRecyclePath(path)
	const atVirtual = isVirtualPath(path)

	const toggleSort = (key: SortKey) => {
		onSortChange(
			sort.key === key
				? {key, dir: sort.dir === 'asc' ? 'desc' : 'asc'}
				: {key, dir: key === 'name' ? 'asc' : 'desc'},
		)
	}

	const load = useCallback(
		async (p: string) => {
			if (isVirtualPath(p)) {
				setEntries([])
				setSelected(new Set())
				setSearchEntries(null)
				setTruncated(false)
				setFolderSizes({})
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
				setFolderSizes({})
			} catch (e) {
				onToast(String(e))
			} finally {
				setLoading(false)
			}
		},
		[onToast],
	)

	const softLoad = useCallback(async (p: string) => {
		if (isVirtualPath(p)) return
		try {
			const res = await api.readDir(p)
			setEntries(res)
			setSelected(prev => {
				const alive = new Set(res.map(e => e.path))
				const next = new Set([...prev].filter(x => alive.has(x)))
				return next
			})
			setAnchor(a => (a && res.some(e => e.path === a) ? a : null))
			setFolderSizes({})
			setLastWatchUpdate(Date.now())
		} catch {
			/* transient — e.g. folder deleted mid-watch */
		}
	}, [])

	useEffect(() => {
		void load(path)
	}, [path, load, reloadToken])

	useEffect(() => {
		if (!autoRefreshFolders || atVirtual) return
		const watched = path
		let cancelled = false
		let unlisten: (() => void) | undefined
		void (async () => {
			try {
				await watchDir(watched)
				if (cancelled) {
					await unwatchDir(watched).catch(() => undefined)
					return
				}
				unlisten = await listenFsChanged(changed => {
					if (!pathsEqual(changed, watched)) return
					void softLoad(watched)
				})
			} catch {
				/* watch unavailable on this path */
			}
		})()
		return () => {
			cancelled = true
			unlisten?.()
			void unwatchDir(watched).catch(() => undefined)
		}
	}, [path, autoRefreshFolders, atVirtual, softLoad])

	useEffect(() => {
		if (!active || !focusAddressNonce) return
		addressRef.current?.focusEdit()
	}, [focusAddressNonce, active])

	const searchActive = !atVirtual && !!searchQuery.trim()

	useEffect(() => {
		if (!searchActive) {
			if (searchJobRef.current) {
				void api.cancelSearch(searchJobRef.current).catch(() => undefined)
				searchJobRef.current = null
			}
			setSearchEntries(null)
			setTruncated(false)
			setSearching(false)
			setSearchCancelled(false)
			return
		}
		const q = searchQuery.trim()
		const root = path
		const handle = window.setTimeout(() => {
			const jobId = crypto.randomUUID()
			searchJobRef.current = jobId
			setSearching(true)
			setSearchCancelled(false)
			setSearchEntries([])
			setTruncated(false)
			void api
				.searchByName(root, q, undefined, jobId)
				.then(res => {
					if (searchJobRef.current !== jobId) return
					setSearchEntries(res.entries)
					setTruncated(res.truncated)
					setSearchCancelled(!!res.cancelled)
					setSearching(false)
					if (searchJobRef.current === jobId) searchJobRef.current = null
				})
				.catch(e => {
					if (searchJobRef.current !== jobId) return
					setSearching(false)
					searchJobRef.current = null
					onToast(String(e))
				})
		}, 250)
		return () => {
			window.clearTimeout(handle)
			const jobId = searchJobRef.current
			if (jobId) {
				void api.cancelSearch(jobId).catch(() => undefined)
			}
		}
	}, [searchQuery, path, onToast, searchActive])

	useEffect(() => {
		const pending = pendingSelectRef.current
		if (!pending || loading || searchActive) return
		if (entries.some(e => e.path === pending)) {
			setSelected(new Set([pending]))
			setAnchor(pending)
			requestAnimationFrame(() => {
				const el = document.querySelector(
					`[data-path="${CSS.escape(pending)}"]`,
				)
				el?.scrollIntoView({block: 'nearest'})
			})
		}
		pendingSelectRef.current = null
	}, [entries, loading, searchActive, path])

	const visible = useMemo(() => {
		const base = searchActive ? (searchEntries ?? []) : entries
		let filtered = showHidden ? base : base.filter(e => !e.hidden)
		if (tagFilter && !searchActive) {
			filtered = filtered.filter(e =>
				(tagMap[e.path] ?? []).includes(tagFilter),
			)
		}
		return searchActive ? filtered : sortEntries(filtered, sort)
	}, [
		searchActive,
		searchEntries,
		entries,
		sort,
		showHidden,
		tagFilter,
		tagMap,
	])

	const selectedEntries = useMemo(
		() => visible.filter(e => selected.has(e.path)),
		[visible, selected],
	)

	useEffect(() => {
		if (
			!showFolderSizes ||
			atVirtual ||
			searchActive ||
			viewMode !== 'details'
		) {
			return
		}
		const dirs = visible.filter(e => e.isDir).map(e => e.path)
		if (dirs.length === 0) return
		let cancelled = false
		setFolderSizes(prev => {
			const next = {...prev}
			for (const p of dirs) {
				if (!(p in next)) next[p] = null
			}
			return next
		})
		void (async () => {
			for (const dirPath of dirs) {
				if (cancelled) return
				try {
					const size = await api.getFolderSize(dirPath)
					if (cancelled) return
					setFolderSizes(prev => ({...prev, [dirPath]: size}))
				} catch {
					if (!cancelled) {
						setFolderSizes(prev => ({...prev, [dirPath]: 0}))
					}
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [showFolderSizes, path, viewMode, visible, atVirtual, searchActive])

	useEffect(() => {
		if (!active) return
		onPreviewEntry(selectedEntries[0] ?? null)
	}, [selectedEntries, active, onPreviewEntry])

	const navigate = (next: string) => {
		onPathChange(next)
	}

	const openEntry = async (entry: FileEntry) => {
		if (entry.isDir) {
			onClearSearch?.()
			navigate(entry.path)
		} else {
			try {
				await api.openPath(entry.path)
			} catch (e) {
				onToast(String(e))
			}
		}
	}

	const openContaining = async (entry: FileEntry) => {
		try {
			const parent = await api.parentPath(entry.path)
			if (!parent) return
			pendingSelectRef.current = entry.path
			onClearSearch?.()
			navigate(parent)
		} catch (e) {
			onToast(String(e))
		}
	}

	const cancelActiveSearch = () => {
		const jobId = searchJobRef.current
		if (jobId) void api.cancelSearch(jobId).catch(() => undefined)
	}

	const scrollPathIntoView = (entryPath: string) => {
		requestAnimationFrame(() => {
			const el = document.querySelector(
				`[data-path="${CSS.escape(entryPath)}"]`,
			)
			el?.scrollIntoView({block: 'nearest'})
		})
	}

	const focusIndex = () => {
		if (visible.length === 0) return -1
		if (anchor) {
			const ai = visible.findIndex(x => x.path === anchor)
			if (ai >= 0 && selected.has(anchor)) return ai
		}
		for (let i = 0; i < visible.length; i++) {
			if (selected.has(visible[i].path)) return i
		}
		return -1
	}

	const selectByIndex = (idx: number, extend: boolean) => {
		if (visible.length === 0) return
		const i = Math.max(0, Math.min(visible.length - 1, idx))
		const entry = visible[i]
		if (extend) {
			const startPath = anchor ?? entry.path
			const start = visible.findIndex(x => x.path === startPath)
			const from = start >= 0 ? start : i
			const [a, b] = from < i ? [from, i] : [i, from]
			const next = new Set<string>()
			for (let n = a; n <= b; n++) next.add(visible[n].path)
			setSelected(next)
			if (!anchor) setAnchor(entry.path)
		} else {
			setSelected(new Set([entry.path]))
			setAnchor(entry.path)
		}
		scrollPathIntoView(entry.path)
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
			onPushUndo?.({type: 'delete', paths})
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doPaste = async () => {
		if (atVirtual || !clipboard || clipboard.paths.length === 0) return
		const jobId = newTransferJobId()
		const sources = [...clipboard.paths]
		const mode = clipboard.mode
		try {
			if (mode === 'copy') {
				const created = await api.copyEntries(sources, path, jobId)
				onPushUndo?.({
					type: 'copy',
					sources,
					destDir: path,
					created: created.map(e => e.path),
				})
			} else {
				const results = await api.moveEntries(sources, path, jobId)
				onPushUndo?.({
					type: 'move',
					pairs: pairTransfer(sources, results),
				})
				onClipboard(null)
			}
			await load(path)
		} catch (e) {
			const msg = String(e)
			if (!msg.toLowerCase().includes('cancelled')) onToast(msg)
			else await load(path)
		}
	}

	const doNewFolder = async () => {
		if (atVirtual) return
		const name = window.prompt('Folder name', 'New folder')
		if (!name) return
		try {
			await api.createDir(pathJoin(path, name))
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doExtract = async (destPrompt: boolean) => {
		const zip =
			menu?.path && isZipPath(menu.path)
				? menu.path
				: selectedEntries.find(e => isZipPath(e.path))?.path
		if (!zip) return
		let dest: string | null = null
		if (destPrompt) {
			const suggested = path.replace(/[\\/]+$/, '')
			const input = window.prompt('Extract to folder', suggested)
			if (!input) return
			dest = input
		}
		try {
			const out = await api.extractArchive(zip, dest)
			onToast(`${t('extracted', locale)}: ${out}`)
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doCompress = async () => {
		if (atVirtual) return
		const paths =
			selected.size > 0 ? [...selected] : menu?.path ? [menu.path] : []
		if (paths.length === 0) return
		const baseName =
			paths.length === 1
				? pathBasename(paths[0]).replace(/\.zip$/i, '') || 'archive'
				: 'archive'
		const suggested = pathJoin(path, `${baseName}.zip`)
		const dest = window.prompt('Zip file path', suggested)
		if (!dest) return
		try {
			const out = await api.compressEntries(paths, dest)
			onToast(`${t('compressed', locale)}: ${out}`)
			await load(path)
		} catch (e) {
			onToast(String(e))
		}
	}

	const doNewFile = async () => {
		if (atVirtual) return
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
			if (next !== renaming) {
				await api.renameEntry(renaming, next)
				onPushUndo?.({type: 'rename', from: renaming, to: next})
			}
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
		const jobId = newTransferJobId()
		try {
			if (copy) {
				const created = await api.copyEntries(filtered, destDir, jobId)
				onPushUndo?.({
					type: 'copy',
					sources: filtered,
					destDir,
					created: created.map(e => e.path),
				})
			} else {
				const results = await api.moveEntries(filtered, destDir, jobId)
				onPushUndo?.({
					type: 'move',
					pairs: pairTransfer(filtered, results),
				})
			}
			await load(path)
			onDropComplete?.()
		} catch (e) {
			const msg = String(e)
			if (!msg.toLowerCase().includes('cancelled')) onToast(msg)
			else {
				await load(path)
				onDropComplete?.()
			}
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
		if (atVirtual) return
		e.preventDefault()
		e.dataTransfer.dropEffect = e.ctrlKey || e.altKey ? 'copy' : 'move'
		setDropTarget(path)
	}

	const onDropOnPane = (e: React.DragEvent) => {
		e.preventDefault()
		setDropTarget(null)
		if (atVirtual) return
		const sources = parseDragPaths(e)
		if (sources.length === 0) return
		void transferTo(sources, path, e.ctrlKey || e.altKey)
	}

	useEffect(() => {
		if (!active) return
		const onKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
			if (atHome || atRecycle) return

			if (e.key === 'Escape' && searchActive) {
				e.preventDefault()
				onClearSearch?.()
				return
			}
			if (e.key === 'F5') {
				e.preventDefault()
				void load(path)
			}
			if (e.key === 'Delete' && !atVirtual) {
				e.preventDefault()
				void doDelete()
			}
			if (e.key === 'F2' && !atVirtual) {
				e.preventDefault()
				startRename()
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'a' && !atVirtual) {
				e.preventDefault()
				setSelected(new Set(visible.map(x => x.path)))
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'c' && !atVirtual) {
				e.preventDefault()
				onClipboard({mode: 'copy', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'x' && !atVirtual) {
				e.preventDefault()
				onClipboard({mode: 'cut', paths: [...selected]})
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'v' && !atVirtual) {
				e.preventDefault()
				void doPaste()
			}
			if (
				e.ctrlKey &&
				e.shiftKey &&
				e.key.toLowerCase() === 'c' &&
				!atVirtual
			) {
				const p =
					selectedEntries[0]?.path ??
					(selected.size === 1 ? [...selected][0] : null)
				if (p) {
					e.preventDefault()
					void navigator.clipboard.writeText(p).then(
						() => onToast(t('pathCopied', locale)),
						err => onToast(String(err)),
					)
				}
			}
			if (e.key === 'Enter' && selectedEntries[0]) {
				e.preventDefault()
				void openEntry(selectedEntries[0])
			}
			if (e.key === 'Backspace' && e.altKey) {
				e.preventDefault()
				onGoUp()
			}
			if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault()
				if (selected.size === 0 && visible[0]) {
					setSelected(new Set([visible[0].path]))
					setAnchor(visible[0].path)
				}
				onTogglePreview()
				return
			}

			const page = 10
			const cur = focusIndex()
			const extend = e.shiftKey
			if (e.key === 'ArrowDown' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(cur < 0 ? 0 : cur + 1, extend)
				return
			}
			if (e.key === 'ArrowUp' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(cur < 0 ? 0 : cur - 1, extend)
				return
			}
			if (e.key === 'Home' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(0, extend)
				return
			}
			if (e.key === 'End' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(visible.length - 1, extend)
				return
			}
			if (e.key === 'PageDown' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(cur < 0 ? 0 : cur + page, extend)
				return
			}
			if (e.key === 'PageUp' && !e.altKey && !e.ctrlKey && !e.metaKey) {
				e.preventDefault()
				selectByIndex(cur < 0 ? 0 : cur - page, extend)
				return
			}

			// Type-ahead: printable character without modifiers
			if (
				!e.ctrlKey &&
				!e.altKey &&
				!e.metaKey &&
				e.key.length === 1 &&
				!e.isComposing
			) {
				const ch = e.key
				if (ch === ' ') return
				e.preventDefault()
				const state = typeaheadRef.current
				window.clearTimeout(state.timer)
				state.buffer += ch.toLowerCase()
				state.timer = window.setTimeout(() => {
					state.buffer = ''
				}, 700)
				const q = state.buffer
				const from = Math.max(0, cur)
				const order = [
					...visible.slice(from + 1),
					...visible.slice(0, from + 1),
				]
				const match = order.find(entry =>
					entry.name.toLowerCase().startsWith(q),
				)
				if (match) {
					const idx = visible.findIndex(x => x.path === match.path)
					if (idx >= 0) selectByIndex(idx, false)
				}
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
				if (atVirtual) return
				if ((e.target as HTMLElement).closest('li,button')) return
				e.preventDefault()
				setMenu({x: e.clientX, y: e.clientY, path: null, isDir: false})
			}}
			onDragOver={onDragOverPane}
			onDrop={onDropOnPane}
		>
			<AddressBar
				ref={addressRef}
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
			) : atRecycle ? (
				<RecycleBinView
					locale={locale}
					reloadToken={reloadToken}
					onToast={onToast}
				/>
			) : searchActive ? (
				<SearchResultsPanel
					locale={locale}
					query={searchQuery.trim()}
					rootPath={path}
					entries={visible}
					selected={selected}
					searching={searching}
					truncated={truncated}
					cancelled={searchCancelled}
					onSelect={onClick}
					onOpen={entry => void openEntry(entry)}
					onOpenContaining={entry => void openContaining(entry)}
					onCancelSearch={cancelActiveSearch}
					onClearSearch={() => onClearSearch?.()}
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
			) : viewMode === 'columns' ? (
				<ColumnsView
					locale={locale}
					rootPath={path}
					showHidden={showHidden}
					selected={selected}
					tagDefs={tagDefs}
					tagMap={tagMap}
					reloadToken={reloadToken}
					sort={sort}
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
					folderSizes={folderSizes}
					showFolderSizes={showFolderSizes}
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
				itemCount={atVirtual ? 0 : visible.length}
				selectedCount={selected.size}
				path={path}
				searchActive={searchActive}
				truncated={truncated}
				lastWatchUpdate={lastWatchUpdate}
			/>
			<ContextMenu
				locale={locale}
				menu={menu}
				canPaste={!!clipboard && clipboard.paths.length > 0 && !atVirtual}
				dualPane={dualPane}
				hasSelection={selected.size > 0 || (!!menu?.path && !atVirtual)}
				isArchive={isZipPath(menu?.path ?? null)}
				tagDefs={tagDefs}
				activeTagIds={menu?.path ? (tagMap[menu.path] ?? []) : []}
				menuSettings={menuSettings}
				onClose={() => setMenu(null)}
				onOpenWith={app => {
					if (!menu?.path) return
					void api
						.openWith(menu.path, app.program, app.args)
						.catch(e => onToast(String(e)))
					setMenu(null)
				}}
				onToggleTag={tagId => {
					const paths =
						selected.size > 0 ? [...selected] : menu?.path ? [menu.path] : []
					if (paths.length > 0) onToggleTag(paths, tagId)
				}}
				onAction={(action: BuiltinMenuAction) => {
					const entry =
						visible.find(x => x.path === menu?.path) ??
						entries.find(x => x.path === menu?.path)
					switch (action) {
						case 'open':
							if (entry) void openEntry(entry)
							else if (menu?.path && menu.isDir) navigate(menu.path)
							break
						case 'openSystem':
							if (menu?.path)
								void api.openPath(menu.path).catch(e => onToast(String(e)))
							break
						case 'openNewTab':
							if (menu?.path && menu.isDir) onOpenNewTab(menu.path)
							break
						case 'openNewWindow':
							if (menu?.path)
								void api
									.openInNewWindow(menu.path)
									.catch(e => onToast(String(e)))
							break
						case 'openOtherPane':
							if (menu?.path && menu.isDir) onOpenOtherPane(menu.path)
							break
						case 'addBookmark':
							if (menu?.path && menu.isDir) {
								onAddBookmark(menu.path, pathBasename(menu.path) || menu.path)
							}
							break
						case 'copyPath':
							if (menu?.path) {
								void navigator.clipboard.writeText(menu.path).then(
									() => onToast(t('pathCopied', locale)),
									e => onToast(String(e)),
								)
							}
							break
						case 'copy':
							onClipboard({mode: 'copy', paths: [...selected]})
							break
						case 'cut':
							onClipboard({mode: 'cut', paths: [...selected]})
							break
						case 'paste':
							void doPaste()
							break
						case 'newFolder':
							void doNewFolder()
							break
						case 'newFile':
							void doNewFile()
							break
						case 'rename':
							startRename()
							setMenu(null)
							return
						case 'delete':
							void doDelete()
							break
						case 'properties':
							if (entry) setPropsEntry(entry)
							break
						case 'extractHere':
							void doExtract(false)
							break
						case 'extractTo':
							void doExtract(true)
							break
						case 'compressZip':
							void doCompress()
							break
						case 'customizeMenu':
							onCustomizeMenu()
							break
						default:
							break
					}
					setMenu(null)
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
