import type {FileEntry} from '../../types/fs'

type IconKind =
	'folder' | 'image' | 'text' | 'code' | 'audio' | 'video' | 'archive' | 'file'

function kindFor(entry: Pick<FileEntry, 'isDir' | 'extension'>): IconKind {
	if (entry.isDir) return 'folder'
	const ext = entry.extension.toLowerCase()
	if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext))
		return 'image'
	if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio'
	if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext)) return 'video'
	if (['zip', '7z', 'rar', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive'
	if (
		[
			'ts',
			'tsx',
			'js',
			'jsx',
			'rs',
			'py',
			'go',
			'java',
			'c',
			'cpp',
			'h',
			'cs',
			'json',
			'toml',
			'yaml',
			'yml',
			'xml',
			'html',
			'css',
			'scss',
		].includes(ext)
	)
		return 'code'
	if (['txt', 'md', 'log', 'csv', 'ini', 'env', 'gitignore'].includes(ext))
		return 'text'
	return 'file'
}

interface FileIconProps {
	entry: Pick<FileEntry, 'isDir' | 'extension'>
	className?: string
	size?: number
}

export function FileIcon({entry, className = '', size = 16}: FileIconProps) {
	const kind = kindFor(entry)
	const common = {
		width: size,
		height: size,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		strokeWidth: 1.6,
		strokeLinecap: 'round' as const,
		strokeLinejoin: 'round' as const,
		className: `shrink-0 opacity-90 ${className}`,
		'aria-hidden': true as const,
	}

	switch (kind) {
		case 'folder':
			return (
				<svg {...common}>
					<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" />
				</svg>
			)
		case 'image':
			return (
				<svg {...common}>
					<rect
						x="3"
						y="5"
						width="18"
						height="14"
						rx="2"
					/>
					<circle
						cx="9"
						cy="10"
						r="1.5"
					/>
					<path d="m21 15-4.5-4.5L7 20" />
				</svg>
			)
		case 'audio':
			return (
				<svg {...common}>
					<path d="M9 18V6l12-2v12" />
					<circle
						cx="6"
						cy="18"
						r="3"
					/>
					<circle
						cx="18"
						cy="16"
						r="3"
					/>
				</svg>
			)
		case 'video':
			return (
				<svg {...common}>
					<rect
						x="3"
						y="6"
						width="13"
						height="12"
						rx="2"
					/>
					<path d="m16 10 5-3v10l-5-3v-4Z" />
				</svg>
			)
		case 'archive':
			return (
				<svg {...common}>
					<path d="M7 4h10v16H7z" />
					<path d="M10 4v2M14 4v2M10 8v2M14 8v2M10 12h4" />
				</svg>
			)
		case 'code':
			return (
				<svg {...common}>
					<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" />
				</svg>
			)
		case 'text':
			return (
				<svg {...common}>
					<path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
					<path d="M14 4v5h5M9 13h6M9 17h4" />
				</svg>
			)
		default:
			return (
				<svg {...common}>
					<path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
					<path d="M14 4v5h5" />
				</svg>
			)
	}
}
