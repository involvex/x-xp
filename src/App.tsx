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
import {api, pathBasename} from './lib/api'
import {t, type Locale} from './lib/i18n'
import {
	loadBookmarks,
	loadDualPane,
	loadLastPath,
	loadShowPreview,
	loadViewMode,
	saveBookmarks,
	saveDualPane,
	saveLastPath,
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
		title: pathBasename(path) || path,
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
		title: pathBasename(next) || next,
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
	const [tabs, setTabs] = useState<ExplorerTab[]>([])
	const [activeTabId, setActiveTabId] = useState('')
	const [activePane, setActivePane] = useState<'left' | 'right'>('left')
	const [rightPath, setRightPath] = useState('')
	const [viewMode, setViewMode] = useState<ViewMode>('details')
	const [dualPane, setDualPane] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
	const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [toast, setToast] = useState<string | null>(null)
	const [ready, setReady] = useState(false)

	const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]
	const currentPath = activeTab?.path ?? home

	const canBack = (activeTab?.historyIndex ?? 0) > 0
	const canForward =
		(activeTab?.historyIndex ?? 0) < (activeTab?.history.length ?? 1) - 1

	const navigateTab = useCallback(
		(next: string) => {
			setTabs(prev =>
				prev.map(t => (t.id === activeTabId ? updateTabPath(t, next) : t)),
			)
			void saveLastPath(next)
		},
		[activeTabId],
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
					title: pathBasename(t.history[idx]) || t.history[idx],
				}
			}),
		)
	}

	useEffect(() => {
		let unlisten: (() => void) | undefined
		let cancelled = false
		;(async () => {
			try {
				const [h, d, k, last, vm, bm, dual, preview, startup] =
					await Promise.all([
						api.getHome(),
						api.getDrives(),
						api.getKnownFolders(),
						loadLastPath(),
						loadViewMode(),
						loadBookmarks(),
						loadDualPane(),
						loadShowPreview(),
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
				const initial = startup || last || h
				const tab = newTab(initial)
				setTabs([tab])
				setActiveTabId(tab.id)
				setRightPath(initial)
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
					void saveLastPath(p)
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
				const tab = newTab(currentPath || home)
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

	const changeView = (mode: ViewMode) => {
		setViewMode(mode)
		void saveViewMode(mode)
	}

	const goUp = async () => {
		try {
			const parent = await api.parentPath(currentPath)
			if (parent && parent !== currentPath) navigateTab(parent)
		} catch (e) {
			setToast(String(e))
		}
	}

	const addBookmarkAt = async (folderPath: string, label?: string) => {
		const bm: Bookmark = {
			id: crypto.randomUUID(),
			label: label || pathBasename(folderPath) || folderPath,
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

	const newFolderOnActive = async () => {
		const name = window.prompt('Folder name', 'New folder')
		if (!name) return
		const base = activePane === 'right' && dualPane ? rightPath : currentPath
		try {
			const sep = base.includes('\\') ? '\\' : '/'
			const full = base.endsWith(sep)
				? `${base}${name}`
				: `${base}${sep}${name}`
			await api.createDir(full)
			setToast(`Created ${name}`)
			// force remount refresh by nudging path
			if (activePane === 'right' && dualPane) setRightPath(p => p)
			else navigateTab(currentPath)
		} catch (e) {
			setToast(String(e))
		}
	}

	if (!ready || !activeTab) {
		return (
			<div className="flex h-full items-center justify-center text-sm opacity-60">
				Starting x-xp…
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col bg-[var(--xp-bg)] text-[var(--xp-fg)]">
			<TabBar
				tabs={tabs}
				activeId={activeTabId}
				onSelect={setActiveTabId}
				onClose={closeTab}
				onNew={() => {
					const tab = newTab(currentPath || home)
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
				searchQuery={searchQuery}
				onBack={() => goHistory(-1)}
				onForward={() => goHistory(1)}
				onUp={() => void goUp()}
				onHome={() => navigateTab(home)}
				onRefresh={() => navigateTab(currentPath)}
				onNewFolder={() => void newFolderOnActive()}
				onToggleDual={toggleDual}
				onTogglePreview={togglePreview}
				onViewMode={changeView}
				onSearch={setSearchQuery}
				onSettings={() => setSettingsOpen(true)}
				onNewTab={() => {
					const tab = newTab(currentPath || home)
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
					onNavigate={p => {
						if (activePane === 'right' && dualPane) setRightPath(p)
						else navigateTab(p)
					}}
					onRemoveBookmark={id => void removeBookmark(id)}
				/>
				<div className="flex min-w-0 flex-1">
					<ExplorerPane
						locale={locale}
						path={currentPath}
						viewMode={viewMode}
						clipboard={clipboard}
						searchQuery={activePane === 'left' || !dualPane ? searchQuery : ''}
						active={activePane === 'left' || !dualPane}
						onPathChange={navigateTab}
						onClipboard={setClipboard}
						onFocus={() => setActivePane('left')}
						onToast={setToast}
						onPreviewEntry={setPreviewEntry}
						onAddBookmark={(p, label) => void addBookmarkAt(p, label)}
					/>
					{dualPane && (
						<>
							<div className="w-px bg-[var(--xp-border)]" />
							<ExplorerPane
								locale={locale}
								path={rightPath || home}
								viewMode={viewMode}
								clipboard={clipboard}
								searchQuery={activePane === 'right' ? searchQuery : ''}
								active={activePane === 'right'}
								onPathChange={setRightPath}
								onClipboard={setClipboard}
								onFocus={() => setActivePane('right')}
								onToast={setToast}
								onPreviewEntry={setPreviewEntry}
								onAddBookmark={(p, label) => void addBookmarkAt(p, label)}
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
					onLocale={setLocale}
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
