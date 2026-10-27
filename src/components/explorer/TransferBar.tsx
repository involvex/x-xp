import {formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import {transferPercent, type TransferProgress} from '../../lib/transfer'

interface TransferBarProps {
	locale: Locale
	progress: TransferProgress
	onCancel: () => void
	onDismiss: () => void
}

export function TransferBar({
	locale,
	progress,
	onCancel,
	onDismiss,
}: TransferBarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const pct = transferPercent(progress)
	const running = progress.phase === 'running'
	const label =
		progress.mode === 'move' ? L('transferMoving') : L('transferCopying')
	const status =
		progress.phase === 'done'
			? L('transferDone')
			: progress.phase === 'cancelled'
				? L('transferCancelled')
				: progress.phase === 'error'
					? (progress.message ?? L('error'))
					: `${progress.index}/${progress.total}`

	return (
		<div className="fixed bottom-4 left-1/2 z-50 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-4 py-3 shadow-lg">
			<div className="mb-2 flex items-start justify-between gap-3 text-sm">
				<div className="min-w-0 flex-1">
					<div className="font-medium">
						{label}
						{running && progress.name ? (
							<span className="opacity-70">
								{' '}
								· <span className="truncate">{progress.name}</span>
							</span>
						) : null}
					</div>
					<div className="mt-0.5 text-xs opacity-60">
						{status}
						{running && progress.bytesTotal > 0
							? ` · ${formatSize(progress.bytesDone)} / ${formatSize(progress.bytesTotal)}`
							: ''}
						{running ? ` · ${pct}%` : ''}
					</div>
				</div>
				{running ? (
					<button
						type="button"
						className="shrink-0 rounded border border-[var(--xp-border)] px-2 py-1 text-xs hover:bg-[var(--xp-hover)]"
						onClick={onCancel}
					>
						{L('cancel')}
					</button>
				) : (
					<button
						type="button"
						className="shrink-0 opacity-60 hover:opacity-100"
						onClick={onDismiss}
					>
						×
					</button>
				)}
			</div>
			<div className="h-1.5 overflow-hidden rounded bg-[var(--xp-hover)]">
				<div
					className="h-full bg-[var(--xp-fg)] transition-[width] duration-150"
					style={{
						width: `${progress.phase === 'error' || progress.phase === 'cancelled' ? pct : Math.max(pct, running ? 2 : pct)}%`,
					}}
				/>
			</div>
		</div>
	)
}
