import {useCallback, useState} from 'react'
import type {FileEntry} from '../types/fs'

export function useSelection() {
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [anchor, setAnchor] = useState<string | null>(null)

	const clear = useCallback(() => {
		setSelected(new Set())
		setAnchor(null)
	}, [])

	const selectOnly = useCallback((path: string) => {
		setSelected(new Set([path]))
		setAnchor(path)
	}, [])

	const toggle = useCallback((path: string) => {
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(path)) next.delete(path)
			else next.add(path)
			return next
		})
		setAnchor(path)
	}, [])

	const rangeSelect = useCallback(
		(entries: FileEntry[], path: string) => {
			setSelected(prev => {
				const startPath = anchor ?? path
				const start = entries.findIndex(e => e.path === startPath)
				const end = entries.findIndex(e => e.path === path)
				if (start < 0 || end < 0) return new Set([path])
				const [a, b] = start < end ? [start, end] : [end, start]
				const next = new Set(prev)
				for (let i = a; i <= b; i++) next.add(entries[i].path)
				return next
			})
		},
		[anchor],
	)

	const selectAll = useCallback((entries: FileEntry[]) => {
		setSelected(new Set(entries.map(e => e.path)))
	}, [])

	return {
		selected,
		clear,
		selectOnly,
		toggle,
		rangeSelect,
		selectAll,
		setSelected,
	}
}
