import {useEffect, useState} from 'react'
import {api, type LocksmithProcess} from '../../lib/api'
import {t, type Locale, type MessageKey} from '../../lib/i18n'

interface LocksmithModalProps {
	locale: Locale
	paths: string[]
	exe?: string
	onClose: () => void
	onToast: (msg: string) => void
}

export function LocksmithModal({
	locale,
	paths,
	exe,
	onClose,
	onToast,
}: LocksmithModalProps) {
	const L = (key: MessageKey) => t(key, locale)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [processes, setProcesses] = useState<LocksmithProcess[]>([])
	const [error, setError] = useState<string | null>(null)

	const refresh = async (kill = false) => {
		if (kill) setBusy(true)
		else setLoading(true)
		setError(null)
		try {
			const result = await api.fileLocksmithQuery(
				paths,
				kill,
				exe?.trim() || null,
			)
			setProcesses(result.processes ?? [])
		} catch (e) {
			const msg = String(e)
			setError(msg.includes('not found') ? L('locksmithMissing') : msg)
			setProcesses([])
		} finally {
			setLoading(false)
			setBusy(false)
		}
	}

	const pathsKey = paths.join('|')
	useEffect(() => {
		void refresh(false)
		// refresh reads current paths/exe from closure
	}, [pathsKey])

	const onKill = () => {
		if (!window.confirm(L('locksmithKillConfirm'))) return
		void refresh(true).then(() => onToast(L('locksmithKill')))
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] shadow-2xl">
				<div className="flex items-center justify-between border-b border-[var(--xp-border)] px-4 py-3">
					<h2 className="text-base font-semibold">{L('locksmithTitle')}</h2>
					<button
						type="button"
						className="opacity-60 hover:opacity-100"
						onClick={onClose}
					>
						×
					</button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
					<p className="mb-3 truncate text-xs opacity-60">{paths.join(', ')}</p>
					{loading ? (
						<p className="opacity-50">{L('calculating')}</p>
					) : error ? (
						<p className="text-[var(--xp-danger)]">{error}</p>
					) : processes.length === 0 ? (
						<p className="opacity-60">{L('locksmithEmpty')}</p>
					) : (
						<ul className="space-y-2">
							{processes.map(p => (
								<li
									key={`${p.pid}-${p.name}`}
									className="rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] px-3 py-2"
								>
									<div className="font-medium text-white">
										{p.name} <span className="opacity-50">PID {p.pid}</span>
									</div>
									{p.user ? (
										<div className="text-xs opacity-50">{p.user}</div>
									) : null}
									{p.files?.length ? (
										<ul className="mt-1 space-y-0.5 text-xs opacity-70">
											{p.files.slice(0, 6).map(f => (
												<li
													key={f}
													className="truncate"
												>
													{f}
												</li>
											))}
											{p.files.length > 6 ? (
												<li>… +{p.files.length - 6}</li>
											) : null}
										</ul>
									) : null}
								</li>
							))}
						</ul>
					)}
				</div>
				<div className="flex justify-end gap-2 border-t border-[var(--xp-border)] px-4 py-3">
					<button
						type="button"
						className="rounded border border-[var(--xp-border)] px-3 py-1.5 text-sm hover:bg-[var(--xp-hover)]"
						onClick={onClose}
					>
						{L('close')}
					</button>
					<button
						type="button"
						className="rounded border border-[var(--xp-danger)] px-3 py-1.5 text-sm text-[var(--xp-danger)] hover:bg-[var(--xp-hover)] disabled:opacity-40"
						disabled={busy || loading || !!error || processes.length === 0}
						onClick={onKill}
					>
						{L('locksmithKill')}
					</button>
				</div>
			</div>
		</div>
	)
}
