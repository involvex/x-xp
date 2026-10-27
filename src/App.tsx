import {listen} from '@tauri-apps/api/event'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {useCallback, useEffect, useMemo, useState} from 'react'
import {
	CommandPalette,
	type PaletteAction,
} from './components/explorer/CommandPalette'
import {ExplorerPane} from './components/explorer/ExplorerPane'
import {PreviewPanel} from './components/explorer/PreviewPanel'
import {SettingsModal} from './components/explorer/SettingsModal'
import {Sidebar} from './components/explorer/Sidebar'
import {TabBar} from './components/explorer/TabBar'
import {Toolbar} from './components/explorer/Toolbar'
import {Toast} from './components/Toast'
import {api} from './lib/api'
import {
	defaultContextMenuSettings,
	type ContextMenuSettings,
} from './lib/contextMenuConfig'
import {t, type Locale} from './lib/i18n'
import {
	displayPathTitle,
	HOME_PATH,
	isHomePath,
	isRecyclePath,
	isVirtualPath,
} from './lib/paths'
import {
	applyQuickAccessPrefs,
	defaultQuickAccessPrefs,
	defaultSort,
	loadBookmarks,
	loadContextMenuSettings,
	loadDualPane,
	loadLastPath,
	loadLocale,
	loadQuickAccessPrefs,
	loadRecentPaths,
	loadSession,
	loadShowFolderSizes,
	loadShowHidden,
	loadShowPreview,
	loadTagDefs,
	loadTagMap,
	loadViewMode,
	pushRecentPath,
	saveBookmarks,
	saveContextMenuSettings,
	saveDualPane,
	saveLastPath,
	saveLocale,
	saveQuickAccessPrefs,
	saveSession,
	saveShowFolderSizes,
	saveShowHidden,
	saveShowPreview,
	saveTagMap,
	saveViewMode,
} from './lib/store'
import type {
	Bookmark,
	ClipboardState,
	ExplorerTab,
	FileEntry,
	KnownFolder,
	QuickAccessPrefs,
	SortState,
	TagDef,
	TagMap,
	ViewMode,
} from './types/fs'

async function resolveOpenPath(raw: string): Promise<string> {
	if (!raw || isVirtualPath(raw)) return raw || HOME_PATH
	try {
		const entry = await api.resolvePath(raw)
		return entry.isDir
			? entry.path
			: entry.path.replace(/[\\/][^\\/]+$/, '') || entry.path
	} catch {
		return raw
	}
}

function newTab(path: string): ExplorerTab {
	return {
		id: crypto.randomUUID(),
		title: displayPathTitle(path),
		path,
		history: [path],
		historyIndex: 0,
	}
}

function updateTabPath(tab: ExplorerTab, next: string): ExplorerTab {
	const history = tab.history.slice(0, tab.historyIndex + 1)
	if (history[history.length - 1] !== next) history.push(next)
	return {
		...tab,
		path: next,
		title: displayPathTitle(next),
		history,
		historyIndex: history.length - 1,
	}
}

export default function App() {
	const [locale, setLocale] = useState<Locale>('en')
	const [home, setHome] = useState('')
	const [drives, setDrives] = useState<FileEntry[]>([])
	const [systemKnown, setSystemKnown] = useState<KnownFolder[]>([])
	const [qaPrefs, setQaPrefs] = useState<QuickAccessPrefs>(
		defaultQuickAccessPrefs,
	)
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const known = useMemo(
		() => applyQuickAccessPrefs(systemKnown, qaPrefs),
		[systemKnown, qaPrefs],
	)
	const [recent, setRecent] = useState<string[]>([])
	const [tabs, setTabs] = useState<ExplorerTab[]>([])
	const [activeTabId, setActiveTabId] = useState('')
	const [activePane, setActivePane] = useState<'left' | 'right'>('left')
	const [rightPath, setRightPath] = useState(HOME_PATH)
	const [viewMode, setViewMode] = useState<ViewMode>('details')
	const [dualPane, setDualPane] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const [showHidden, setShowHidden] = useState(false)
	const [showFolderSizes, setShowFolderSizes] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
	const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [settingsTab, setSettingsTab] = useState<'general' | 'menu'>('general')
	const [toast, setToast] = useState<string | null>(null)
	const [ready, setReady] = useState(false)
	const [reloadToken, setReloadToken] = useState(0)
	const [paletteOpen, setPaletteOpen] = useState(false)
	const [tagDefs, setTagDefs] = useState<TagDef[]>([])
	const [tagMap, setTagMap] = useState<TagMap>({})
	const [tagFilter, setTagFilter] = useState<string | null>(null)
	const [sort, setSort] = useState<SortState>(defaultSort)
	const [menuSettings, setMenuSettings] = useState<ContextMenuSettings>(
		defaultContextMenuSettings,
	)

	const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]
	const currentPath = activeTab?.path ?? HOME_PATH

	const canBack = (activeTab?.historyIndex ?? 0) > 0
	const canForward =
		(activeTab?.historyIndex ?? 0) < (activeTab?.history.length ?? 1) - 1

	const bumpReload = useCallback(() => {
		setReloadToken(n => n + 1)
	}, [])

	const recordNavigate = useCallback(async (next: string) => {
		void saveLastPath(next)
		if (!isVirtualPath(next)) {
			const nextRecent = await pushRecentPath(next)
			setRecent(nextRecent)
		}
	}, [])

	const navigateTab = useCallback(
		(next: string) => {
			void (async () => {
				const resolved = isVirtualPath(next)
					? next
					: await resolveOpenPath(next)
				setTabs(prev =>
					prev.map(t =>
						t.id === activeTabId ? updateTabPath(t, resolved) : t,
					),
				)
				void recordNavigate(resolved)
			})()
		},
		[activeTabId, recordNavigate],
	)

	const navigateActive = useCallback(
		(next: string) => {
			void (async () => {
				const resolved = isVirtualPath(next)
					? next
					: await resolveOpenPath(next)
				if (activePane === 'right' && dualPane) {
					setRightPath(resolved)
					void recordNavigate(resolved)
				} else {
					setTabs(prev =>
						prev.map(t =>
							t.id === activeTabId ? updateTabPath(t, resolved) : t,
						),
					)
					void recordNavigate(resolved)
				}
			})()
		},
		[activePane, dualPane, activeTabId, recordNavigate],
	)

	const goHistory = (delta: number) => {
		setTabs(prev =>
			prev.map(t => {
				if (t.id !== activeTabId) return t
				const idx = Math.min(
					Math.max(0, t.historyIndex + delta),
					t.history.length - 1,
				)
				return {
					...t,
					historyIndex: idx,
					path: t.history[idx],
					title: displayPathTitle(t.history[idx]),
				}
			}),
		)
	}

	useEffect(() => {
		let unlisten: (() => void) | undefined
		let cancelled = false
		;(async () => {
			try {
				const [
					h,
					d,
					k,
					last,
					vm,
					bm,
					dual,
					preview,
					hidden,
					folderSizesOn,
					loc,
					rec,
					startup,
					tags,
					tmap,
					session,
					menuCfg,
					qa,
				] = await Promise.all([
					api.getHome(),
					api.getDrives(),
					api.getKnownFolders(),
					loadLastPath(),
					loadViewMode(),
					loadBookmarks(),
					loadDualPane(),
					loadShowPreview(),
					loadShowHidden(),
					loadShowFolderSizes(),
					loadLocale(),
					loadRecentPaths(),
					api.getStartupPath(),
					loadTagDefs(),
					loadTagMap(),
					loadSession(),
					loadContextMenuSettings(),
					loadQuickAccessPrefs(),
				])
				if (cancelled) return
				setHome(h)
				setDrives(d)
				setSystemKnown(k)
				setQaPrefs(qa)
				setViewMode(vm)
				setBookmarks(bm)
				setDualPane(dual)
				setShowPreview(preview)
				setShowHidden(hidden)
				setShowFolderSizes(folderSizesOn)
				setLocale(loc)
				setRecent(rec)
				setTagDefs(tags)
				setTagMap(tmap)
				setMenuSettings(menuCfg)

				if (session) {
					const restoredTabs: ExplorerTab[] = []
					for (const tab of session.tabs) {
						if (isVirtualPath(tab.path)) {
							restoredTabs.push({
								...tab,
								title: displayPathTitle(tab.path),
							})
							continue
						}
						try {
							const resolved = await resolveOpenPath(tab.path)
							const history = await Promise.all(
								tab.history.map(async hp =>
									isVirtualPath(hp) ? hp : resolveOpenPath(hp).catch(() => hp),
								),
							)
							const historyIndex = Math.min(
								tab.historyIndex,
								Math.max(0, history.length - 1),
							)
							const path = history[historyIndex] ?? resolved
							restoredTabs.push({
								...tab,
								path,
								history,
								historyIndex,
								title: displayPathTitle(path),
							})
						} catch {
							/* drop missing tabs */
						}
					}
					if (restoredTabs.length > 0) {
						const activeId = restoredTabs.some(
							t => t.id === session.activeTabId,
						)
							? session.activeTabId
							: restoredTabs[0].id
						setTabs(restoredTabs)
						setActiveTabId(activeId)
						setRightPath(
							isVirtualPath(session.rightPath)
								? session.rightPath
								: await resolveOpenPath(session.rightPath).catch(
										() => HOME_PATH,
									),
						)
						setActivePane(session.activePane)
						setSort(session.sort)
						setTagFilter(session.tagFilter)
					} else {
						const fallback =
							(last && !isVirtualPath(last) ? last : null) || HOME_PATH
						const initial = isVirtualPath(fallback)
							? fallback
							: await resolveOpenPath(fallback)
						const tab = newTab(initial)
						setTabs([tab])
						setActiveTabId(tab.id)
						setRightPath(HOME_PATH)
					}
				} else {
					const rawInitial =
						(last && !isVirtualPath(last) ? last : null) || HOME_PATH
					const initial = isVirtualPath(rawInitial)
						? rawInitial
						: await resolveOpenPath(rawInitial)
					const tab = newTab(initial)
					setTabs([tab])
					setActiveTabId(tab.id)
					setRightPath(HOME_PATH)
				}

				if (startup) {
					const p = await resolveOpenPath(startup)
					setTabs(prev => {
						if (prev.length === 0) {
							const nt = newTab(p)
							setActiveTabId(nt.id)
							return [nt]
						}
						const existing = prev.find(
							t => t.path.toLowerCase() === p.toLowerCase(),
						)
						if (existing) {
							setActiveTabId(existing.id)
							return prev
						}
						const nt = newTab(p)
						setActiveTabId(nt.id)
						return [...prev, nt]
					})
					void recordNavigate(p)
				}

				setReady(true)

				unlisten = await listen<string>('open-path', async event => {
					const p = await resolveOpenPath(event.payload)
					setTabs(prev => {
						if (prev.length === 0) {
							const nt = newTab(p)
							setActiveTabId(nt.id)
							return [nt]
						}
						const existing = prev.find(
							t => t.path.toLowerCase() === p.toLowerCase(),
						)
						if (existing) {
							setActiveTabId(existing.id)
							return prev
						}
						const nt = newTab(p)
						setActiveTabId(nt.id)
						return [...prev, nt]
					})
					void recordNavigate(p)
				})
			} catch (e) {
				if (!cancelled) {
					setToast(String(e))
					setReady(true)
				}
			}
		})()
		return () => {
			cancelled = true
			unlisten?.()
		}
	}, [])

	useEffect(() => {
		if (!ready || tabs.length === 0 || !activeTabId) return
		const handle = window.setTimeout(() => {
			void saveSession({
				version: 1,
				tabs,
				activeTabId,
				rightPath,
				activePane,
				sort,
				tagFilter,
			})
		}, 300)
		return () => window.clearTimeout(handle)
	}, [ready, tabs, activeTabId, rightPath, activePane, sort, tagFilter])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				setPaletteOpen(true)
			}
			if (e.ctrlKey && e.key.toLowerCase() === 't') {
				e.preventDefault()
				const tab = newTab(HOME_PATH)
				setTabs(prev => [...prev, tab])
				setActiveTabId(tab.id)
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'w') {
				e.preventDefault()
				closeTab(activeTabId)
			}
			if (e.key === 'F3') {
				e.preventDefault()
				toggleDual()
			}
			if (e.key === 'F4') {
				e.preventDefault()
				togglePreview()
			}
			if (e.altKey && e.key === 'ArrowLeft') {
				e.preventDefault()
				if (canBack) goHistory(-1)
			}
			if (e.altKey && e.key === 'ArrowRight') {
				e.preventDefault()
				if (canForward) goHistory(1)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const closeTab = (id: string) => {
		setTabs(prev => {
			if (prev.length <= 1) return prev
			const next = prev.filter(t => t.id !== id)
			if (id === activeTabId) setActiveTabId(next[0]?.id ?? '')
			return next
		})
	}

	const toggleDual = () => {
		setDualPane(v => {
			const next = !v
			void saveDualPane(next)
			return next
		})
	}

	const togglePreview = () => {
		setShowPreview(v => {
			const next = !v
			void saveShowPreview(next)
			return next
		})
	}

	const toggleHidden = () => {
		setShowHidden(v => {
			const next = !v
			void saveShowHidden(next)
			return next
		})
	}

	const toggleFolderSizes = () => {
		setShowFolderSizes(v => {
			const next = !v
			void saveShowFolderSizes(next)
			return next
		})
	}

	const changeView = (mode: ViewMode) => {
		setViewMode(mode)
		void saveViewMode(mode)
	}

	const changeLocale = (l: Locale) => {
		setLocale(l)
		void saveLocale(l)
	}

	const changeMenuSettings = (s: ContextMenuSettings) => {
		setMenuSettings(s)
		void saveContextMenuSettings(s)
	}

	const goUp = async () => {
		const base = activePane === 'right' && dualPane ? rightPath : currentPath
		if (isHomePath(base)) return
		if (isRecyclePath(base)) {
			navigateActive(HOME_PATH)
			return
		}
		try {
			const parent = await api.parentPath(base)
			if (parent && parent !== base) navigateActive(parent)
			else navigateActive(HOME_PATH)
		} catch (e) {
			setToast(String(e))
		}
	}

	const addBookmarkAt = async (folderPath: string, label?: string) => {
		if (isVirtualPath(folderPath)) return
		const bm: Bookmark = {
			id: crypto.randomUUID(),
			label: label || displayPathTitle(folderPath),
			path: folderPath,
		}
		const next = [...bookmarks.filter(b => b.path !== bm.path), bm]
		setBookmarks(next)
		await saveBookmarks(next)
		setToast(t('bookmarkAdded', locale))
	}

	const hideToTray = async () => {
		try {
			await getCurrentWindow().hide()
		} catch (e) {
			setToast(String(e))
		}
	}

	const removeBookmark = async (id: string) => {
		const next = bookmarks.filter(b => b.id !== id)
		setBookmarks(next)
		await saveBookmarks(next)
	}

	const renameBookmark = async (id: string, label: string) => {
		const next = bookmarks.map(b => (b.id === id ? {...b, label} : b))
		setBookmarks(next)
		await saveBookmarks(next)
	}

	const reorderBookmarks = async (fromIndex: number, toIndex: number) => {
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= bookmarks.length ||
			toIndex >= bookmarks.length ||
			fromIndex === toIndex
		) {
			return
		}
		const next = [...bookmarks]
		const [moved] = next.splice(fromIndex, 1)
		next.splice(toIndex, 0, moved)
		setBookmarks(next)
		await saveBookmarks(next)
	}

	const updateQaPrefs = async (next: QuickAccessPrefs) => {
		setQaPrefs(next)
		await saveQuickAccessPrefs(next)
	}

	const renameQuickAccess = async (id: string, label: string) => {
		await updateQaPrefs({
			...qaPrefs,
			labels: {...qaPrefs.labels, [id]: label},
			order: known.map(k => k.id),
		})
	}

	const reorderQuickAccess = async (fromIndex: number, toIndex: number) => {
		if (
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= known.length ||
			toIndex >= known.length ||
			fromIndex === toIndex
		) {
			return
		}
		const ids = known.map(k => k.id)
		const [moved] = ids.splice(fromIndex, 1)
		ids.splice(toIndex, 0, moved)
		await updateQaPrefs({...qaPrefs, order: ids})
	}

	const hideQuickAccess = async (id: string) => {
		const hidden = qaPrefs.hidden.includes(id)
			? qaPrefs.hidden
			: [...qaPrefs.hidden, id]
		await updateQaPrefs({
			...qaPrefs,
			hidden,
			order: known.filter(k => k.id !== id).map(k => k.id),
		})
	}

	const restoreQuickAccess = async () => {
		await updateQaPrefs(defaultQuickAccessPrefs())
		setToast(t('quickAccessRestored', locale))
	}

	const activeBasePath =
		activePane === 'right' && dualPane ? rightPath : currentPath

	const newFolderOnActive = async () => {
		if (isVirtualPath(activeBasePath)) return
		const name = window.prompt('Folder name', 'New folder')
		if (!name) return
		const base = activeBasePath
		try {
			const sep = base.includes('\\') ? '\\' : '/'
			const full = base.endsWith(sep)
				? `${base}${name}`
				: `${base}${sep}${name}`
			await api.createDir(full)
			setToast(`Created ${name}`)
			bumpReload()
		} catch (e) {
			setToast(String(e))
		}
	}

	const newFileOnActive = async () => {
		if (isVirtualPath(activeBasePath)) return
		const name = window.prompt('File name', 'New file.txt')
		if (!name) return
		const base = activeBasePath
		try {
			const sep = base.includes('\\') ? '\\' : '/'
			const full = base.endsWith(sep)
				? `${base}${name}`
				: `${base}${sep}${name}`
			await api.createFile(full)
			setToast(`Created ${name}`)
			bumpReload()
		} catch (e) {
			setToast(String(e))
		}
	}

	const openInOtherPane = (folderPath: string) => {
		if (!dualPane) {
			setDualPane(true)
			void saveDualPane(true)
		}
		if (activePane === 'left') setRightPath(folderPath)
		else navigateTab(folderPath)
	}

	const toggleTagOnPaths = (paths: string[], tagId: string) => {
		setTagMap(prev => {
			const next: TagMap = {...prev}
			for (const p of paths) {
				const cur = new Set(next[p] ?? [])
				if (cur.has(tagId)) cur.delete(tagId)
				else cur.add(tagId)
				const arr = [...cur]
				if (arr.length === 0) delete next[p]
				else next[p] = arr
			}
			void saveTagMap(next)
			return next
		})
	}

	const paletteActions: PaletteAction[] = [
		{
			id: 'home',
			label: t('home', locale),
			hint: 'Alt+Home',
			run: () => navigateActive(HOME_PATH),
		},
		{
			id: 'refresh',
			label: t('refresh', locale),
			hint: 'F5',
			run: bumpReload,
		},
		{
			id: 'new-tab',
			label: '+ Tab',
			hint: 'Ctrl+T',
			run: () => {
				const tab = newTab(HOME_PATH)
				setTabs(prev => [...prev, tab])
				setActiveTabId(tab.id)
			},
		},
		{
			id: 'dual',
			label: t('dualPane', locale),
			hint: 'F3',
			run: toggleDual,
		},
		{
			id: 'preview',
			label: t('preview', locale),
			hint: 'F4',
			run: togglePreview,
		},
		{
			id: 'hidden',
			label: t('showHidden', locale),
			run: toggleHidden,
		},
		{
			id: 'folder-sizes',
			label: t('showFolderSizes', locale),
			run: toggleFolderSizes,
		},
		{
			id: 'view-details',
			label: `${t('name', locale)} → Details`,
			run: () => changeView('details'),
		},
		{
			id: 'view-list',
			label: `${t('name', locale)} → List`,
			run: () => changeView('list'),
		},
		{
			id: 'view-icons',
			label: `${t('name', locale)} → Icons`,
			run: () => changeView('icons'),
		},
		{
			id: 'view-columns',
			label: `${t('name', locale)} → ${t('columns', locale)}`,
			run: () => changeView('columns'),
		},
		{
			id: 'new-folder',
			label: t('newFolder', locale),
			run: () => void newFolderOnActive(),
		},
		{
			id: 'new-file',
			label: t('newFile', locale),
			run: () => void newFileOnActive(),
		},
		{
			id: 'settings',
			label: t('settings', locale),
			run: () => setSettingsOpen(true),
		},
		{
			id: 'tray',
			label: t('toTray', locale),
			run: () => void hideToTray(),
		},
		...known.map(f => ({
			id: `folder-${f.id}`,
			label: f.label,
			hint: f.path,
			run: () => navigateActive(f.path),
		})),
		...bookmarks.map(b => ({
			id: `bm-${b.id}`,
			label: b.label,
			hint: b.path,
			run: () => navigateActive(b.path),
		})),
	]

	if (!ready || !activeTab) {
		return (
			<div className="flex h-full items-center justify-center text-sm opacity-60">
				Starting x-xp…
			</div>
		)
	}

	const paneShared = {
		locale,
		viewMode,
		clipboard,
		showHidden,
		showFolderSizes,
		dualPane,
		drives,
		known,
		bookmarks,
		recent,
		reloadToken,
		tagDefs,
		tagMap,
		tagFilter,
		sort,
		menuSettings,
		onSortChange: setSort,
		onClipboard: setClipboard,
		onToast: setToast,
		onPreviewEntry: setPreviewEntry,
		onAddBookmark: (p: string, label: string) => void addBookmarkAt(p, label),
		onOpenNewTab: (p: string) => {
			const tab = newTab(p)
			setTabs(prev => [...prev, tab])
			setActiveTabId(tab.id)
		},
		onCustomizeMenu: () => {
			setSettingsTab('menu')
			setSettingsOpen(true)
		},
		onGoUp: () => void goUp(),
		onToggleTag: toggleTagOnPaths,
		onDropComplete: bumpReload,
	}

	return (
		<div className="flex h-full flex-col bg-[var(--xp-bg)] text-[var(--xp-fg)]">
			<TabBar
				tabs={tabs}
				activeId={activeTabId}
				onSelect={setActiveTabId}
				onClose={closeTab}
				onNew={() => {
					const tab = newTab(HOME_PATH)
					setTabs(prev => [...prev, tab])
					setActiveTabId(tab.id)
				}}
			/>
			<Toolbar
				locale={locale}
				canBack={canBack}
				canForward={canForward}
				viewMode={viewMode}
				dualPane={dualPane}
				showPreview={showPreview}
				showHidden={showHidden}
				showFolderSizes={showFolderSizes}
				searchQuery={searchQuery}
				onBack={() => goHistory(-1)}
				onForward={() => goHistory(1)}
				onUp={() => void goUp()}
				onHome={() => navigateActive(HOME_PATH)}
				onRefresh={bumpReload}
				onNewFolder={() => void newFolderOnActive()}
				onNewFile={() => void newFileOnActive()}
				onToggleDual={toggleDual}
				onTogglePreview={togglePreview}
				onToggleHidden={toggleHidden}
				onToggleFolderSizes={toggleFolderSizes}
				onViewMode={changeView}
				onSearch={setSearchQuery}
				onSettings={() => {
					setSettingsTab('general')
					setSettingsOpen(true)
				}}
				onNewTab={() => {
					const tab = newTab(HOME_PATH)
					setTabs(prev => [...prev, tab])
					setActiveTabId(tab.id)
				}}
				onBookmark={() => void addBookmarkAt(currentPath)}
				onToTray={() => void hideToTray()}
				onCommandPalette={() => setPaletteOpen(true)}
			/>
			<div className="flex min-h-0 flex-1">
				<Sidebar
					locale={locale}
					drives={drives}
					known={known}
					bookmarks={bookmarks}
					tagDefs={tagDefs}
					activeTagFilter={tagFilter}
					currentPath={currentPath}
					onNavigate={navigateActive}
					onRemoveBookmark={id => void removeBookmark(id)}
					onRenameBookmark={(id, label) => void renameBookmark(id, label)}
					onReorderBookmarks={(from, to) => void reorderBookmarks(from, to)}
					onRenameQuickAccess={(id, label) => void renameQuickAccess(id, label)}
					onReorderQuickAccess={(from, to) => void reorderQuickAccess(from, to)}
					onHideQuickAccess={id => void hideQuickAccess(id)}
					onTagFilter={setTagFilter}
				/>
				<div className="flex min-w-0 flex-1">
					<ExplorerPane
						{...paneShared}
						path={currentPath}
						searchQuery={activePane === 'left' || !dualPane ? searchQuery : ''}
						active={activePane === 'left' || !dualPane}
						onPathChange={navigateTab}
						onFocus={() => setActivePane('left')}
						onOpenOtherPane={openInOtherPane}
					/>
					{dualPane && (
						<>
							<div className="w-px bg-[var(--xp-border)]" />
							<ExplorerPane
								{...paneShared}
								path={rightPath || home || HOME_PATH}
								searchQuery={activePane === 'right' ? searchQuery : ''}
								active={activePane === 'right'}
								onPathChange={p => {
									setRightPath(p)
									void recordNavigate(p)
								}}
								onFocus={() => setActivePane('right')}
								onOpenOtherPane={p => navigateTab(p)}
							/>
						</>
					)}
					{showPreview && (
						<PreviewPanel
							locale={locale}
							entry={previewEntry}
						/>
					)}
				</div>
			</div>
			{settingsOpen && (
				<SettingsModal
					locale={locale}
					onLocale={changeLocale}
					menuSettings={menuSettings}
					onMenuSettings={changeMenuSettings}
					onRestoreQuickAccess={() => void restoreQuickAccess()}
					initialTab={settingsTab}
					onClose={() => setSettingsOpen(false)}
					onToast={setToast}
				/>
			)}
			<CommandPalette
				locale={locale}
				open={paletteOpen}
				onClose={() => setPaletteOpen(false)}
				actions={paletteActions}
			/>
			<Toast
				message={toast}
				onClose={() => setToast(null)}
			/>
		</div>
	)
}
