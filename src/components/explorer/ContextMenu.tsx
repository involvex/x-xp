import {t, type Locale} from '../../lib/i18n'
import type {TagDef} from '../../types/fs'

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
	dualPane: boolean
	tagDefs: TagDef[]
	activeTagIds: string[]
	onOpen: () => void
	onOpenSystem: () => void
	onOpenNewTab: () => void
	onOpenOtherPane: () => void
	onCopy: () => void
	onCut: () => void
	onPaste: () => void
	onRename: () => void
	onDelete: () => void
	onNewFolder: () => void
	onNewFile: () => void
	onCopyPath: () => void
	onProperties: () => void
	onAddBookmark: () => void
	onToggleTag: (tagId: string) => void
	onClose: () => void
}

export function ContextMenu({
	locale,
	menu,
	canPaste,
	dualPane,
	tagDefs,
	activeTagIds,
	onOpen,
	onOpenSystem,
	onOpenNewTab,
	onOpenOtherPane,
	onCopy,
	onCut,
	onPaste,
	onRename,
	onDelete,
	onNewFolder,
	onNewFile,
	onCopyPath,
	onProperties,
	onAddBookmark,
	onToggleTag,
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
				className="fixed z-50 min-w-[200px] rounded border border-[var(--xp-border)] bg-[var(--xp-panel)] py-1 shadow-xl"
				style={{left: menu.x, top: menu.y}}
			>
				{menu.path && (
					<>
						<button
							type="button"
							className={item}
							onClick={onOpen}
						>
							{L('open')}
						</button>
						<button
							type="button"
							className={item}
							onClick={onOpenSystem}
						>
							{L('openSystem')}
						</button>
						{menu.isDir && (
							<>
								<button
									type="button"
									className={item}
									onClick={onOpenNewTab}
								>
									{L('openNewTab')}
								</button>
								{dualPane && (
									<button
										type="button"
										className={item}
										onClick={onOpenOtherPane}
									>
										{L('openOtherPane')}
									</button>
								)}
								<button
									type="button"
									className={item}
									onClick={onAddBookmark}
								>
									{L('addBookmark')}
								</button>
							</>
						)}
						<button
							type="button"
							className={item}
							onClick={onCopyPath}
						>
							{L('copyPath')}
						</button>
						<button
							type="button"
							className={item}
							onClick={onProperties}
						>
							{L('properties')}
						</button>
						<hr className="my-1 border-[var(--xp-border)]" />
						<div className="px-3 py-1 text-[10px] uppercase tracking-wide opacity-50">
							{L('tags')}
						</div>
						{tagDefs.map(tag => {
							const on = activeTagIds.includes(tag.id)
							return (
								<button
									key={tag.id}
									type="button"
									className={item}
									onClick={() => onToggleTag(tag.id)}
								>
									<span
										className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
										style={{background: tag.color}}
									/>
									{on ? '✓ ' : ''}
									{tag.name}
								</button>
							)
						})}
						<hr className="my-1 border-[var(--xp-border)]" />
						<button
							type="button"
							className={item}
							onClick={onCopy}
						>
							{L('copy')}
						</button>
						<button
							type="button"
							className={item}
							onClick={onCut}
						>
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
				<button
					type="button"
					className={item}
					onClick={onNewFolder}
				>
					{L('newFolder')}
				</button>
				<button
					type="button"
					className={item}
					onClick={onNewFile}
				>
					{L('newFile')}
				</button>
				{menu.path && (
					<>
						<button
							type="button"
							className={item}
							onClick={onRename}
						>
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
