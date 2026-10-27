import type {FileEntry, SortState} from '../types/fs'

export function sortEntries(
	entries: FileEntry[],
	sort: SortState,
): FileEntry[] {
	const dir = sort.dir === 'asc' ? 1 : -1
	return [...entries].sort((a, b) => {
		if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
		const cmp =
			sort.key === 'size'
				? a.size - b.size
				: sort.key === 'modified'
					? (a.modified ?? 0) - (b.modified ?? 0)
					: a.name.localeCompare(b.name, undefined, {sensitivity: 'base'})
		return cmp * dir
	})
}
