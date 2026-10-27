import {t, type Locale} from '../../lib/i18n'

export interface ContextMenuState {
	x: number
	y: number
	path: string | null
	isDir: boolean
}

interface ContextMenuProps {
	locale: Locale
	menu: ContextMenuState | null
	canPaste: boolean
	onOpen: () => void
	onOpenSystem: () => void
	onCopy: () => void
	onCut: () => void
	onPaste: () => void
	onRename: () => void
	onDelete: () => void
	onNewFolder: () => void
	onAddBookmark: () => void
	onClose: () => void
}

export function ContextMenu({
	locale,
	menu,
	canPaste,
	onOpen,
	onOpenSystem,
	onCopy,
	onCut,
	onPaste,
	onRename,
	onDelete,
	onNewFolder,
	onAddBookmark,
	onClose,
}: ContextMenuProps) {
	if (!menu) return null
	const L = (key: Parameters<typeof t>[0]) => t(key, locale)
	const item =
		'block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--xp-hover)] disabled:opacity-40'

	return (
		<>
			<div
				className="fixed inset-0 z-40"
				onClick={onClose}
				onContextMenu={e => {
					e.preventDefault()
					onClose()
				}}
			/>
			<div
				className="fixed z-50 min-w-[180px] rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl"
				style={{left: menu.x, top: menu.y}}
			>
				{menu.path && (
					<>
						<button type="button" className={item} onClick={onOpen}>
							{L('open')}
						</button>
						<button type="button" className={item} onClick={onOpenSystem}>
							{L('openSystem')}
						</button>
						{menu.isDir && (
							<button type="button" className={item} onClick={onAddBookmark}>
								{L('addBookmark')}
							</button>
						)}
						<hr className="my-1 border-[var(--xp-border)]" />
						<button type="button" className={item} onClick={onCopy}>
							{L('copy')}
						</button>
						<button type="button" className={item} onClick={onCut}>
							{L('cut')}
						</button>
					</>
				)}
				<button
					type="button"
					className={item}
					disabled={!canPaste}
					onClick={onPaste}
				>
					{L('paste')}
				</button>
				<button type="button" className={item} onClick={onNewFolder}>
					{L('newFolder')}
				</button>
				{menu.path && (
					<>
						<button type="button" className={item} onClick={onRename}>
							{L('rename')}
						</button>
						<button
							type="button"
							className={`${item} text-[var(--xp-danger)]`}
							onClick={onDelete}
						>
							{L('delete')}
						</button>
					</>
				)}
			</div>
		</>
	)
}
