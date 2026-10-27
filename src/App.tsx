import {listen} from '@tauri-apps/api/event'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
	CommandPalette,
	type PaletteAction,
} from './components/explorer/CommandPalette'
import {ExplorerPane} from './components/explorer/ExplorerPane'
import {PaneSplitter} from './components/explorer/PaneSplitter'
import {PreviewPanel} from './components/explorer/PreviewPanel'
import {SettingsModal} from './components/explorer/SettingsModal'
import {Sidebar} from './components/explorer/Sidebar'
import {TabBar} from './components/explorer/TabBar'
import {Toolbar} from './components/explorer/Toolbar'
import {TransferBar} from './components/explorer/TransferBar'
import {Toast} from './components/Toast'
import {api} from './lib/api'
import {
	defaultContextMenuSettings,
	type ContextMenuSettings,
} from './lib/contextMenuConfig'
import {applyGlobalHotkey} from './lib/hotkey'
import {t, type Locale} from './lib/i18n'
import {getNavDragPath, hasNavDrag} from './lib/navDnD'
import {
	displayPathTitle,
	HOME_PATH,
	isHomePath,
	isRecyclePath,
	isVirtualPath,
} from './lib/paths'
import {
	applyQuickAccessPrefs,
	applyUiAppearance,
	clampUiZoom,
	defaultDesktopPrefs,
	defaultQuickAccessPrefs,
	defaultSort,
	defaultToolPaths,
	defaultUiAppearance,
	DUAL_SPLIT_DEFAULT,
	loadAutoRefreshFolders,
	loadBookmarks,
	loadContextMenuSettings,
	loadDesktopPrefs,
	loadDualPane,
	loadDualSplit,
	loadLastPath,
	loadLocale,
	loadPreviewWidth,
	loadQuickAccessPrefs,
	loadRecentPaths,
	loadSession,
	loadShowFolderSizes,
	loadShowHidden,
	loadShowPreview,
	loadSidebarCollapsed,
	loadSidebarWidth,
	loadTagDefs,
	loadTagMap,
	loadToolPaths,
	loadUiAppearance,
	loadViewMode,
	PREVIEW_WIDTH_DEFAULT,
	pushRecentPath,
	saveAutoRefreshFolders,
	saveBookmarks,
	saveContextMenuSettings,
	saveDesktopPrefs,
	saveDualPane,
	saveDualSplit,
	saveLastPath,
	saveLocale,
	savePreviewWidth,
	saveQuickAccessPrefs,
	saveSession,
	saveShowFolderSizes,
	saveShowHidden,
	saveShowPreview,
	saveSidebarCollapsed,
	saveSidebarWidth,
	saveTagDefs,
	saveTagMap,
	saveToolPaths,
	saveUiAppearance,
	saveViewMode,
	SIDEBAR_WIDTH_DEFAULT,
	UI_ZOOM_DEFAULT,
	UI_ZOOM_STEP,
	type DesktopPrefs,
	type ToolPaths,
	type UiAppearance,
} from './lib/store'
import {
	cancelTransfer,
	listenTransferProgress,
	type TransferProgress,
} from './lib/transfer'
import {
	performRedo,
	performUndo,
	popUndo,
	pushUndo,
	undoPromptKey,
	type UndoAction,
} from './lib/undo'
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

function isTypingTarget(el: EventTarget | null): boolean {
	const tag = (el as HTMLElement | null)?.tagName
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

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
	const [dualSplit, setDualSplit] = useState(DUAL_SPLIT_DEFAULT)
	const dualPanesRef = useRef<HTMLDivElement>(null)
	const [showPreview, setShowPreview] = useState(false)
	const [previewWidth, setPreviewWidth] = useState(PREVIEW_WIDTH_DEFAULT)
	const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH_DEFAULT)
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [appearance, setAppearance] =
		useState<UiAppearance>(defaultUiAppearance)
	const [snapSide, setSnapSide] = useState<'left' | 'right' | null>(null)
	const snapSideRef = useRef<'left' | 'right' | null>(null)
	const [showHidden, setShowHidden] = useState(false)
	const [showFolderSizes, setShowFolderSizes] = useState(false)
	const [autoRefreshFolders, setAutoRefreshFolders] = useState(true)
	const [searchQuery, setSearchQuery] = useState('')
	const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
	const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [settingsTab, setSettingsTab] = useState<
		'general' | 'desktop' | 'menu'
	>('general')
	const [desktopPrefs, setDesktopPrefs] =
		useState<DesktopPrefs>(defaultDesktopPrefs)
	const [toast, setToast] = useState<{
		message: string
		actionLabel?: string
		onAction?: () => void
	} | null>(null)
	const undoRef = useRef<UndoAction[]>([])
	const redoRef = useRef<UndoAction[]>([])
	const [transfer, setTransfer] = useState<TransferProgress | null>(null)
	const showToast = useCallback((message: string) => {
		setToast({message})
	}, [])
	const [ready, setReady] = useState(false)
	const [reloadToken, setReloadToken] = useState(0)
	const [paletteOpen, setPaletteOpen] = useState(false)
	const [focusSearchNonce, setFocusSearchNonce] = useState(0)
	const [focusAddressNonce, setFocusAddressNonce] = useState(0)
	const [tagDefs, setTagDefs] = useState<TagDef[]>([])
	const [toolPaths, setToolPaths] = useState<ToolPaths>(defaultToolPaths)
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

	const runLastUndo = useCallback(async () => {
		const {stack, action} = popUndo(undoRef.current)
		if (!action) {
			showToast(t('undoEmpty', locale))
			return
		}
		undoRef.current = stack
		try {
			const key = await performUndo(action)
			redoRef.current = pushUndo(redoRef.current, action)
			showToast(t(key, locale))
			bumpReload()
		} catch (e) {
			undoRef.current = pushUndo(undoRef.current, action)
			const msg = String(e)
			showToast(
				msg.includes('undoDeleteFailed') ? t('undoDeleteFailed', locale) : msg,
			)
		}
	}, [bumpReload, locale, showToast])

	const runLastRedo = useCallback(async () => {
		const {stack, action} = popUndo(redoRef.current)
		if (!action) {
			showToast(t('redoEmpty', locale))
			return
		}
		redoRef.current = stack
		try {
			const {key, action: next} = await performRedo(action)
			undoRef.current = pushUndo(undoRef.current, next)
			showToast(t(key, locale))
			bumpReload()
		} catch (e) {
			redoRef.current = pushUndo(redoRef.current, action)
			showToast(String(e))
		}
	}, [bumpReload, locale, showToast])

	const pushUndoAction = useCallback(
		(action: UndoAction) => {
			undoRef.current = pushUndo(undoRef.current, action)
			redoRef.current = []
			setToast({
				message: t(undoPromptKey(action), locale),
				actionLabel: t('undo', locale),
				onAction: () => {
					void runLastUndo()
				},
			})
		},
		[locale, runLastUndo],
	)

	const recordNavigate = useCallback(async (next: string) => {
		void saveLastPath(next)
		if (!isVirtualPath(next)) {
			const nextRecent = await pushRecentPath(next)
			setRecent(nextRecent)
			void api.syncTrayRecents(nextRecent).catch(() => undefined)
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
					split,
					preview,
					previewW,
					sidebarW,
					sidebarCollapsedOn,
					uiAppearance,
					toolsOn,
					hidden,
					folderSizesOn,
					autoRefreshOn,
					loc,
					rec,
					startup,
					tags,
					tmap,
					session,
					menuCfg,
					qa,
					desk,
				] = await Promise.all([
					api.getHome(),
					api.getDrives(),
					api.getKnownFolders(),
					loadLastPath(),
					loadViewMode(),
					loadBookmarks(),
					loadDualPane(),
					loadDualSplit(),
					loadShowPreview(),
					loadPreviewWidth(),
					loadSidebarWidth(),
					loadSidebarCollapsed(),
					loadUiAppearance(),
					loadToolPaths(),
					loadShowHidden(),
					loadShowFolderSizes(),
					loadAutoRefreshFolders(),
					loadLocale(),
					loadRecentPaths(),
					api.getStartupPath(),
					loadTagDefs(),
					loadTagMap(),
					loadSession(),
					loadContextMenuSettings(),
					loadQuickAccessPrefs(),
					loadDesktopPrefs(),
				])
				if (cancelled) return
				setHome(h)
				setDrives(d)
				setSystemKnown(k)
				setQaPrefs(qa)
				setViewMode(vm)
				setBookmarks(bm)
				setDualPane(dual)
				setDualSplit(split)
				setShowPreview(preview)
				setPreviewWidth(previewW)
				setSidebarWidth(sidebarW)
				setSidebarCollapsed(sidebarCollapsedOn)
				setAppearance(uiAppearance)
				applyUiAppearance(uiAppearance)
				setToolPaths(toolsOn)
				setShowHidden(hidden)
				setShowFolderSizes(folderSizesOn)
				setAutoRefreshFolders(autoRefreshOn)
				setLocale(loc)
				setRecent(rec)
				setTagDefs(tags)
				setTagMap(tmap)
				setMenuSettings(menuCfg)
				setDesktopPrefs(desk)
				await api.setCloseToTray(desk.closeToTray).catch(() => undefined)
				await api.setStartMinimized(desk.startMinimized).catch(() => undefined)
				await api.syncTrayRecents(rec).catch(() => undefined)
				try {
					await applyGlobalHotkey(desk.globalHotkey)
				} catch {
					/* conflict — user can change in Settings */
				}
				if (desk.startMinimized) {
					await getCurrentWindow()
						.hide()
						.catch(() => undefined)
				}

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
					showToast(String(e))
					setReady(true)
				}
			}
		})()
		return () => {
			cancelled = true
			unlisten?.()
		}
	}, [showToast])

	useEffect(() => {
		let unlisten: (() => void) | undefined
		let hideTimer = 0
		void listenTransferProgress(progress => {
			window.clearTimeout(hideTimer)
			setTransfer(progress)
			if (
				progress.phase === 'done' ||
				progress.phase === 'cancelled' ||
				progress.phase === 'error'
			) {
				hideTimer = window.setTimeout(() => {
					setTransfer(prev => (prev?.jobId === progress.jobId ? null : prev))
				}, 1800)
			}
		}).then(fn => {
			unlisten = fn
		})
		return () => {
			window.clearTimeout(hideTimer)
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
			const typing = isTypingTarget(e.target)
			if (e.ctrlKey && e.key.toLowerCase() === 'k' && !typing) {
				e.preventDefault()
				setPaletteOpen(true)
			}
			if (e.ctrlKey && e.key.toLowerCase() === 't' && !typing) {
				e.preventDefault()
				const tab = newTab(HOME_PATH)
				setTabs(prev => [...prev, tab])
				setActiveTabId(tab.id)
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'w' && !typing) {
				e.preventDefault()
				closeTab(activeTabId)
			}
			if (e.ctrlKey && e.key === 'Tab' && !typing) {
				e.preventDefault()
				cycleTab(e.shiftKey ? -1 : 1)
			}
			if (e.ctrlKey && e.key.toLowerCase() === 'f' && !typing) {
				e.preventDefault()
				setFocusSearchNonce(n => n + 1)
			}
			if (
				((e.ctrlKey && e.key.toLowerCase() === 'l') ||
					(e.altKey && e.key.toLowerCase() === 'd')) &&
				!typing
			) {
				e.preventDefault()
				setFocusAddressNonce(n => n + 1)
			}
			if (e.altKey && e.key === 'Home' && !typing) {
				e.preventDefault()
				navigateActive(HOME_PATH)
			}
			if (e.key === 'F3' && !typing) {
				e.preventDefault()
				toggleDual()
			}
			if (e.key === 'F4' && !typing) {
				e.preventDefault()
				togglePreview()
			}
			if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b' && !typing) {
				e.preventDefault()
				toggleSidebarCollapsed()
			}
			if (e.ctrlKey && !typing && (e.key === '=' || e.key === '+')) {
				e.preventDefault()
				bumpZoom(UI_ZOOM_STEP)
			}
			if (e.ctrlKey && !typing && e.key === '-') {
				e.preventDefault()
				bumpZoom(-UI_ZOOM_STEP)
			}
			if (e.ctrlKey && !typing && e.key === '0') {
				e.preventDefault()
				resetZoom()
			}
			if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
				e.preventDefault()
				void runLastUndo()
			}
			if (
				e.ctrlKey &&
				(e.key.toLowerCase() === 'y' ||
					(e.shiftKey && e.key.toLowerCase() === 'z')) &&
				!typing
			) {
				e.preventDefault()
				void runLastRedo()
			}
			if (e.altKey && e.key === 'ArrowLeft' && !typing) {
				e.preventDefault()
				if (canBack) goHistory(-1)
			}
			if (e.altKey && e.key === 'ArrowRight' && !typing) {
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

	const cycleTab = (dir: 1 | -1) => {
		if (tabs.length < 2) return
		const idx = tabs.findIndex(t => t.id === activeTabId)
		const base = idx >= 0 ? idx : 0
		const next = (base + dir + tabs.length) % tabs.length
		setActiveTabId(tabs[next].id)
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

	const toggleSidebarCollapsed = () => {
		setSidebarCollapsed(v => {
			const next = !v
			void saveSidebarCollapsed(next)
			return next
		})
	}

	const changeAppearance = (next: UiAppearance) => {
		setAppearance(next)
		applyUiAppearance(next)
		void saveUiAppearance(next)
	}

	const bumpZoom = (delta: number) => {
		setAppearance(prev => {
			const next = {
				...prev,
				zoom: clampUiZoom(prev.zoom + delta),
			}
			applyUiAppearance(next)
			void saveUiAppearance(next)
			return next
		})
	}

	const resetZoom = () => {
		setAppearance(prev => {
			const next = {...prev, zoom: UI_ZOOM_DEFAULT}
			applyUiAppearance(next)
			void saveUiAppearance(next)
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

	const changeAutoRefreshFolders = (value: boolean) => {
		setAutoRefreshFolders(value)
		void saveAutoRefreshFolders(value)
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

	const changeDesktopPrefs = (prefs: DesktopPrefs) => {
		const prev = desktopPrefs
		setDesktopPrefs(prefs)
		void saveDesktopPrefs(prefs)
		void api.setCloseToTray(prefs.closeToTray).catch(() => undefined)
		void api.setStartMinimized(prefs.startMinimized).catch(() => undefined)
		if (prefs.globalHotkey !== prev.globalHotkey) {
			void applyGlobalHotkey(prefs.globalHotkey)
				.then(() => {
					if (prefs.globalHotkey) {
						showToast(t('hotkeyRegistered', locale))
					}
				})
				.catch(() => showToast(t('hotkeyFailed', locale)))
		}
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
			showToast(String(e))
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
		showToast(t('bookmarkAdded', locale))
	}

	const hideToTray = async () => {
		try {
			await getCurrentWindow().hide()
		} catch (e) {
			showToast(String(e))
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
		showToast(t('quickAccessRestored', locale))
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
			showToast(`Created ${name}`)
			bumpReload()
		} catch (e) {
			showToast(String(e))
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
			showToast(`Created ${name}`)
			bumpReload()
		} catch (e) {
			showToast(String(e))
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

	useEffect(() => {
		snapSideRef.current = snapSide
	}, [snapSide])

	useEffect(() => {
		const onDragOver = (e: DragEvent) => {
			if (!e.dataTransfer || !hasNavDrag(e.dataTransfer)) {
				if (snapSideRef.current) setSnapSide(null)
				return
			}
			const rect = dualPanesRef.current?.getBoundingClientRect()
			if (!rect) return
			if (
				e.clientX < rect.left ||
				e.clientX > rect.right ||
				e.clientY < rect.top ||
				e.clientY > rect.bottom
			) {
				setSnapSide(null)
				return
			}
			e.preventDefault()
			e.dataTransfer.dropEffect = 'copy'
			const mid = rect.left + rect.width / 2
			setSnapSide(e.clientX >= mid ? 'right' : 'left')
		}
		const onDrop = (e: DragEvent) => {
			if (!e.dataTransfer || !hasNavDrag(e.dataTransfer)) {
				setSnapSide(null)
				return
			}
			const path = getNavDragPath(e.dataTransfer)
			const side = snapSideRef.current
			setSnapSide(null)
			if (!path || !side) return
			e.preventDefault()
			e.stopPropagation()
			if (side === 'right') {
				setDualPane(true)
				void saveDualPane(true)
				setRightPath(path)
				setActivePane('right')
			} else {
				navigateActive(path)
			}
		}
		const onDragEnd = () => setSnapSide(null)
		window.addEventListener('dragover', onDragOver, true)
		window.addEventListener('drop', onDrop, true)
		window.addEventListener('dragend', onDragEnd, true)
		return () => {
			window.removeEventListener('dragover', onDragOver, true)
			window.removeEventListener('drop', onDrop, true)
			window.removeEventListener('dragend', onDragEnd, true)
		}
	})

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

	const changeTagDefs = (next: TagDef[]) => {
		const ids = new Set(next.map(t => t.id))
		setTagDefs(next)
		void saveTagDefs(next)
		setTagMap(prev => {
			let changed = false
			const map: TagMap = {}
			for (const [path, tags] of Object.entries(prev)) {
				const kept = tags.filter(id => ids.has(id))
				if (kept.length !== tags.length) changed = true
				if (kept.length > 0) map[path] = kept
				else if (tags.length > 0) changed = true
			}
			if (changed) void saveTagMap(map)
			return changed ? map : prev
		})
		if (tagFilter && !ids.has(tagFilter)) setTagFilter(null)
	}

	const updateTagDef = (tag: TagDef) => {
		changeTagDefs(tagDefs.map(t => (t.id === tag.id ? tag : t)))
	}

	const changeToolPaths = (next: ToolPaths) => {
		setToolPaths(next)
		void saveToolPaths(next)
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
			hint: 'F4 / Space',
			run: togglePreview,
		},
		{
			id: 'sidebar',
			label: sidebarCollapsed
				? t('expandSidebar', locale)
				: t('collapseSidebar', locale),
			hint: 'Ctrl+B',
			run: toggleSidebarCollapsed,
		},
		{
			id: 'next-tab',
			label: '+ Tab →',
			hint: 'Ctrl+Tab',
			run: () => cycleTab(1),
		},
		{
			id: 'prev-tab',
			label: '← Tab',
			hint: 'Ctrl+Shift+Tab',
			run: () => cycleTab(-1),
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
		autoRefreshFolders,
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
		onToast: showToast,
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
		onTogglePreview: togglePreview,
		onToggleTag: toggleTagOnPaths,
		onUpdateTag: updateTagDef,
		toolPaths,
		onDropComplete: bumpReload,
		onClearSearch: () => setSearchQuery(''),
		onPushUndo: pushUndoAction,
		onRenameQuickAccess: (id: string, label: string) =>
			void renameQuickAccess(id, label),
		onReorderQuickAccess: (from: number, to: number) =>
			void reorderQuickAccess(from, to),
		onHideQuickAccess: (id: string) => void hideQuickAccess(id),
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
				sidebarCollapsed={sidebarCollapsed}
				showHidden={showHidden}
				showFolderSizes={showFolderSizes}
				searchQuery={searchQuery}
				focusSearchNonce={focusSearchNonce}
				onBack={() => goHistory(-1)}
				onForward={() => goHistory(1)}
				onUp={() => void goUp()}
				onHome={() => navigateActive(HOME_PATH)}
				onRefresh={bumpReload}
				onNewFolder={() => void newFolderOnActive()}
				onNewFile={() => void newFileOnActive()}
				onToggleDual={toggleDual}
				onTogglePreview={togglePreview}
				onToggleSidebar={toggleSidebarCollapsed}
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
					menuSettings={menuSettings}
					toolPaths={toolPaths}
					onNavigate={navigateActive}
					onRemoveBookmark={id => void removeBookmark(id)}
					onRenameBookmark={(id, label) => void renameBookmark(id, label)}
					onReorderBookmarks={(from, to) => void reorderBookmarks(from, to)}
					onRenameQuickAccess={(id, label) => void renameQuickAccess(id, label)}
					onReorderQuickAccess={(from, to) => void reorderQuickAccess(from, to)}
					onHideQuickAccess={id => void hideQuickAccess(id)}
					onAddBookmark={(p, label) => void addBookmarkAt(p, label)}
					onOpenNewTab={p => {
						const tab = newTab(p)
						setTabs(prev => [...prev, tab])
						setActiveTabId(tab.id)
					}}
					onOpenOtherPane={openInOtherPane}
					onCustomizeMenu={() => {
						setSettingsTab('menu')
						setSettingsOpen(true)
					}}
					onTagFilter={setTagFilter}
					onToast={showToast}
					width={sidebarWidth}
					collapsed={sidebarCollapsed}
					onWidthChange={setSidebarWidth}
					onWidthCommit={w => {
						setSidebarWidth(w)
						void saveSidebarWidth(w)
					}}
					onToggleCollapsed={toggleSidebarCollapsed}
				/>
				<div className="flex min-w-0 flex-1">
					<div
						ref={dualPanesRef}
						className="relative flex min-h-0 min-w-0 flex-1"
					>
						{snapSide ? (
							<div className="pointer-events-none absolute inset-0 z-20 flex">
								<div
									className={`flex w-1/2 items-center justify-center border-r border-[var(--xp-fg)]/40 text-sm font-semibold ${
										snapSide === 'left'
											? 'bg-[var(--xp-fg)]/20'
											: 'bg-[var(--xp-fg)]/5'
									}`}
								>
									{t('snapOpenHere', locale)}
								</div>
								<div
									className={`flex w-1/2 items-center justify-center text-sm font-semibold ${
										snapSide === 'right'
											? 'bg-[var(--xp-fg)]/20'
											: 'bg-[var(--xp-fg)]/5'
									}`}
								>
									{t('snapOpenSplit', locale)}
								</div>
							</div>
						) : null}
						<div
							className={`flex min-h-0 min-w-0 flex-col ${dualPane ? '' : 'min-w-0 flex-1'}`}
							style={
								dualPane
									? {
											width: `${dualSplit * 100}%`,
											flex: '0 0 auto',
										}
									: undefined
							}
						>
							<ExplorerPane
								{...paneShared}
								path={currentPath}
								searchQuery={
									activePane === 'left' || !dualPane ? searchQuery : ''
								}
								active={activePane === 'left' || !dualPane}
								focusAddressNonce={
									activePane === 'left' || !dualPane ? focusAddressNonce : 0
								}
								onPathChange={navigateTab}
								onFocus={() => setActivePane('left')}
								onOpenOtherPane={openInOtherPane}
							/>
						</div>
						{dualPane && (
							<>
								<PaneSplitter
									label={t('resizePanes', locale)}
									containerRef={dualPanesRef}
									ratio={dualSplit}
									onRatioChange={setDualSplit}
									onRatioCommit={r => {
										setDualSplit(r)
										void saveDualSplit(r)
									}}
								/>
								<div className="flex min-h-0 min-w-0 flex-1 flex-col">
									<ExplorerPane
										{...paneShared}
										path={rightPath || home || HOME_PATH}
										searchQuery={activePane === 'right' ? searchQuery : ''}
										active={activePane === 'right'}
										focusAddressNonce={
											activePane === 'right' ? focusAddressNonce : 0
										}
										onPathChange={p => {
											setRightPath(p)
											void recordNavigate(p)
										}}
										onFocus={() => setActivePane('right')}
										onOpenOtherPane={p => navigateTab(p)}
									/>
								</div>
							</>
						)}
					</div>
					{showPreview && (
						<PreviewPanel
							locale={locale}
							entry={previewEntry}
							width={previewWidth}
							onWidthChange={setPreviewWidth}
							onWidthCommit={w => {
								setPreviewWidth(w)
								void savePreviewWidth(w)
							}}
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
					desktopPrefs={desktopPrefs}
					onDesktopPrefs={changeDesktopPrefs}
					autoRefreshFolders={autoRefreshFolders}
					onAutoRefreshFolders={changeAutoRefreshFolders}
					appearance={appearance}
					onAppearance={changeAppearance}
					tagDefs={tagDefs}
					onTagDefs={changeTagDefs}
					toolPaths={toolPaths}
					onToolPaths={changeToolPaths}
					onRestoreQuickAccess={() => void restoreQuickAccess()}
					initialTab={settingsTab}
					onClose={() => setSettingsOpen(false)}
					onToast={showToast}
				/>
			)}
			<CommandPalette
				locale={locale}
				open={paletteOpen}
				onClose={() => setPaletteOpen(false)}
				actions={paletteActions}
			/>
			{transfer && (
				<TransferBar
					locale={locale}
					progress={transfer}
					onCancel={() => {
						void cancelTransfer(transfer.jobId).catch(() => undefined)
					}}
					onDismiss={() => setTransfer(null)}
				/>
			)}
			<Toast
				message={toast?.message ?? null}
				actionLabel={toast?.actionLabel}
				onAction={toast?.onAction}
				onClose={() => setToast(null)}
			/>
		</div>
	)
}
