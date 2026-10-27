interface ToastProps {
	message: string | null
	actionLabel?: string | null
	onAction?: (() => void) | null
	onClose: () => void
}

export function Toast({message, actionLabel, onAction, onClose}: ToastProps) {
	if (!message) return null
	return (
		<div className="fixed bottom-4 right-4 z-50 max-w-md rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-4 py-3 text-sm shadow-lg">
			<div className="flex items-start gap-3">
				<p className="flex-1 whitespace-pre-wrap text-[var(--xp-fg)]">
					{message}
				</p>
				{actionLabel && onAction ? (
					<button
						type="button"
						className="shrink-0 rounded border border-[var(--xp-border)] px-2 py-1 text-xs font-medium hover:bg-[var(--xp-hover)]"
						onClick={() => {
							onAction()
							onClose()
						}}
					>
						{actionLabel}
					</button>
				) : null}
				<button
					type="button"
					className="opacity-60 hover:opacity-100"
					onClick={onClose}
				>
					×
				</button>
			</div>
		</div>
	)
}
