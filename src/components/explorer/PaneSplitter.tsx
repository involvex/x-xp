import {useCallback, useRef, useState} from 'react'
import {clampDualSplit, DUAL_SPLIT_DEFAULT} from '../../lib/store'

interface PaneSplitterProps {
	label: string
	/** Container that wraps both panes (for ratio math). */
	containerRef: React.RefObject<HTMLElement | null>
	ratio: number
	onRatioChange: (ratio: number) => void
	onRatioCommit: (ratio: number) => void
}

export function PaneSplitter({
	label,
	containerRef,
	ratio,
	onRatioChange,
	onRatioCommit,
}: PaneSplitterProps) {
	const [dragging, setDragging] = useState(false)
	const draggingRef = useRef(false)
	const liveRef = useRef(ratio)

	const ratioFromClientX = useCallback(
		(clientX: number) => {
			const el = containerRef.current
			if (!el) return ratio
			const rect = el.getBoundingClientRect()
			if (rect.width <= 0) return ratio
			return clampDualSplit((clientX - rect.left) / rect.width)
		},
		[containerRef, ratio],
	)

	const onPointerDown = (e: React.PointerEvent) => {
		e.preventDefault()
		e.stopPropagation()
		;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		liveRef.current = ratio
		draggingRef.current = true
		setDragging(true)
	}

	const onPointerMove = (e: React.PointerEvent) => {
		if (!draggingRef.current) return
		const next = ratioFromClientX(e.clientX)
		liveRef.current = next
		onRatioChange(next)
	}

	const onPointerUp = (e: React.PointerEvent) => {
		if (!draggingRef.current) return
		try {
			;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
		} catch {
			/* already released */
		}
		draggingRef.current = false
		setDragging(false)
		onRatioCommit(liveRef.current)
	}

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-valuenow={Math.round(ratio * 100)}
			aria-valuemin={20}
			aria-valuemax={80}
			aria-label={label}
			title={label}
			className={`relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-[var(--xp-border)] ${
				dragging ? 'bg-[var(--xp-fg)]/40' : 'hover:bg-[var(--xp-fg)]/25'
			}`}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onDoubleClick={() => {
				onRatioChange(DUAL_SPLIT_DEFAULT)
				onRatioCommit(DUAL_SPLIT_DEFAULT)
			}}
		>
			{/* Wider hit target */}
			<div className="absolute inset-y-0 -left-1 -right-1" />
		</div>
	)
}
