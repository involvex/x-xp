import type {ReactNode} from 'react'
import {pathBasename} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {Bookmark, FileEntry, KnownFolder} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface HomePageProps {
	locale: Locale
	drives: FileEntry[]
	known: KnownFolder[]
	bookmarks: Bookmark[]
	recent: string[]
	onNavigate: (path: string) => void
}

function Section({title, children}: {title: string; children: ReactNode}) {
	return (
		<section className="mb-6">
			<h2 className="mb-2 text-xs uppercase tracking-wide opacity-50">
				{title}
			</h2>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
				{children}
			</div>
		</section>
	)
}

function Tile({
	label,
	sub,
	isDir,
	extension = '',
	onClick,
}: {
	label: string
	sub?: string
	isDir: boolean
	extension?: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center gap-3 rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] px-3 py-2.5 text-left hover:bg-[var(--xp-hover)]"
		>
			<FileIcon
				entry={{isDir, extension}}
				size={22}
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold text-white">
					{label}
				</span>
				{sub && (
					<span className="block truncate text-xs opacity-50">{sub}</span>
				)}
			</span>
		</button>
	)
}

export function HomePage({
	locale,
	drives,
	known,
	bookmarks,
	recent,
	onNavigate,
}: HomePageProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	return (
		<div className="flex-1 overflow-auto p-4">
			<h1 className="mb-4 text-lg font-semibold text-white">{L('home')}</h1>

			<Section title={L('quickAccess')}>
				{known.map(f => (
					<Tile
						key={f.id}
						label={f.label}
						sub={f.path}
						isDir
						onClick={() => onNavigate(f.path)}
					/>
				))}
			</Section>

			<Section title={L('drives')}>
				{drives.map(d => (
					<Tile
						key={d.path}
						label={d.name}
						sub={d.path}
						isDir
						onClick={() => onNavigate(d.path)}
					/>
				))}
			</Section>

			{bookmarks.length > 0 && (
				<Section title={L('bookmarks')}>
					{bookmarks.map(b => (
						<Tile
							key={b.id}
							label={b.label}
							sub={b.path}
							isDir
							onClick={() => onNavigate(b.path)}
						/>
					))}
				</Section>
			)}

			{recent.length > 0 && (
				<Section title={L('recent')}>
					{recent.map(p => (
						<Tile
							key={p}
							label={pathBasename(p) || p}
							sub={p}
							isDir
							onClick={() => onNavigate(p)}
						/>
					))}
				</Section>
			)}
		</div>
	)
}
