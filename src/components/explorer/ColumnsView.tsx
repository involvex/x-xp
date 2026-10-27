import {useEffect, useState} from 'react'
import {api} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import {sortEntries} from '../../lib/sort'
import type {FileEntry, SortState, TagDef, TagMap} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface ColumnsViewProps {
	locale: Locale
	rootPath: string
	showHidden: boolean
	selected: Set<string>
	tagDefs: TagDef[]
	tagMap: TagMap
	reloadToken: number
	sort: SortState
	onSelect: (entry: FileEntry, e: React.MouseEvent) => void
	onOpenFile: (entry: FileEntry) => void
	onNavigateRoot: (path: string) => void
	onContextMenu: (entry: FileEntry, e: React.MouseEvent) => void
}

async function loadColumn(
	path: string,
	showHidden: boolean,
	sort: SortState,
): Promise<FileEntry[]> {
	const entries = await api.readDir(path)
	const filtered = showHidden ? entries : entries.filter(e => !e.hidden)
	return sortEntries(filtered, sort)
}

export function ColumnsView({
	locale,
	rootPath,
	showHidden,
	selected,
	tagDefs,
	tagMap,
	reloadToken,
	sort,
	onSelect,
	onOpenFile,
	onNavigateRoot,
	onContextMenu,
}: ColumnsViewProps) {
	const [columns, setColumns] = useState<
		{path: string; entries: FileEntry[]}[]
	>([])
	const [trail, setTrail] = useState<string[]>([rootPath])
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	useEffect(() => {
		setTrail(prev => {
			if (prev[prev.length - 1] === rootPath) return prev
			const idx = prev.indexOf(rootPath)
			if (idx >= 0) return prev.slice(0, idx + 1)
			return [rootPath]
		})
	}, [rootPath])

	useEffect(() => {
		let cancelled = false
		;(async () => {
			const next: {path: string; entries: FileEntry[]}[] = []
			for (const p of trail) {
				try {
					next.push({
						path: p,
						entries: await loadColumn(p, showHidden, sort),
					})
				} catch {
					next.push({path: p, entries: []})
					break
				}
			}
			if (!cancelled) setColumns(next)
		})()
		return () => {
			cancelled = true
		}
	}, [trail, showHidden, reloadToken, sort])

	const openDirInColumns = (entry: FileEntry, columnIndex: number) => {
		const nextTrail = [...trail.slice(0, columnIndex + 1), entry.path]
		setTrail(nextTrail)
		onNavigateRoot(entry.path)
	}

	const tagsFor = (path: string) => {
		const ids = tagMap[path] ?? []
		return tagDefs.filter(d => ids.includes(d.id))
	}

	return (
		<div className="flex min-h-0 flex-1 overflow-x-auto">
			{columns.map((col, colIndex) => (
				<div
					key={`${col.path}-${colIndex}`}
					className="flex w-56 shrink-0 flex-col border-r border-[var(--xp-border)]"
				>
					<div className="truncate border-b border-[var(--xp-border)] px-2 py-1 text-[10px] uppercase tracking-wide opacity-50">
						{col.path}
					</div>
					<ul className="flex-1 overflow-auto">
						{col.entries.length === 0 && (
							<li className="px-3 py-4 text-xs opacity-40">{L('empty')}</li>
						)}
						{col.entries.map(entry => {
							const active =
								selected.has(entry.path) || trail[colIndex + 1] === entry.path
							const tags = tagsFor(entry.path)
							return (
								<li key={entry.path}>
									<button
										type="button"
										className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm ${
											active
												? 'bg-[var(--xp-select)]'
												: 'hover:bg-[var(--xp-hover)]'
										}`}
										onClick={e => {
											onSelect(entry, e)
											if (entry.isDir) openDirInColumns(entry, colIndex)
										}}
										onDoubleClick={() => {
											if (entry.isDir) openDirInColumns(entry, colIndex)
											else onOpenFile(entry)
										}}
										onContextMenu={e => onContextMenu(entry, e)}
									>
										<FileIcon entry={entry} />
										<span
											className={`min-w-0 flex-1 truncate ${entry.isDir ? 'font-semibold text-white' : 'text-[var(--xp-fg-dim)]'}`}
										>
											{entry.name}
										</span>
										{tags.length > 0 && (
											<span className="flex gap-0.5">
												{tags.slice(0, 3).map(tag => (
													<span
														key={tag.id}
														className="h-2 w-2 rounded-full"
														style={{background: tag.color}}
														title={tag.name}
													/>
												))}
											</span>
										)}
										{entry.isDir && <span className="opacity-40">›</span>}
									</button>
								</li>
							)
						})}
					</ul>
				</div>
			))}
		</div>
	)
}
