export type PreviewKind =
	'folder' | 'image' | 'pdf' | 'markdown' | 'text' | 'audio' | 'video' | 'none'

const IMAGE_EXT = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'bmp',
	'svg',
	'ico',
	'avif',
])

const PDF_EXT = new Set(['pdf'])

const MARKDOWN_EXT = new Set(['md', 'markdown', 'mdown', 'mdx'])

const AUDIO_EXT = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'])

const VIDEO_EXT = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v'])

const TEXT_EXT = new Set([
	'txt',
	'json',
	'ts',
	'tsx',
	'js',
	'jsx',
	'css',
	'scss',
	'html',
	'htm',
	'rs',
	'toml',
	'yaml',
	'yml',
	'xml',
	'csv',
	'log',
	'ini',
	'env',
	'gitignore',
	'dockerfile',
	'editorconfig',
	'conf',
	'cfg',
	'sh',
	'bash',
	'ps1',
	'bat',
	'cmd',
	'py',
	'go',
	'java',
	'c',
	'cpp',
	'h',
	'hpp',
	'cs',
	'sql',
	'graphql',
	'vue',
	'svelte',
	'kt',
	'swift',
	'rb',
	'php',
	'r',
	'lock',
	'nfo',
	'readme',
])

export function previewKind(
	isDir: boolean,
	extension: string,
	name?: string,
): PreviewKind {
	if (isDir) return 'folder'
	const ext = extension.toLowerCase()
	const base = (name ?? '').toLowerCase()
	if (IMAGE_EXT.has(ext)) return 'image'
	if (PDF_EXT.has(ext)) return 'pdf'
	if (MARKDOWN_EXT.has(ext)) return 'markdown'
	if (AUDIO_EXT.has(ext)) return 'audio'
	if (VIDEO_EXT.has(ext)) return 'video'
	if (TEXT_EXT.has(ext) || base === 'dockerfile' || base === 'makefile') {
		return 'text'
	}
	// extensionless text-ish names
	if (!ext && /^(readme|license|changelog|authors)$/i.test(base)) return 'text'
	return 'none'
}

export function isTextualPreview(kind: PreviewKind): boolean {
	return kind === 'text' || kind === 'markdown'
}
