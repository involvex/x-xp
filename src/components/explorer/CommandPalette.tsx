import {useEffect, useMemo, useState} from 'react'
import {t, type Locale} from '../../lib/i18n'
import type {ViewMode} from '../../types/fs'

export interface PaletteAction {
	id: string
	label: string
	hint?: string
	run: () => void
}

interface CommandPaletteProps {
	locale: Locale
	open: boolean
	onClose: () => void
	actions: PaletteAction[]
}

export function CommandPalette({
	locale,
	open,
	onClose,
	actions,
}: CommandPaletteProps) {
	const [query, setQuery] = useState('')
	const [index, setIndex] = useState(0)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return actions
		return actions.filter(
			a =>
				a.label.toLowerCase().includes(q) ||
				a.id.toLowerCase().includes(q) ||
				(a.hint?.toLowerCase().includes(q) ?? false),
		)
	}, [actions, query])

	useEffect(() => {
		if (open) {
			setQuery('')
			setIndex(0)
		}
	}, [open])

	useEffect(() => {
		setIndex(0)
	}, [query])

	if (!open) return null

	const run = (action: PaletteAction) => {
		action.run()
		onClose()
	}

	return (
		<div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 pt-[12vh] p-4">
			<div
				className="w-full max-w-lg overflow-hidden rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] shadow-2xl"
				role="dialog"
				aria-label={L('commandPalette')}
			>
				<input
					autoFocus
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder={L('commandPaletteHint')}
					className="w-full border-b border-[var(--xp-border)] bg-transparent px-4 py-3 text-sm outline-none"
					onKeyDown={e => {
						if (e.key === 'Escape') {
							e.preventDefault()
							onClose()
						}
						if (e.key === 'ArrowDown') {
							e.preventDefault()
							setIndex(i => Math.min(i + 1, Math.max(0, filtered.length - 1)))
						}
						if (e.key === 'ArrowUp') {
							e.preventDefault()
							setIndex(i => Math.max(0, i - 1))
						}
						if (e.key === 'Enter' && filtered[index]) {
							e.preventDefault()
							run(filtered[index])
						}
					}}
				/>
				<ul className="max-h-72 overflow-auto py-1">
					{filtered.length === 0 && (
						<li className="px-4 py-3 text-sm opacity-40">{L('empty')}</li>
					)}
					{filtered.map((action, i) => (
						<li key={action.id}>
							<button
								type="button"
								className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
									i === index
										? 'bg-[var(--xp-select)]'
										: 'hover:bg-[var(--xp-hover)]'
								}`}
								onMouseEnter={() => setIndex(i)}
								onClick={() => run(action)}
							>
								<span>{action.label}</span>
								{action.hint && (
									<span className="text-xs opacity-40">{action.hint}</span>
								)}
							</button>
						</li>
					))}
				</ul>
			</div>
			<button
				type="button"
				className="fixed inset-0 -z-10 cursor-default"
				aria-label={L('close')}
				onClick={onClose}
			/>
		</div>
	)
}

export function viewModeLabel(mode: ViewMode): string {
	switch (mode) {
		case 'details':
			return 'Details'
		case 'list':
			return 'List'
		case 'icons':
			return 'Icons'
		case 'columns':
			return 'Columns'
	}
}
