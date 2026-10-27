import {useEffect, useState} from 'react'
import {api} from '../../lib/api'
import {
	actionLabelKey,
	defaultContextMenuSettings,
	type BuiltinMenuAction,
	type ContextMenuSettings,
	type OpenWithApp,
} from '../../lib/contextMenuConfig'
import {t, type Locale, type MessageKey} from '../../lib/i18n'
import type {RegistryBackupStatus} from '../../types/fs'

interface SettingsModalProps {
	locale: Locale
	onLocale: (l: Locale) => void
	menuSettings: ContextMenuSettings
	onMenuSettings: (s: ContextMenuSettings) => void
	onRestoreQuickAccess: () => void
	initialTab?: 'general' | 'menu'
	onClose: () => void
	onToast: (msg: string) => void
}

export function SettingsModal({
	locale,
	onLocale,
	menuSettings,
	onMenuSettings,
	onRestoreQuickAccess,
	initialTab = 'general',
	onClose,
	onToast,
}: SettingsModalProps) {
	const [status, setStatus] = useState<RegistryBackupStatus | null>(null)
	const [busy, setBusy] = useState(false)
	const [tab, setTab] = useState<'general' | 'menu'>(initialTab)
	const L = (key: MessageKey) => t(key, locale)

	const refresh = async () => {
		try {
			setStatus(await api.getRegistryStatus())
		} catch (e) {
			onToast(String(e))
		}
	}

	useEffect(() => {
		void refresh()
	}, [])

	const run = async (fn: () => Promise<string>) => {
		setBusy(true)
		try {
			const msg = await fn()
			onToast(msg)
			await refresh()
		} catch (e) {
			onToast(String(e))
		} finally {
			setBusy(false)
		}
	}

	const btn =
		'rounded border border-[var(--xp-border)] bg-[var(--xp-hover)] px-3 py-2 text-sm hover:bg-[var(--xp-select)] disabled:opacity-40'
	const btnFull = `w-full ${btn}`

	const moveItem = (index: number, dir: -1 | 1) => {
		const next = [...menuSettings.items]
		const j = index + dir
		if (j < 0 || j >= next.length) return
		;[next[index], next[j]] = [next[j], next[index]]
		onMenuSettings({...menuSettings, items: next})
	}

	const toggleItem = (index: number) => {
		const next = menuSettings.items.map((it, i) =>
			i === index ? {...it, enabled: !it.enabled} : it,
		)
		onMenuSettings({...menuSettings, items: next})
	}

	const updateApp = (id: string, patch: Partial<OpenWithApp>) => {
		onMenuSettings({
			...menuSettings,
			openWith: menuSettings.openWith.map(a =>
				a.id === id ? {...a, ...patch} : a,
			),
		})
	}

	const addApp = () => {
		const id = `custom-${crypto.randomUUID().slice(0, 8)}`
		onMenuSettings({
			...menuSettings,
			openWith: [
				...menuSettings.openWith,
				{
					id,
					label: 'Custom app',
					program: '',
					args: ['{path}'],
					targets: 'both',
					enabled: true,
				},
			],
		})
	}

	const removeApp = (id: string) => {
		onMenuSettings({
			...menuSettings,
			openWith: menuSettings.openWith.filter(a => a.id !== id),
		})
	}

	const labelFor = (action: string) => {
		if (action === 'separator') return '———'
		if (action.startsWith('ow:')) {
			const app = menuSettings.openWith.find(a => a.id === action.slice(3))
			return app?.label ?? action
		}
		const key = actionLabelKey(action as BuiltinMenuAction)
		return key ? L(key as MessageKey) : action
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] shadow-2xl">
				<div className="flex items-center justify-between border-b border-[var(--xp-border)] px-5 py-3">
					<h2 className="text-lg font-semibold">{L('settings')}</h2>
					<button
						type="button"
						onClick={onClose}
						className="opacity-60 hover:opacity-100"
					>
						×
					</button>
				</div>

				<div className="flex gap-1 border-b border-[var(--xp-border)] px-3">
					<button
						type="button"
						className={`px-3 py-2 text-sm ${tab === 'general' ? 'border-b-2 border-[var(--xp-fg)]' : 'opacity-50'}`}
						onClick={() => setTab('general')}
					>
						{L('propGeneral')}
					</button>
					<button
						type="button"
						className={`px-3 py-2 text-sm ${tab === 'menu' ? 'border-b-2 border-[var(--xp-fg)]' : 'opacity-50'}`}
						onClick={() => setTab('menu')}
					>
						{L('contextMenu')}
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-auto p-5">
					{tab === 'general' && (
						<>
							<label className="mb-4 block text-sm">
								Language
								<select
									className="mt-1 w-full rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] px-2 py-1.5"
									value={locale}
									onChange={e => onLocale(e.target.value as Locale)}
								>
									<option value="en">English</option>
									<option value="de">Deutsch</option>
								</select>
							</label>

							<section className="mb-6 space-y-2">
								<h3 className="text-sm font-semibold">{L('quickAccess')}</h3>
								<button
									type="button"
									className={btnFull}
									onClick={onRestoreQuickAccess}
								>
									{L('restoreQuickAccess')}
								</button>
							</section>

							<section className="space-y-2">
								<h3 className="text-sm font-semibold">{L('defaultHandler')}</h3>
								<p className="text-xs leading-relaxed opacity-70">
									{L('registryWarning')}
								</p>
								{status && (
									<p className="rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] px-3 py-2 text-xs">
										{status.message}
										{status.hasBackup ? ' · backup OK' : ' · no backup'}
										{status.isDefault ? ' · is default' : ''}
									</p>
								)}
								<button
									type="button"
									className={btnFull}
									disabled={busy}
									onClick={() => run(() => api.createRestorePoint())}
								>
									{L('createRestorePoint')}
								</button>
								<button
									type="button"
									className={btnFull}
									disabled={busy}
									onClick={() =>
										run(async () => {
											try {
												await api.createRestorePoint()
											} catch {
												/* best-effort */
											}
											await api.backupFolderHandlers()
											return api.setAsDefault()
										})
									}
								>
									{L('setDefault')}
								</button>
								<button
									type="button"
									className={btnFull}
									disabled={busy}
									onClick={() => run(() => api.restoreDefaults())}
								>
									{L('restoreDefault')}
								</button>
							</section>
						</>
					)}

					{tab === 'menu' && (
						<div className="space-y-6">
							<section>
								<div className="mb-2 flex items-center justify-between">
									<h3 className="text-sm font-semibold">{L('contextMenu')}</h3>
									<button
										type="button"
										className={btn}
										onClick={() => onMenuSettings(defaultContextMenuSettings())}
									>
										{L('resetMenu')}
									</button>
								</div>
								<ul className="space-y-1">
									{menuSettings.items.map((it, index) => (
										<li
											key={it.id}
											className="flex items-center gap-2 rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] px-2 py-1.5 text-sm"
										>
											<label className="flex min-w-0 flex-1 items-center gap-2">
												<input
													type="checkbox"
													checked={it.enabled}
													onChange={() => toggleItem(index)}
												/>
												<span className="truncate">{labelFor(it.action)}</span>
												<span className="text-[10px] opacity-40">
													{it.when}
												</span>
											</label>
											<button
												type="button"
												className="px-1 opacity-60 hover:opacity-100"
												onClick={() => moveItem(index, -1)}
												title={L('moveUp')}
											>
												↑
											</button>
											<button
												type="button"
												className="px-1 opacity-60 hover:opacity-100"
												onClick={() => moveItem(index, 1)}
												title={L('moveDown')}
											>
												↓
											</button>
										</li>
									))}
								</ul>
							</section>

							<section>
								<div className="mb-2 flex items-center justify-between">
									<h3 className="text-sm font-semibold">{L('openWithApps')}</h3>
									<button
										type="button"
										className={btn}
										onClick={addApp}
									>
										{L('addOpenWith')}
									</button>
								</div>
								<div className="space-y-3">
									{menuSettings.openWith.map(app => (
										<div
											key={app.id}
											className="space-y-2 rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] p-3 text-sm"
										>
											<div className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={app.enabled}
													onChange={e =>
														updateApp(app.id, {enabled: e.target.checked})
													}
												/>
												<input
													className="min-w-0 flex-1 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 py-1"
													value={app.label}
													onChange={e =>
														updateApp(app.id, {label: e.target.value})
													}
												/>
												<select
													className="rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 py-1"
													value={app.targets}
													onChange={e =>
														updateApp(app.id, {
															targets: e.target.value as OpenWithApp['targets'],
														})
													}
												>
													<option value="both">both</option>
													<option value="dir">dir</option>
													<option value="file">file</option>
												</select>
												<button
													type="button"
													className="text-[var(--xp-danger)]"
													onClick={() => removeApp(app.id)}
												>
													×
												</button>
											</div>
											<label className="block text-xs opacity-60">
												{L('program')}
												<input
													className="mt-0.5 w-full rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 py-1 font-mono text-xs"
													value={app.program}
													onChange={e =>
														updateApp(app.id, {program: e.target.value})
													}
													placeholder="wt.exe"
												/>
											</label>
											<label className="block text-xs opacity-60">
												{L('args')} ({'{path}'})
												<input
													className="mt-0.5 w-full rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 py-1 font-mono text-xs"
													value={app.args.join(' ')}
													onChange={e =>
														updateApp(app.id, {
															args: e.target.value.trim()
																? e.target.value.split(/\s+/)
																: [],
														})
													}
													placeholder="-d {path}"
												/>
											</label>
										</div>
									))}
								</div>
							</section>
						</div>
					)}
				</div>

				<div className="flex justify-end border-t border-[var(--xp-border)] px-5 py-3">
					<button
						type="button"
						className={btn}
						onClick={onClose}
					>
						{L('close')}
					</button>
				</div>
			</div>
		</div>
	)
}
