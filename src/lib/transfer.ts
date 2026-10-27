import {invoke} from '@tauri-apps/api/core'
import {listen, type UnlistenFn} from '@tauri-apps/api/event'

export type TransferPhase = 'running' | 'done' | 'cancelled' | 'error'

export interface TransferProgress {
	jobId: string
	mode: 'copy' | 'move' | string
	index: number
	total: number
	name: string
	bytesDone: number
	bytesTotal: number
	phase: TransferPhase | string
	message?: string | null
}

export function transferPercent(p: TransferProgress): number {
	if (p.total <= 0) return 0
	const itemFrac =
		p.bytesTotal > 0
			? Math.min(1, p.bytesDone / p.bytesTotal)
			: p.phase === 'done'
				? 1
				: 0
	const overall = (Math.max(0, p.index - 1) + itemFrac) / p.total
	return Math.max(0, Math.min(100, Math.round(overall * 100)))
}

export async function cancelTransfer(jobId: string): Promise<void> {
	await invoke('cancel_transfer', {jobId})
}

export function listenTransferProgress(
	handler: (progress: TransferProgress) => void,
): Promise<UnlistenFn> {
	return listen<TransferProgress>('transfer-progress', event => {
		handler(event.payload)
	})
}

export function newTransferJobId(): string {
	return crypto.randomUUID()
}
