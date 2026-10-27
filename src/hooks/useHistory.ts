import {useCallback, useState} from 'react'

export function useHistory(initial: string) {
	const [history, setHistory] = useState<string[]>([initial])
	const [index, setIndex] = useState(0)

	const path = history[index] ?? initial

	const navigate = useCallback(
		(next: string, replace = false) => {
			if (!next || next === path) return
			setHistory(prev => {
				const base = replace ? prev.slice(0, index) : prev.slice(0, index + 1)
				const nextHist = [...base, next]
				setIndex(nextHist.length - 1)
				return nextHist
			})
		},
		[index, path],
	)

	const back = useCallback(() => {
		setIndex(i => Math.max(0, i - 1))
	}, [])

	const forward = useCallback(() => {
		setIndex(i => Math.min(history.length - 1, i + 1))
	}, [history.length])

	const canBack = index > 0
	const canForward = index < history.length - 1

	const reset = useCallback((p: string) => {
		setHistory([p])
		setIndex(0)
	}, [])

	return {
		path,
		history,
		index,
		navigate,
		back,
		forward,
		canBack,
		canForward,
		reset,
	}
}
