/** Escape HTML, then apply a small safe Markdown subset for local previews. */
export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function inlineFormat(escaped: string): string {
	let s = escaped
	s = s.replace(
		/`([^`]+)`/g,
		'<code class="rounded bg-[var(--xp-hover)] px-1 py-0.5 font-mono text-[10px]">$1</code>',
	)
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
	s = s.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		'<a class="underline opacity-90 hover:opacity-100" href="$2" target="_blank" rel="noreferrer">$1</a>',
	)
	return s
}

/** Convert Markdown → safe HTML (headers, lists, code fences, inline). */
export function markdownToHtml(source: string): string {
	const lines = source.replace(/\r\n/g, '\n').split('\n')
	const out: string[] = []
	let i = 0
	let inCode = false
	let codeBuf: string[] = []
	let listType: 'ul' | 'ol' | null = null

	const closeList = () => {
		if (listType) {
			out.push(`</${listType}>`)
			listType = null
		}
	}

	while (i < lines.length) {
		const line = lines[i]
		const fence = line.match(/^```(\w*)\s*$/)
		if (fence) {
			if (inCode) {
				out.push(
					`<pre class="mb-2 overflow-x-auto rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] p-2 font-mono text-[11px] leading-relaxed"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
				)
				codeBuf = []
				inCode = false
			} else {
				closeList()
				inCode = true
			}
			i += 1
			continue
		}
		if (inCode) {
			codeBuf.push(line)
			i += 1
			continue
		}

		if (/^\s*$/.test(line)) {
			closeList()
			i += 1
			continue
		}

		const heading = line.match(/^(#{1,3})\s+(.+)$/)
		if (heading) {
			closeList()
			const level = heading[1].length
			const cls =
				level === 1
					? 'mb-2 text-sm font-semibold'
					: level === 2
						? 'mb-1.5 text-sm font-semibold'
						: 'mb-1 text-xs font-semibold'
			out.push(
				`<h${level} class="${cls}">${inlineFormat(escapeHtml(heading[2]))}</h${level}>`,
			)
			i += 1
			continue
		}

		const ul = line.match(/^[-*]\s+(.+)$/)
		if (ul) {
			if (listType !== 'ul') {
				closeList()
				listType = 'ul'
				out.push('<ul class="mb-2 list-disc space-y-0.5 pl-4">')
			}
			out.push(`<li>${inlineFormat(escapeHtml(ul[1]))}</li>`)
			i += 1
			continue
		}

		const ol = line.match(/^\d+[.)]\s+(.+)$/)
		if (ol) {
			if (listType !== 'ol') {
				closeList()
				listType = 'ol'
				out.push('<ol class="mb-2 list-decimal space-y-0.5 pl-4">')
			}
			out.push(`<li>${inlineFormat(escapeHtml(ol[1]))}</li>`)
			i += 1
			continue
		}

		closeList()
		out.push(
			`<p class="mb-2 leading-relaxed">${inlineFormat(escapeHtml(line))}</p>`,
		)
		i += 1
	}

	if (inCode) {
		out.push(
			`<pre class="mb-2 overflow-x-auto rounded border border-[var(--xp-border)] bg-[var(--xp-bg)] p-2 font-mono text-[11px]"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
		)
	}
	closeList()
	return out.join('\n')
}
