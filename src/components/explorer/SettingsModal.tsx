import {useEffect, useState} from 'react'
import {api} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {RegistryBackupStatus} from '../../types/fs'

interface SettingsModalProps {
	locale: Locale
	onLocale: (l: Locale) => void
	onClose: () => void
	onToast: (msg: string) => void
}

export function SettingsModal({
	locale,
	onLocale,
	onClose,
	onToast,
}: SettingsModalProps) {
	const [status, setStatus] = useState<RegistryBackupStatus | null>(null)
	const [busy, setBusy] = useState(false)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

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
		'w-full rounded border border-[var(--xp-border)] bg-[var(--xp-hover)] px-3 py-2 text-sm hover:bg-[var(--xp-select)] disabled:opacity-40'

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="w-full max-w-lg rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] p-5 shadow-2xl">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{L('settings')}</h2>
					<button
						type="button"
						onClick={onClose}
						className="opacity-60 hover:opacity-100"
					>
						×
					</button>
				</div>

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
						className={btn}
						disabled={busy}
						onClick={() => run(() => api.createRestorePoint())}
					>
						{L('createRestorePoint')}
					</button>
					<button
						type="button"
						className={btn}
						disabled={busy}
						onClick={() =>
							run(async () => {
								try {
									await api.createRestorePoint()
								} catch {
									/* restore point is best-effort */
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
						className={btn}
						disabled={busy}
						onClick={() => run(() => api.restoreDefaults())}
					>
						{L('restoreDefault')}
					</button>
				</section>

				<div className="mt-5 flex justify-end">
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
