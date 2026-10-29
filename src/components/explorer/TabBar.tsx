import {useState} from 'react'
import {t, type Locale} from '../../lib/i18n'
import type {ExplorerTab} from '../../types/fs'

interface TabBarProps {
	tabs: ExplorerTab[]
	activeId: string
	locale?: Locale
	onSelect: (id: string) => void
	onClose: (id: string) => void
	onCloseOthers?: (id: string) => void
	onCloseRight?: (id: string) => void
	onCloseLeft?: (id: string) => void
	onCloseAll?: () => void
	onNew: () => void
}

export function TabBar({
	tabs,
	activeId,
	locale = 'en',
	onSelect,
	onClose,
	onCloseOthers,
	onCloseRight,
	onCloseLeft,
	onCloseAll,
	onNew,
}: TabBarProps) {
	const [menu, setMenu] = useState<{
		x: number
		y: number
		tabId: string
	} | null>(null)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	const closeMenu = () => setMenu(null)

	return (
		<div
			className="flex items-center gap-1 overflow-x-auto border-b border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 pt-1"
			onClick={closeMenu}
			onContextMenu={e => {
				e.preventDefault()
			}}
		>
			{tabs.map(tab => (
				<div
					key={tab.id}
					className={`group flex max-w-[200px] items-center gap-1 rounded-t px-2 py-1.5 text-xs ${
						tab.id === activeId
							? 'bg-[var(--xp-bg)] text-white'
							: 'opacity-60 hover:opacity-100'
					}`}
					onClick={() => {
						closeMenu()
						onSelect(tab.id)
					}}
					onContextMenu={e => {
						e.preventDefault()
						e.stopPropagation()
						setMenu({x: e.clientX, y: e.clientY, tabId: tab.id})
					}}
					onAuxClick={e => {
						if (e.button === 1) {
							e.preventDefault()
							onClose(tab.id)
						}
					}}
				>
					<button
						type="button"
						className="truncate"
					>
						{tab.title}
					</button>
					{tabs.length > 1 && (
						<button
							type="button"
							className="rounded px-1 opacity-0 group-hover:opacity-70 hover:opacity-100"
							onClick={e => {
								e.stopPropagation()
								onClose(tab.id)
							}}
						>
							×
						</button>
					)}
				</div>
			))}
			<button
				type="button"
				className="rounded px-2 py-1 text-xs opacity-60 hover:bg-[var(--xp-hover)] hover:opacity-100"
				onClick={onNew}
			>
				+
			</button>
			{menu && (
				<div
					className="fixed z-[70] min-w-[160px] rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 text-sm shadow-xl"
					style={{left: menu.x, top: menu.y}}
					onClick={closeMenu}
				>
					<button
						type="button"
						className="w-full px-3 py-1.5 text-left hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={tabs.length <= 1}
						onClick={() => onClose(menu.tabId)}
					>
						{L('closeTab')}
					</button>
					<button
						type="button"
						className="w-full px-3 py-1.5 text-left hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={!onCloseOthers || tabs.length <= 1}
						onClick={() => onCloseOthers?.(menu.tabId)}
					>
						{L('closeOtherTabs')}
					</button>
					<button
						type="button"
						className="w-full px-3 py-1.5 text-left hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={!onCloseLeft}
						onClick={() => {
							const idx = tabs.findIndex(t => t.id === menu.tabId)
							if (idx <= 0) return
							onCloseLeft?.(menu.tabId)
						}}
					>
						{L('closeTabsToLeft')}
					</button>
					<button
						type="button"
						className="w-full px-3 py-1.5 text-left hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={!onCloseRight}
						onClick={() => {
							const idx = tabs.findIndex(t => t.id === menu.tabId)
							if (idx < 0 || idx >= tabs.length - 1) return
							onCloseRight?.(menu.tabId)
						}}
					>
						{L('closeTabsToRight')}
					</button>
					<div className="my-1 border-t border-[var(--xp-border)]" />
					<button
						type="button"
						className="w-full px-3 py-1.5 text-left hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={!onCloseAll || tabs.length <= 1}
						onClick={() => onCloseAll?.()}
					>
						{L('closeAllTabs')}
					</button>
				</div>
			)}
		</div>
	)
}
