import {api} from './api'
import type {MessageKey} from './i18n'

export type UndoAction =
	| {type: 'rename'; from: string; to: string}
	| {type: 'delete'; paths: string[]}
	| {type: 'copy'; sources: string[]; destDir: string; created: string[]}
	| {type: 'move'; pairs: {from: string; to: string}[]}

const STACK_CAP = 20

export function pushUndo(
	stack: UndoAction[],
	action: UndoAction,
): UndoAction[] {
	return [...stack, action].slice(-STACK_CAP)
}

export function popUndo(stack: UndoAction[]): {
	stack: UndoAction[]
	action: UndoAction | null
} {
	if (stack.length === 0) return {stack, action: null}
	const action = stack[stack.length - 1]
	return {stack: stack.slice(0, -1), action}
}

export function undoPromptKey(action: UndoAction): MessageKey {
	switch (action.type) {
		case 'rename':
			return 'undoRename'
		case 'delete':
			return action.paths.length > 1 ? 'undoDeleteMany' : 'undoDelete'
		case 'copy':
			return action.created.length > 1 ? 'undoCopyMany' : 'undoCopy'
		case 'move':
			return action.pairs.length > 1 ? 'undoMoveMany' : 'undoMove'
	}
}

function parentDir(path: string): string {
	const normalized = path.replace(/[\\/]+$/, '')
	const idx = Math.max(
		normalized.lastIndexOf('\\'),
		normalized.lastIndexOf('/'),
	)
	if (idx <= 0) return normalized
	const parent = normalized.slice(0, idx)
	if (/^[A-Za-z]:$/i.test(parent)) return parent + '\\'
	return parent || normalized
}

async function moveToPath(from: string, to: string): Promise<string> {
	try {
		await api.renameEntry(from, to)
		return to
	} catch {
		/* cross-volume or conflict */
	}
	const parent = parentDir(to)
	const moved = await api.moveEntries([from], parent)
	const landed = moved[0]?.path
	if (!landed) throw new Error('move failed')
	if (landed.toLowerCase() !== to.toLowerCase()) {
		try {
			await api.renameEntry(landed, to)
			return to
		} catch {
			return landed
		}
	}
	return landed
}

export async function performUndo(action: UndoAction): Promise<MessageKey> {
	switch (action.type) {
		case 'rename': {
			await api.renameEntry(action.to, action.from)
			return 'undoRenameDone'
		}
		case 'delete': {
			const n = await api.restoreByOriginalPaths(action.paths)
			if (n === 0) throw new Error('undoDeleteFailed')
			return n < action.paths.length ? 'undoDeletePartial' : 'undoDeleteDone'
		}
		case 'copy': {
			if (action.created.length === 0) return 'undoCopyDone'
			await api.deleteEntries(action.created)
			return 'undoCopyDone'
		}
		case 'move': {
			for (const pair of [...action.pairs].reverse()) {
				await moveToPath(pair.to, pair.from)
			}
			return 'undoMoveDone'
		}
	}
}

export async function performRedo(
	action: UndoAction,
): Promise<{key: MessageKey; action: UndoAction}> {
	switch (action.type) {
		case 'rename': {
			await api.renameEntry(action.from, action.to)
			return {key: 'redoRenameDone', action}
		}
		case 'delete': {
			await api.deleteEntries(action.paths)
			return {key: 'redoDeleteDone', action}
		}
		case 'copy': {
			const created = await api.copyEntries(action.sources, action.destDir)
			return {
				key: 'redoCopyDone',
				action: {
					...action,
					created: created.map(e => e.path),
				},
			}
		}
		case 'move': {
			const pairs: {from: string; to: string}[] = []
			for (const pair of action.pairs) {
				const to = await moveToPath(pair.from, pair.to)
				pairs.push({from: pair.from, to})
			}
			return {key: 'redoMoveDone', action: {...action, pairs}}
		}
	}
}

/** Pair sources with copy/move results (same order as Rust returns). */
export function pairTransfer(
	sources: string[],
	results: {path: string}[],
): {from: string; to: string}[] {
	const pairs: {from: string; to: string}[] = []
	for (let i = 0; i < sources.length; i++) {
		const to = results[i]?.path
		if (to) pairs.push({from: sources[i], to})
	}
	return pairs
}
