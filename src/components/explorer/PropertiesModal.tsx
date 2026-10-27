import {formatDate, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {FileEntry} from '../../types/fs'
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
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const row = (label: string, value: string) => (
		<div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
			<span className="opacity-50">{label}</span>
			<span className="break-all">{value || '—'}</span>
		</div>
	)

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
			<div
				className="w-full max-w-md rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] p-4 shadow-xl"
				role="dialog"
				aria-label={L('properties')}
			>
				<div className="mb-4 flex items-center gap-3">
					<FileIcon
						entry={entry}
						size={28}
					/>
					<div className="min-w-0">
						<h2 className="truncate text-base font-semibold text-white">
							{entry.name}
						</h2>
						<p className="text-xs opacity-50">
							{entry.isDir ? L('folder') : entry.extension || L('file')}
						</p>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					{row(L('path'), entry.path)}
					{row(L('size'), entry.isDir ? '' : formatSize(entry.size))}
					{row(L('modified'), formatDate(entry.modified))}
					{row(L('hidden'), entry.hidden ? L('yes') : L('no'))}
					{row(L('readonly'), entry.readonly ? L('yes') : L('no'))}
				</div>
				<div className="mt-4 flex justify-end">
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
