import {useEffect, useState} from 'react'
import {api, formatDate, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {EntryProperties, FileEntry} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface PropertiesModalProps {
	locale: Locale
	entry: FileEntry
	onClose: () => void
}

export function PropertiesModal({
	locale,
	entry,
	onClose,
}: PropertiesModalProps) {
	const [props, setProps] = useState<EntryProperties | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [tab, setTab] = useState<'general' | 'details'>('general')
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		setError(null)
		api
			.getEntryProperties(entry.path)
			.then(p => {
				if (!cancelled) setProps(p)
			})
			.catch(e => {
				if (!cancelled) setError(String(e))
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [entry.path])

	const row = (label: string, value: string) => (
		<div className="grid grid-cols-[140px_1fr] gap-2 border-b border-[var(--xp-border)] py-2 text-sm last:border-0">
			<span className="opacity-50">{label}</span>
			<span className="break-all">{value || '—'}</span>
		</div>
	)

	const data = props
	const contains =
		data && data.isDir
			? t('containsCount', locale)
					.replace('{files}', String(data.fileCount))
					.replace('{folders}', String(data.folderCount))
			: ''

	const tabBtn = (id: 'general' | 'details', label: string) => (
		<button
			type="button"
			className={`px-3 py-1.5 text-sm ${
				tab === id
					? 'border-b-2 border-[var(--xp-fg)] text-white'
					: 'opacity-50 hover:opacity-100'
			}`}
			onClick={() => setTab(id)}
		>
			{label}
		</button>
	)

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
			<div
				className="flex max-h-[90vh] w-full max-w-lg flex-col rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] shadow-xl"
				role="dialog"
				aria-label={L('properties')}
			>
				<div className="flex items-center gap-3 border-b border-[var(--xp-border)] px-4 py-3">
					<FileIcon
						entry={entry}
						size={36}
					/>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-base font-semibold text-white">
							{data?.name ?? entry.name}
						</h2>
						<p className="truncate text-xs opacity-50">
							{L('propertiesOf').replace('{name}', data?.name ?? entry.name)}
						</p>
					</div>
					<button
						type="button"
						className="opacity-60 hover:opacity-100"
						onClick={onClose}
					>
						×
					</button>
				</div>

				<div className="flex gap-1 border-b border-[var(--xp-border)] px-2">
					{tabBtn('general', L('propGeneral'))}
					{tabBtn('details', L('propDetails'))}
				</div>

				<div className="min-h-0 flex-1 overflow-auto px-4 py-2">
					{loading && (
						<p className="py-6 text-center text-sm opacity-50">
							{L('calculating')}
						</p>
					)}
					{error && (
						<p className="py-4 text-sm text-[var(--xp-danger)]">{error}</p>
					)}
					{!loading && data && tab === 'general' && (
						<>
							{row(L('propType'), data.kind)}
							{row(L('propLocation'), data.location)}
							{row(L('size'), formatSize(data.size) || '0 B')}
							{row(L('sizeOnDisk'), formatSize(data.sizeOnDisk) || '0 B')}
							{data.isDir && row(L('contains'), contains)}
							{row(L('created'), formatDate(data.created))}
							{row(L('modified'), formatDate(data.modified))}
							<div className="mt-3 space-y-2 text-sm">
								<p className="text-xs uppercase tracking-wide opacity-50">
									{L('attributes')}
								</p>
								<label className="flex items-center gap-2 opacity-80">
									<input
										type="checkbox"
										checked={data.readonly}
										readOnly
										disabled
									/>
									{L('readonly')}
								</label>
								<label className="flex items-center gap-2 opacity-80">
									<input
										type="checkbox"
										checked={data.hidden}
										readOnly
										disabled
									/>
									{L('hidden')}
								</label>
							</div>
						</>
					)}
					{!loading && data && tab === 'details' && (
						<>
							{row(L('name'), data.name)}
							{row(L('path'), data.path)}
							{row(L('propType'), data.kind)}
							{!data.isDir && row(L('extension'), data.extension || '—')}
							{row(L('size'), `${data.size.toLocaleString()} B`)}
							{row(L('sizeOnDisk'), `${data.sizeOnDisk.toLocaleString()} B`)}
							{data.isDir && (
								<>
									{row(L('files'), String(data.fileCount))}
									{row(L('folders'), String(data.folderCount))}
								</>
							)}
							{row(L('created'), formatDate(data.created))}
							{row(L('modified'), formatDate(data.modified))}
						</>
					)}
				</div>

				<div className="flex justify-end gap-2 border-t border-[var(--xp-border)] px-4 py-3">
					<button
						type="button"
						className="rounded bg-[var(--xp-hover)] px-4 py-2 text-sm hover:bg-[var(--xp-select)]"
						onClick={onClose}
					>
						{L('close')}
					</button>
				</div>
			</div>
		</div>
	)
}
