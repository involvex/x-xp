import {convertFileSrc} from '@tauri-apps/api/core'
import {useEffect, useState} from 'react'
import {api, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import type {FileEntry} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface PreviewPanelProps {
	locale: Locale
	entry: FileEntry | null
}

const TEXT_EXT = new Set([
	'txt',
	'md',
	'json',
	'ts',
	'tsx',
	'js',
	'jsx',
	'css',
	'html',
	'rs',
	'toml',
	'yaml',
	'yml',
	'xml',
	'csv',
	'log',
	'ini',
	'env',
	'gitignore',
])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])

export function PreviewPanel({locale, entry}: PreviewPanelProps) {
	const [text, setText] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [imgFailed, setImgFailed] = useState(false)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	useEffect(() => {
		setText(null)
		setError(null)
		setImgFailed(false)
		if (!entry || entry.isDir) return
		const ext = entry.extension.toLowerCase()
		if (!TEXT_EXT.has(ext)) return
		let cancelled = false
		api
			.readTextPreview(entry.path)
			.then(content => {
				if (!cancelled) setText(content)
			})
			.catch(err => {
				if (!cancelled) setError(String(err))
			})
		return () => {
			cancelled = true
		}
	}, [entry])

	if (!entry) {
		return (
			<aside className="flex w-72 shrink-0 items-center justify-center border-l border-[var(--xp-border)] bg-[var(--xp-panel)] p-4 text-sm opacity-40">
				{L('noPreview')}
			</aside>
		)
	}

	const ext = entry.extension.toLowerCase()
	const isImage = IMAGE_EXT.has(ext)

	return (
		<aside className="flex w-72 shrink-0 flex-col border-l border-[var(--xp-border)] bg-[var(--xp-panel)]">
			<div className="flex items-center gap-2 border-b border-[var(--xp-border)] px-3 py-2 text-sm font-semibold">
				<FileIcon entry={entry} />
				<span className="truncate">{entry.name}</span>
			</div>
			<div className="flex-1 overflow-auto p-3 text-xs">
				<p className="mb-2 opacity-60">
					{entry.isDir ? L('folder') : formatSize(entry.size)}
				</p>
				{entry.isDir && <p className="opacity-50">{L('folder')}</p>}
				{isImage && !imgFailed && (
					<img
						src={convertFileSrc(entry.path)}
						alt={entry.name}
						className="mb-2 max-h-64 w-full rounded object-contain"
						onError={() => setImgFailed(true)}
					/>
				)}
				{isImage && imgFailed && (
					<p className="opacity-50 text-[var(--xp-danger)]">{L('error')}</p>
				)}
				{TEXT_EXT.has(ext) && text != null && (
					<pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed opacity-90">
						{text}
					</pre>
				)}
				{error && <p className="text-[var(--xp-danger)]">{error}</p>}
			</div>
		</aside>
	)
}
