import {useEffect, useState} from 'react'
import {splitPath} from '../../lib/api'
import {
	HOME_PATH,
	isHomePath,
	isRecyclePath,
	RECYCLE_PATH,
} from '../../lib/paths'

interface AddressBarProps {
	path: string
	onNavigate: (path: string) => void
}

export function AddressBar({path, onNavigate}: AddressBarProps) {
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(path)

	useEffect(() => {
		setDraft(path)
		setEditing(false)
	}, [path])

	if (editing) {
		return (
			<form
				className="flex gap-2 border-b border-[var(--xp-border)] px-3 py-2"
				onSubmit={e => {
					e.preventDefault()
					onNavigate(draft.trim())
					setEditing(false)
				}}
			>
				<input
					autoFocus
					value={draft}
					onChange={e => setDraft(e.target.value)}
					onBlur={() => setEditing(false)}
					className="flex-1 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-3 py-1.5 text-sm outline-none"
				/>
				<button
					type="submit"
					className="rounded bg-[var(--xp-hover)] px-3 py-1.5 text-sm hover:bg-[var(--xp-select)]"
				>
					Go
				</button>
			</form>
		)
	}

	if (isHomePath(path) || isRecyclePath(path)) {
		return (
			<div
				className="flex flex-wrap items-center gap-1 border-b border-[var(--xp-border)] px-3 py-2 text-sm"
				onDoubleClick={() => setEditing(true)}
				title="Double-click to edit path"
			>
				<button
					type="button"
					className="rounded px-1.5 py-0.5 hover:bg-[var(--xp-hover)]"
					onClick={() => onNavigate(HOME_PATH)}
				>
					Home
				</button>
				{isRecyclePath(path) && (
					<>
						<span className="opacity-40">›</span>
						<button
							type="button"
							className="rounded px-1.5 py-0.5 hover:bg-[var(--xp-hover)]"
							onClick={() => onNavigate(RECYCLE_PATH)}
						>
							Recycle Bin
						</button>
					</>
				)}
			</div>
		)
	}

	const {root, parts} = splitPath(path)
	const crumbPaths: {label: string; path: string}[] = []
	let acc = root
	crumbPaths.push({label: root.replace(/[\\/]$/, '') || root, path: root})
	for (const part of parts) {
		acc =
			acc.endsWith('\\') || acc.endsWith('/')
				? `${acc}${part}`
				: `${acc}\\${part}`
		crumbPaths.push({label: part, path: acc})
	}

	return (
		<div
			className="flex flex-wrap items-center gap-1 border-b border-[var(--xp-border)] px-3 py-2 text-sm"
			onDoubleClick={() => setEditing(true)}
			title="Double-click to edit path"
		>
			<button
				type="button"
				className="rounded px-1.5 py-0.5 opacity-60 hover:bg-[var(--xp-hover)] hover:opacity-100"
				onClick={() => onNavigate(HOME_PATH)}
			>
				Home
			</button>
			<span className="opacity-40">›</span>
			{crumbPaths.map((c, i) => (
				<span
					key={c.path}
					className="flex items-center gap-1"
				>
					{i > 0 && <span className="opacity-40">›</span>}
					<button
						type="button"
						className="rounded px-1.5 py-0.5 hover:bg-[var(--xp-hover)]"
						onClick={() => onNavigate(c.path)}
					>
						{c.label}
					</button>
				</span>
			))}
		</div>
	)
}
