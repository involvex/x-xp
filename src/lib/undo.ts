import {api} from './api'
import type {MessageKey} from './i18n'

export type UndoAction =
	{type: 'rename'; from: string; to: string} | {type: 'delete'; paths: string[]}

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
	if (action.type === 'rename') return 'undoRename'
	return action.paths.length > 1 ? 'undoDeleteMany' : 'undoDelete'
}

export async function performUndo(action: UndoAction): Promise<MessageKey> {
	if (action.type === 'rename') {
		await api.renameEntry(action.to, action.from)
		return 'undoRenameDone'
	}
	const n = await api.restoreByOriginalPaths(action.paths)
	if (n === 0) throw new Error('undoDeleteFailed')
	return n < action.paths.length ? 'undoDeletePartial' : 'undoDeleteDone'
}
