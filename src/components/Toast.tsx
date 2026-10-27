interface ToastProps {
	message: string | null
	onClose: () => void
}

export function Toast({message, onClose}: ToastProps) {
	if (!message) return null
	return (
		<div className="fixed bottom-4 right-4 z-50 max-w-md rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-4 py-3 text-sm shadow-lg">
			<div className="flex items-start gap-3">
				<p className="flex-1 whitespace-pre-wrap text-[var(--xp-fg)]">
					{message}
				</p>
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
