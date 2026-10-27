import {useMemo, useState} from 'react'
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
	tagDefs: TagDef[]
	activeTagIds: string[]
	menuSettings: ContextMenuSettings
	onAction: (action: BuiltinMenuAction) => void
	onOpenWith: (app: OpenWithApp) => void
	onToggleTag: (tagId: string) => void
	onClose: () => void
}

export function ContextMenu({
	locale,
	menu,
	canPaste,
	dualPane,
	tagDefs,
	activeTagIds,
	menuSettings,
	onAction,
	onOpenWith,
	onToggleTag,
	onClose,
}: ContextMenuProps) {
	const [openWithOpen, setOpenWithOpen] = useState(false)
	const [tagsOpen, setTagsOpen] = useState(false)
	const L = (key: MessageKey) => t(key, locale)

	const ctx = useMemo(
		() => ({
			hasPath: !!menu?.path,
			isDir: !!menu?.isDir,
		}),
		[menu],
	)

	if (!menu) return null

	const item =
		'block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--xp-hover)] disabled:opacity-40'
	const rowCls = item

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
				className="fixed z-50 max-h-[min(80vh,520px)] min-w-[220px] overflow-auto rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl"
				style={{left: menu.x, top: menu.y}}
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
						return (
							<div
								key={cfg.id}
								className="relative"
							>
								<button
									type="button"
									className={`${rowCls} flex items-center justify-between`}
									onMouseEnter={() => {
										setOpenWithOpen(true)
										setTagsOpen(false)
									}}
									onClick={() => setOpenWithOpen(v => !v)}
								>
									<span>{L('openWith')}</span>
									<span className="opacity-50">›</span>
								</button>
								{openWithOpen && (
									<div className="absolute top-0 left-full z-50 ml-0.5 min-w-[180px] rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl">
										{openWithApps.map(app => (
											<button
												key={app.id}
												type="button"
												className={rowCls}
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
						return (
							<div
								key={cfg.id}
								className="relative"
							>
								<button
									type="button"
									className={`${rowCls} flex items-center justify-between`}
									onMouseEnter={() => {
										setTagsOpen(true)
										setOpenWithOpen(false)
									}}
									onClick={() => setTagsOpen(v => !v)}
								>
									<span>{L('tags')}</span>
									<span className="opacity-50">›</span>
								</button>
								{tagsOpen && (
									<div className="absolute top-0 left-full z-50 ml-0.5 min-w-[160px] rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl">
										{tagDefs.map(tag => {
											const on = activeTagIds.includes(tag.id)
											return (
												<button
													key={tag.id}
													type="button"
													className={rowCls}
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
										})}
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
								onClick={() => onOpenWith(app)}
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
							onMouseEnter={() => {
								setOpenWithOpen(false)
								setTagsOpen(false)
							}}
							onClick={() => run(action)}
						>
							{L(labelKey as MessageKey)}
						</button>
					)
				})}
			</div>
		</>
	)
}
