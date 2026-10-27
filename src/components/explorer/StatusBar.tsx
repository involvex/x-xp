import {useEffect, useState} from 'react'
import {t, type Locale} from '../../lib/i18n'

interface StatusBarProps {
	locale: Locale
	itemCount: number
	selectedCount: number
	path: string
	searchActive: boolean
	truncated: boolean
	/** Epoch ms when a watch-driven reload finished; flashes “Updated”. */
	lastWatchUpdate?: number | null
}

export function StatusBar({
	locale,
	itemCount,
	selectedCount,
	path,
	searchActive,
	truncated,
	lastWatchUpdate = null,
}: StatusBarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const [showUpdated, setShowUpdated] = useState(false)

	useEffect(() => {
		if (!lastWatchUpdate) return
		setShowUpdated(true)
		const handle = window.setTimeout(() => setShowUpdated(false), 2000)
		return () => window.clearTimeout(handle)
	}, [lastWatchUpdate])

	return (
		<footer className="flex items-center justify-between gap-3 border-t border-[var(--xp-border)] px-3 py-1.5 text-xs opacity-70">
			<span className="truncate">{path}</span>
			<span className="shrink-0">
				{showUpdated ? `${L('folderUpdated')} · ` : ''}
				{selectedCount > 0
					? `${selectedCount} ${L('selected')}`
					: `${itemCount} ${L('items')}`}
				{searchActive ? ' · search' : ''}
				{truncated ? ` · ${L('truncated')}` : ''}
			</span>
		</footer>
	)
}
