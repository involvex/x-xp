import {listen} from '@tauri-apps/api/event'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {useCallback, useEffect, useState} from 'react'
import {ExplorerPane} from './components/explorer/ExplorerPane'
import {PreviewPanel} from './components/explorer/PreviewPanel'
import {SettingsModal} from './components/explorer/SettingsModal'
import {Sidebar} from './components/explorer/Sidebar'
import {TabBar} from './components/explorer/TabBar'
import {Toolbar} from './components/explorer/Toolbar'
import {Toast} from './components/Toast'
import {api} from './lib/api'
import {t, type Locale} from './lib/i18n'
import {displayPathTitle, HOME_PATH, isHomePath} from './lib/paths'
import {
	loadBookmarks,
	loadDualPane,
	loadLastPath,
	loadLocale,
	loadRecentPaths,
	loadShowHidden,
	loadShowPreview,
	loadViewMode,
	pushRecentPath,
	saveBookmarks,
	saveDualPane,
	saveLastPath,
	saveLocale,
	saveShowHidden,
	saveShowPreview,
	saveViewMode,
} from './lib/store'
import type {
	Bookmark,
	ClipboardState,
	ExplorerTab,
	FileEntry,
	KnownFolder,
	ViewMode,
} from './types/fs'

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
	const [known, setKnown] = useState<KnownFolder[]>([])
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const [recent, setRecent] = useState<string[]>([])
	const [tabs, setTabs] = useState<ExplorerTab[]>([])
	const [activeTabId, setActiveTabId] = useState('')
	const [activePane, setActivePane] = useState<'left' | 'right'>('left')
	const [rightPath, setRightPath] = useState(HOME_PATH)
	const [viewMode, setViewMode] = useState<ViewMode>('details')
	const [dualPane, setDualPane] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const [showHidden, setShowHidden] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
	const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [toast, setToast] = useState<string | null>(null)
	const [ready, setReady] = useState(false)
	const [reloadToken, setReloadToken] = useState(0)

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
		if (!isHomePath(next)) {
			const nextRecent = await pushRecentPath(next)
			setRecent(nextRecent)
		}
	}, [])

	const navigateTab = useCallback(
		(next: string) => {
			setTabs(prev =>
				prev.map(t => (t.id === activeTabId ? updateTabPath(t, next) : t)),
			)
			void recordNavigate(next)
		},
		[activeTabId, recordNavigate],
	)

	const navigateActive = useCallback(
		(next: string) => {
			if (activePane === 'right' && dualPane) {
				setRightPath(next)
				void recordNavigate(next)
			} else {
				navigateTab(next)
			}
		},
		[activePane, dualPane, navigateTab, recordNavigate],
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
					loc,
					rec,
					startup,
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
					loadLocale(),
					loadRecentPaths(),
					api.getStartupPath(),
				])
				if (cancelled) return
				setHome(h)
				setDrives(d)
				setKnown(k)
				setViewMode(vm)
				setBookmarks(bm)
				setDualPane(dual)
				setShowPreview(preview)
				setShowHidden(hidden)
				setLocale(loc)
				setRecent(rec)
				const initial =
					startup || (last && !isHomePath(last) ? last : null) || HOME_PATH
				const tab = newTab(initial)
				setTabs([tab])
				setActiveTabId(tab.id)
				setRightPath(HOME_PATH)
				setReady(true)

				unlisten = await listen<string>('open-path', event => {
					const p = event.payload
					setTabs(prev => {
						if (prev.length === 0) {
							const t = newTab(p)
							setActiveTabId(t.id)
							return [t]
						}
						return prev.map(t =>
							t.id === (activeTabId || prev[0].id) ? updateTabPath(t, p) : t,
						)
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
		const onKey = (e: KeyboardEvent) => {
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

	const changeView = (mode: ViewMode) => {
		setViewMode(mode)
		void saveViewMode(mode)
	}

	const changeLocale = (l: Locale) => {
		setLocale(l)
		void saveLocale(l)
	}

	const goUp = async () => {
		const base = activePane === 'right' && dualPane ? rightPath : currentPath
		if (isHomePath(base)) return
		try {
			const parent = await api.parentPath(base)
			if (parent && parent !== base) navigateActive(parent)
			else navigateActive(HOME_PATH)
		} catch (e) {
			setToast(String(e))
		}
	}

	const addBookmarkAt = async (folderPath: string, label?: string) => {
		if (isHomePath(folderPath)) return
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

	const activeBasePath =
		activePane === 'right' && dualPane ? rightPath : currentPath

	const newFolderOnActive = async () => {
		if (isHomePath(activeBasePath)) return
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
		if (isHomePath(activeBasePath)) return
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
		dualPane,
		drives,
		known,
		bookmarks,
		recent,
		reloadToken,
		onClipboard: setClipboard,
		onToast: setToast,
		onPreviewEntry: setPreviewEntry,
		onAddBookmark: (p: string, label: string) => void addBookmarkAt(p, label),
		onOpenNewTab: (p: string) => {
			const tab = newTab(p)
			setTabs(prev => [...prev, tab])
			setActiveTabId(tab.id)
		},
		onGoUp: () => void goUp(),
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
				onViewMode={changeView}
				onSearch={setSearchQuery}
				onSettings={() => setSettingsOpen(true)}
				onNewTab={() => {
					const tab = newTab(HOME_PATH)
					setTabs(prev => [...prev, tab])
					setActiveTabId(tab.id)
				}}
				onBookmark={() => void addBookmarkAt(currentPath)}
				onToTray={() => void hideToTray()}
			/>
			<div className="flex min-h-0 flex-1">
				<Sidebar
					locale={locale}
					drives={drives}
					known={known}
					bookmarks={bookmarks}
					currentPath={currentPath}
					onNavigate={navigateActive}
					onRemoveBookmark={id => void removeBookmark(id)}
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
					onClose={() => setSettingsOpen(false)}
					onToast={setToast}
				/>
			)}
			<Toast
				message={toast}
				onClose={() => setToast(null)}
			/>
		</div>
	)
}
