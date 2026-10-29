import {useEffect, useRef, useState} from 'react'
import {t, type Locale} from '../../lib/i18n'

interface AddressBarProps {
	locale: Locale
	path: string
	onNavigate: (path: string) => void
}

function splitPath(p: string): string[] {
	if (!p) return []
	// Handle Windows paths
	if (p.includes('\\')) {
		const parts = p.split('\\').filter(Boolean)
		// If starts with drive letter like C:
		if (parts.length > 0 && /^[A-Za-z]:$/.test(parts[0])) {
			return parts
		}
		return parts
	}
	if (p === '/') return ['/']
	const parts = p.split('/').filter(Boolean)
	if (p.startsWith('/')) return ['/', ...parts]
	return parts
}

function joinPath(parts: string[], index: number): string {
	if (parts.length === 0) return parts[0] || ''
	// Windows style
	if (parts[0] && /^[A-Za-z]:$/.test(parts[0])) {
		if (index === 0) return parts[0] + '\\'
		return parts.slice(0, index + 1).join('\\')
	}
	if (parts[0] === '/') {
		if (index === 0) return '/'
		return '/' + parts.slice(1, index + 1).join('/')
	}
	return parts.slice(0, index + 1).join('/')
}

export function AddressBar({locale, path, onNavigate}: AddressBarProps) {
	const [editing, setEditing] = useState(false)
	const [value, setValue] = useState(path)
	const inputRef = useRef<HTMLInputElement>(null)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	useEffect(() => {
		if (!editing) setValue(path)
	}, [path, editing])

	useEffect(() => {
		if (editing) {
			inputRef.current?.focus()
			inputRef.current?.select()
		}
	}, [editing])

	const parts = splitPath(path)

	const commit = () => {
		const trimmed = value.trim()
		if (trimmed) {
			onNavigate(trimmed)
		} else {
			setValue(path)
		}
		setEditing(false)
	}

	if (editing) {
		return (
			<div className="flex items-center gap-2 border-b border-[var(--xp-border)] px-3 py-1.5">
				<input
					ref={inputRef}
					className="flex-1 rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] px-2 py-1 text-sm outline-none focus:border-[var(--xp-fg)]"
					value={value}
					onChange={e => setValue(e.target.value)}
					onBlur={commit}
					onKeyDown={e => {
						if (e.key === 'Enter') {
							e.preventDefault()
							commit()
						}
						if (e.key === 'Escape') {
							e.preventDefault()
							setValue(path)
							setEditing(false)
						}
					}}
				/>
			</div>
		)
	}

	return (
		<div className="flex items-center gap-1 border-b border-[var(--xp-border)] px-3 py-1.5 text-sm overflow-x-auto">
			{parts.map((part, idx) => (
				<div
					key={idx}
					className="flex items-center gap-1"
				>
					<button
						type="button"
						className="rounded px-1.5 py-0.5 hover:bg-[var(--xp-hover)]"
						onClick={() => onNavigate(joinPath(parts, idx))}
					>
						{part === '/' ? '/' : part}
					</button>
					{idx < parts.length - 1 && <span className="opacity-40">›</span>}
				</div>
			))}
			<button
				type="button"
				className="ml-auto rounded px-1.5 py-0.5 opacity-60 hover:bg-[var(--xp-hover)] hover:opacity-100"
				onClick={() => setEditing(true)}
				title={L('editPath') || 'Edit path'}
			>
				✎
			</button>
		</div>
	)
}
