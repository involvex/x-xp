import type {ExplorerTab} from '../../types/fs'

interface TabBarProps {
	tabs: ExplorerTab[]
	activeId: string
	onSelect: (id: string) => void
	onClose: (id: string) => void
	onNew: () => void
}

export function TabBar({
	tabs,
	activeId,
	onSelect,
	onClose,
	onNew,
}: TabBarProps) {
	return (
		<div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--xp-border)] bg-[var(--xp-panel)] px-2 pt-1">
			{tabs.map(tab => (
				<div
					key={tab.id}
					className={`group flex max-w-[200px] items-center gap-1 rounded-t px-2 py-1.5 text-xs ${
						tab.id === activeId
							? 'bg-[var(--xp-bg)] text-white'
							: 'opacity-60 hover:opacity-100'
					}`}
					onClick={() => onSelect(tab.id)}
					onAuxClick={e => {
						if (e.button === 1) {
							e.preventDefault()
							onClose(tab.id)
						}
					}}
				>
					<button
						type="button"
						className="truncate"
					>
						{tab.title}
					</button>
					{tabs.length > 1 && (
						<button
							type="button"
							className="rounded px-1 opacity-0 group-hover:opacity-70 hover:opacity-100"
							onClick={e => {
								e.stopPropagation()
								onClose(tab.id)
							}}
						>
							×
						</button>
					)}
				</div>
			))}
			<button
				type="button"
				className="rounded px-2 py-1 text-xs opacity-60 hover:bg-[var(--xp-hover)] hover:opacity-100"
				onClick={onNew}
			>
				+
			</button>
		</div>
	)
}
