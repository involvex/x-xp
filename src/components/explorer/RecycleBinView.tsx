import {useCallback, useEffect, useState} from 'react'
import {api} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {RecycleItem} from '../../types/fs'

interface RecycleBinViewProps {
	locale: Locale
	reloadToken: number
	onToast: (msg: string) => void
}

export function RecycleBinView({
	locale,
	reloadToken,
	onToast,
}: RecycleBinViewProps) {
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const [items, setItems] = useState<RecycleItem[]>([])
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const list = await api.listRecycleBin()
			setItems(list)
			setSelected(new Set())
		} catch (e) {
			onToast(String(e))
		} finally {
			setLoading(false)
		}
	}, [onToast])

	useEffect(() => {
		void load()
	}, [load, reloadToken])

	const selectedIds = [...selected]

	const restore = async () => {
		if (selectedIds.length === 0) return
		try {
			for (const id of selectedIds) {
				await api.restoreRecycleItem(id)
			}
			await load()
		} catch (e) {
			onToast(String(e))
		}
	}

	const remove = async () => {
		if (selectedIds.length === 0) return
		if (!window.confirm(t('confirmDeletePermanent', locale))) return
		try {
			for (const id of selectedIds) {
				await api.deleteRecycleItem(id)
			}
			await load()
		} catch (e) {
			onToast(String(e))
		}
	}

	const onClick = (item: RecycleItem, e: React.MouseEvent) => {
		if (e.ctrlKey || e.metaKey) {
			setSelected(prev => {
				const next = new Set(prev)
				if (next.has(item.id)) next.delete(item.id)
				else next.add(item.id)
				return next
			})
			return
		}
		setSelected(new Set([item.id]))
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex flex-wrap items-center gap-2 border-b border-[var(--xp-border)] px-3 py-2">
				<button
					type="button"
					className="rounded bg-[var(--xp-hover)] px-2.5 py-1.5 text-sm hover:bg-[var(--xp-select)] disabled:opacity-40"
					disabled={selectedIds.length === 0}
					onClick={() => void restore()}
				>
					{L('restoreItem')}
				</button>
				<button
					type="button"
					className="rounded bg-[var(--xp-hover)] px-2.5 py-1.5 text-sm text-[var(--xp-danger)] hover:bg-[var(--xp-select)] disabled:opacity-40"
					disabled={selectedIds.length === 0}
					onClick={() => void remove()}
				>
					{L('deletePermanent')}
				</button>
				{loading && <span className="text-xs opacity-50">Loading…</span>}
			</div>
			{items.length === 0 && !loading ? (
				<div className="flex flex-1 items-center justify-center text-sm opacity-40">
					{L('emptyRecycle')}
				</div>
			) : (
				<div className="flex flex-1 flex-col overflow-auto">
					<div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_140px_100px] gap-2 border-b border-[var(--xp-border)] bg-[var(--xp-bg)] px-3 py-1.5 text-xs uppercase tracking-wide opacity-80">
						<span>{L('name')}</span>
						<span>{L('originalLocation')}</span>
						<span>{L('dateDeleted')}</span>
						<span className="text-right">{L('size')}</span>
					</div>
					<ul className="flex flex-col">
						{items.map(item => (
							<li
								key={item.id}
								className={`grid cursor-default grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_140px_100px] items-center gap-2 px-3 py-1.5 text-sm ${
									selected.has(item.id)
										? 'bg-[var(--xp-select)]'
										: 'hover:bg-[var(--xp-hover)]'
								}`}
								onClick={e => onClick(item, e)}
								onDoubleClick={() => {
									setSelected(new Set([item.id]))
									void restore()
								}}
							>
								<span
									className={`truncate ${item.isDir ? 'font-semibold text-white' : 'text-[var(--xp-fg-dim)]'}`}
									title={item.name}
								>
									{item.name}
								</span>
								<span
									className="truncate text-xs opacity-70"
									title={item.originalPath}
								>
									{item.originalPath}
								</span>
								<span className="truncate text-xs opacity-60">
									{item.deletedDate}
								</span>
								<span className="text-right text-xs opacity-60">
									{item.sizeDisplay}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}
