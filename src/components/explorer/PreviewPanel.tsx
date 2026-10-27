import {convertFileSrc} from '@tauri-apps/api/core'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {api, formatDate, formatSize} from '../../lib/api'
import {t, type Locale} from '../../lib/i18n'
import {markdownToHtml} from '../../lib/markdownLite'
import {isTextualPreview, previewKind} from '../../lib/preview'
import {clampPreviewWidth, PREVIEW_WIDTH_DEFAULT} from '../../lib/store'
import type {FileEntry} from '../../types/fs'
import {FileIcon} from './FileIcon'

interface PreviewPanelProps {
	locale: Locale
	entry: FileEntry | null
	width?: number
	onWidthChange?: (width: number) => void
	/** Persist width when the drag ends (and on double-click reset). */
	onWidthCommit?: (width: number) => void
}

const TEXT_MAX = 512 * 1024

export function PreviewPanel({
	locale,
	entry,
	width = PREVIEW_WIDTH_DEFAULT,
	onWidthChange,
	onWidthCommit,
}: PreviewPanelProps) {
	const [text, setText] = useState<string | null>(null)
	const [truncated, setTruncated] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [mediaFailed, setMediaFailed] = useState(false)
	const [showRawMd, setShowRawMd] = useState(false)
	const [dragging, setDragging] = useState(false)
	const dragRef = useRef<{
		startX: number
		startW: number
		current: number
	} | null>(null)
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)

	const kind = entry
		? previewKind(entry.isDir, entry.extension, entry.name)
		: 'none'
	const assetUrl = entry && !entry.isDir ? convertFileSrc(entry.path) : null
	const panelWidth = clampPreviewWidth(width)

	useEffect(() => {
		setText(null)
		setTruncated(false)
		setError(null)
		setMediaFailed(false)
		setShowRawMd(false)
		if (!entry || !isTextualPreview(kind)) return
		let cancelled = false
		api
			.readTextPreview(entry.path, TEXT_MAX)
			.then(content => {
				if (cancelled) return
				setTruncated(content.length >= TEXT_MAX)
				setText(content)
			})
			.catch(err => {
				if (!cancelled) setError(String(err))
			})
		return () => {
			cancelled = true
		}
	}, [entry, kind])

	const mdHtml = useMemo(() => {
		if (kind !== 'markdown' || text == null || showRawMd) return null
		return markdownToHtml(text)
	}, [kind, text, showRawMd])

	const onResizePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (!onWidthChange) return
			e.preventDefault()
			e.stopPropagation()
			;(e.target as HTMLElement).setPointerCapture(e.pointerId)
			dragRef.current = {
				startX: e.clientX,
				startW: panelWidth,
				current: panelWidth,
			}
			setDragging(true)
		},
		[onWidthChange, panelWidth],
	)

	const onResizePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!dragRef.current || !onWidthChange) return
			const delta = dragRef.current.startX - e.clientX
			const next = clampPreviewWidth(dragRef.current.startW + delta)
			dragRef.current.current = next
			onWidthChange(next)
		},
		[onWidthChange],
	)

	const onResizePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!dragRef.current) return
			const finalWidth = dragRef.current.current
			try {
				;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
			} catch {
				/* already released */
			}
			dragRef.current = null
			setDragging(false)
			onWidthCommit?.(finalWidth)
		},
		[onWidthCommit],
	)

	const shellClass = `relative flex shrink-0 flex-col border-l border-[var(--xp-border)] bg-[var(--xp-panel)] ${
		dragging ? 'select-none' : ''
	}`

	const resizeHandle = onWidthChange ? (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={L('resizePreview')}
			title={L('resizePreview')}
			className={`absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none ${
				dragging ? 'bg-[var(--xp-fg)]/20' : 'hover:bg-[var(--xp-fg)]/10'
			}`}
			onPointerDown={onResizePointerDown}
			onPointerMove={onResizePointerMove}
			onPointerUp={onResizePointerUp}
			onPointerCancel={onResizePointerUp}
			onDoubleClick={() => {
				onWidthChange(PREVIEW_WIDTH_DEFAULT)
				onWidthCommit?.(PREVIEW_WIDTH_DEFAULT)
			}}
		/>
	) : null

	if (!entry) {
		return (
			<aside
				className={`${shellClass} items-center justify-center p-4 text-sm opacity-40`}
				style={{width: panelWidth}}
			>
				{resizeHandle}
				{L('noPreview')}
			</aside>
		)
	}

	return (
		<aside
			className={shellClass}
			style={{width: panelWidth}}
		>
			{resizeHandle}
			<div className="flex items-center gap-2 border-b border-[var(--xp-border)] px-3 py-2 text-sm font-semibold">
				<FileIcon entry={entry} />
				<span className="min-w-0 flex-1 truncate">{entry.name}</span>
				{kind === 'markdown' && text != null && (
					<button
						type="button"
						className="shrink-0 rounded border border-[var(--xp-border)] px-1.5 py-0.5 text-[10px] font-normal opacity-70 hover:opacity-100"
						onClick={() => setShowRawMd(v => !v)}
						title={showRawMd ? L('previewRendered') : L('previewRaw')}
					>
						{showRawMd ? L('previewRendered') : L('previewRaw')}
					</button>
				)}
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="shrink-0 space-y-0.5 border-b border-[var(--xp-border)]/50 px-3 py-2 text-[11px] opacity-60">
					<p>
						{entry.isDir ? L('folder') : formatSize(entry.size) || L('file')}
						{entry.extension ? ` · .${entry.extension.toLowerCase()}` : ''}
					</p>
					{entry.modified != null && (
						<p>
							{L('modified')}: {formatDate(entry.modified)}
						</p>
					)}
					{truncated && <p>{L('previewTruncated')}</p>}
				</div>

				<div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
					{kind === 'folder' && (
						<p className="opacity-50">{L('previewFolderHint')}</p>
					)}

					{kind === 'image' && assetUrl && !mediaFailed && (
						<img
							src={assetUrl}
							alt={entry.name}
							className="mx-auto max-h-[min(70vh,28rem)] w-full rounded object-contain"
							onError={() => setMediaFailed(true)}
						/>
					)}

					{kind === 'pdf' && assetUrl && !mediaFailed && (
						<iframe
							title={entry.name}
							src={assetUrl}
							className="h-[min(70vh,32rem)] w-full rounded border border-[var(--xp-border)] bg-[var(--xp-bg)]"
							onError={() => setMediaFailed(true)}
						/>
					)}

					{kind === 'audio' && assetUrl && !mediaFailed && (
						<audio
							controls
							src={assetUrl}
							className="w-full"
							onError={() => setMediaFailed(true)}
						>
							{L('previewMediaUnsupported')}
						</audio>
					)}

					{kind === 'video' && assetUrl && !mediaFailed && (
						<video
							controls
							src={assetUrl}
							className="mx-auto max-h-[min(70vh,28rem)] w-full rounded"
							onError={() => setMediaFailed(true)}
						>
							{L('previewMediaUnsupported')}
						</video>
					)}

					{(kind === 'image' ||
						kind === 'pdf' ||
						kind === 'audio' ||
						kind === 'video') &&
						mediaFailed && (
							<p className="opacity-50 text-[var(--xp-danger)]">
								{L('previewMediaUnsupported')}
							</p>
						)}

					{kind === 'markdown' && mdHtml != null && (
						<div
							className="preview-md text-[var(--xp-fg)]"
							dangerouslySetInnerHTML={{__html: mdHtml}}
						/>
					)}

					{((kind === 'text' && text != null) ||
						(kind === 'markdown' && showRawMd && text != null)) && (
						<pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed opacity-90">
							{text}
						</pre>
					)}

					{isTextualPreview(kind) && text == null && !error && (
						<p className="opacity-50">{L('calculating')}</p>
					)}

					{kind === 'none' && (
						<p className="opacity-50">{L('previewUnsupported')}</p>
					)}

					{error && <p className="text-[var(--xp-danger)]">{error}</p>}
				</div>
			</div>
		</aside>
	)
}
