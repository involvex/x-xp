import {t, type Locale} from '../../lib/i18n'

interface StatusBarProps {
	locale: Locale
	itemCount: number
	selectedCount: number
	path: string
	searchActive: boolean
	truncated: boolean
}

export function StatusBar({
	locale,
	itemCount,
	selectedCount,
	path,
	searchActive,
	truncated,
}: StatusBarProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	return (
		<footer className="flex items-center justify-between gap-3 border-t border-[var(--xp-border)] px-3 py-1.5 text-xs opacity-70">
			<span className="truncate">{path}</span>
			<span className="shrink-0">
				{selectedCount > 0
					? `${selectedCount} ${L('selected')}`
					: `${itemCount} ${L('items')}`}
				{searchActive ? ' · search' : ''}
				{truncated ? ` · ${L('truncated')}` : ''}
			</span>
		</footer>
	)
}
