import {useEffect, useRef} from 'react'
import {t, type Locale} from '../../lib/i18n'
import type {ViewMode} from '../../types/fs'

interface ToolbarProps {
	locale: Locale
	canBack: boolean
	canForward: boolean
	viewMode: ViewMode
	dualPane: boolean
	showPreview: boolean
	sidebarCollapsed: boolean
	showHidden: boolean
	showFolderSizes: boolean
	searchQuery: string
	/** Increment to focus the search field (Ctrl+F). */
	focusSearchNonce?: number
	onBack: () => void
	onForward: () => void
	onUp: () => void
	onHome: () => void
	onRefresh: () => void
	onNewFolder: () => void
	onNewFile: () => void
	onToggleDual: () => void
	onTogglePreview: () => void
	onToggleSidebar: () => void
	onToggleHidden: () => void
	onToggleFolderSizes: () => void
	onViewMode: (mode: ViewMode) => void
	onSearch: (q: string) => void
	onSettings: () => void
	onNewTab: () => void
	onBookmark: () => void
	onToTray: () => void
	onCommandPalette: () => void
}

export function Toolbar(props: ToolbarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, props.locale)
	const searchRef = useRef<HTMLInputElement>(null)
	const btn =
		'rounded px-2.5 py-1.5 text-sm bg-[var(--xp-hover)] hover:bg-[var(--xp-select)] disabled:opacity-30 disabled:cursor-not-allowed'

	useEffect(() => {
		if (!props.focusSearchNonce) return
		searchRef.current?.focus()
		searchRef.current?.select()
	}, [props.focusSearchNonce])

	return (
		<div className="flex flex-wrap items-center gap-2 border-b border-[var(--xp-border)] px-3 py-2">
			<button
				type="button"
				className={btn}
				disabled={!props.canBack}
				onClick={props.onBack}
			>
				{L('back')}
			</button>
			<button
				type="button"
				className={btn}
				disabled={!props.canForward}
				onClick={props.onForward}
			>
				{L('forward')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onUp}
			>
				{L('up')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onHome}
			>
				{L('home')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onRefresh}
			>
				{L('refresh')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onNewFolder}
			>
				{L('newFolder')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onNewFile}
			>
				{L('newFile')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onNewTab}
			>
				+ Tab
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onBookmark}
			>
				★
			</button>
			<button
				type="button"
				className={`${btn} ${props.dualPane ? 'ring-1 ring-[var(--xp-fg)]' : ''}`}
				onClick={props.onToggleDual}
			>
				{L('dualPane')}
			</button>
			<button
				type="button"
				className={`${btn} ${props.showPreview ? 'ring-1 ring-[var(--xp-fg)]' : ''}`}
				onClick={props.onTogglePreview}
			>
				{L('preview')}
			</button>
			<button
				type="button"
				className={`${btn} ${!props.sidebarCollapsed ? 'ring-1 ring-[var(--xp-fg)]' : ''}`}
				onClick={props.onToggleSidebar}
				title={`${
					props.sidebarCollapsed ? L('expandSidebar') : L('collapseSidebar')
				} (Ctrl+B)`}
			>
				{L('sidebar')}
			</button>
			<button
				type="button"
				className={`${btn} ${props.showHidden ? 'ring-1 ring-[var(--xp-fg)]' : ''}`}
				onClick={props.onToggleHidden}
				title={L('showHidden')}
			>
				{L('showHidden')}
			</button>
			<button
				type="button"
				className={`${btn} ${props.showFolderSizes ? 'ring-1 ring-[var(--xp-fg)]' : ''}`}
				onClick={props.onToggleFolderSizes}
				title={L('showFolderSizes')}
			>
				{L('showFolderSizes')}
			</button>
			<select
				className="rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 py-1.5 text-sm"
				value={props.viewMode}
				onChange={e => props.onViewMode(e.target.value as ViewMode)}
			>
				<option value="details">Details</option>
				<option value="list">List</option>
				<option value="icons">Icons</option>
				<option value="columns">{L('columns')}</option>
			</select>
			<button
				type="button"
				className={btn}
				onClick={props.onCommandPalette}
				title={`${L('commandPalette')} (Ctrl+K)`}
			>
				⌘
			</button>
			<input
				ref={searchRef}
				type="search"
				placeholder={L('search')}
				value={props.searchQuery}
				onChange={e => props.onSearch(e.target.value)}
				className="min-w-[160px] flex-1 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--xp-fg)]"
			/>
			<button
				type="button"
				className={btn}
				onClick={props.onToTray}
				title={L('toTray')}
			>
				{L('toTray')}
			</button>
			<button
				type="button"
				className={btn}
				onClick={props.onSettings}
			>
				{L('settings')}
			</button>
		</div>
	)
}
