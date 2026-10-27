import {useEffect, useMemo, useState} from 'react'
import {
	actionLabelKey,
	matchesTarget,
	type BuiltinMenuAction,
	type ContextMenuSettings,
	type OpenWithApp,
} from '../../lib/contextMenuConfig'
import {t, type Locale, type MessageKey} from '../../lib/i18n'
import type {TagDef} from '../../types/fs'

export interface ContextMenuState {
	x: number
	y: number
	path: string | null
	isDir: boolean
}

interface ContextMenuProps {
	locale: Locale
	menu: ContextMenuState | null
	canPaste: boolean
	dualPane: boolean
	hasSelection: boolean
	isArchive: boolean
	tagDefs: TagDef[]
	activeTagIds: string[]
	menuSettings: ContextMenuSettings
	onAction: (action: BuiltinMenuAction) => void
	onOpenWith: (app: OpenWithApp) => void
	onToggleTag: (tagId: string) => void
	onClose: () => void
}

type FlyoutId = 'openWith' | 'tags' | null

export function ContextMenu({
	locale,
	menu,
	canPaste,
	dualPane,
	hasSelection,
	isArchive,
	tagDefs,
	activeTagIds,
	menuSettings,
	onAction,
	onOpenWith,
	onToggleTag,
	onClose,
}: ContextMenuProps) {
	const [flyout, setFlyout] = useState<FlyoutId>(null)
	const L = (key: MessageKey) => t(key, locale)

	const ctx = useMemo(
		() => ({
			hasPath: !!menu?.path,
			isDir: !!menu?.isDir,
			isArchive,
			hasSelection,
		}),
		[menu, isArchive, hasSelection],
	)

	useEffect(() => {
		setFlyout(null)
	}, [menu?.x, menu?.y, menu?.path])

	if (!menu) return null

	const item =
		'block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--xp-hover)] disabled:opacity-40'
	const rowCls = item
	const nestedCls =
		'block w-full px-3 py-1.5 pl-7 text-left text-sm hover:bg-[var(--xp-hover)]'

	const visibleItems = menuSettings.items.filter(
		i => i.enabled && matchesTarget(i.when, ctx),
	)

	const openWithApps = menuSettings.openWith.filter(a => {
		if (!a.enabled) return false
		if (!menu.path) return false
		if (a.targets === 'both') return true
		if (a.targets === 'dir') return menu.isDir
		return !menu.isDir
	})

	const run = (action: BuiltinMenuAction) => {
		if (action === 'openOtherPane' && !dualPane) return
		if (action === 'paste' && !canPaste) return
		onAction(action)
	}

	const openSection = (id: FlyoutId) => {
		setFlyout(prev => (prev === id ? null : id))
	}

	/** Clamp so the menu stays on-screen. */
	const maxLeft =
		typeof window !== 'undefined' ? window.innerWidth - 240 : menu.x
	const maxTop =
		typeof window !== 'undefined' ? window.innerHeight - 80 : menu.y
	const left = Math.max(8, Math.min(menu.x, maxLeft))
	const top = Math.max(8, Math.min(menu.y, maxTop))

	return (
		<>
			<div
				className="fixed inset-0 z-40"
				onClick={onClose}
				onContextMenu={e => {
					e.preventDefault()
					onClose()
				}}
			/>
			<div
				className="fixed z-50 max-h-[min(80vh,520px)] min-w-[240px] overflow-auto rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl"
				style={{left, top}}
				role="menu"
			>
				{visibleItems.map((cfg, idx) => {
					if (cfg.action === 'separator') {
						const prev = visibleItems[idx - 1]
						const next = visibleItems[idx + 1]
						if (!prev || !next || prev.action === 'separator') return null
						return (
							<hr
								key={cfg.id}
								className="my-1 border-[var(--xp-border)]"
							/>
						)
					}

					if (cfg.action === 'openWith') {
						if (openWithApps.length === 0) return null
						const open = flyout === 'openWith'
						return (
							<div
								key={cfg.id}
								className="border-b border-transparent"
							>
								<button
									type="button"
									className={`${rowCls} flex items-center justify-between ${open ? 'bg-[var(--xp-hover)]' : ''}`}
									aria-expanded={open}
									onClick={() => openSection('openWith')}
								>
									<span>{L('openWith')}</span>
									<span className="opacity-50">{open ? '▾' : '▸'}</span>
								</button>
								{open && (
									<div
										className="border-y border-[var(--xp-border)] bg-[var(--xp-bg)] py-0.5"
										role="group"
									>
										{openWithApps.map(app => (
											<button
												key={app.id}
												type="button"
												className={nestedCls}
												onClick={() => onOpenWith(app)}
											>
												{app.label}
											</button>
										))}
									</div>
								)}
							</div>
						)
					}

					if (cfg.action === 'tags') {
						const open = flyout === 'tags'
						return (
							<div key={cfg.id}>
								<button
									type="button"
									className={`${rowCls} flex items-center justify-between ${open ? 'bg-[var(--xp-hover)]' : ''}`}
									aria-expanded={open}
									onClick={() => openSection('tags')}
								>
									<span>{L('tags')}</span>
									<span className="opacity-50">{open ? '▾' : '▸'}</span>
								</button>
								{open && (
									<div
										className="border-y border-[var(--xp-border)] bg-[var(--xp-bg)] py-0.5"
										role="group"
									>
										{tagDefs.length === 0 ? (
											<div className="px-3 py-1.5 pl-7 text-xs opacity-40">
												—
											</div>
										) : (
											tagDefs.map(tag => {
												const on = activeTagIds.includes(tag.id)
												return (
													<button
														key={tag.id}
														type="button"
														className={nestedCls}
														onClick={() => onToggleTag(tag.id)}
													>
														<span
															className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
															style={{background: tag.color}}
														/>
														{on ? '✓ ' : ''}
														{tag.name}
													</button>
												)
											})
										)}
									</div>
								)}
							</div>
						)
					}

					if (cfg.action.startsWith('ow:')) {
						const appId = cfg.action.slice(3)
						const app = menuSettings.openWith.find(a => a.id === appId)
						if (!app || !app.enabled) return null
						if (app.targets === 'dir' && !menu.isDir) return null
						if (app.targets === 'file' && menu.isDir) return null
						return (
							<button
								key={cfg.id}
								type="button"
								className={rowCls}
								onClick={() => {
									setFlyout(null)
									onOpenWith(app)
								}}
							>
								{app.label}
							</button>
						)
					}

					const action = cfg.action as BuiltinMenuAction
					if (action === 'openOtherPane' && !dualPane) return null
					const labelKey = actionLabelKey(action)
					if (!labelKey) return null
					const disabled = action === 'paste' && !canPaste

					return (
						<button
							key={cfg.id}
							type="button"
							className={`${rowCls} ${action === 'delete' ? 'text-[var(--xp-danger)]' : ''}`}
							disabled={disabled}
							onClick={() => {
								setFlyout(null)
								run(action)
							}}
						>
							{L(labelKey as MessageKey)}
						</button>
					)
				})}
			</div>
		</>
	)
}
