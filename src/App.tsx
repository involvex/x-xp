import {useEffect, useState} from 'react'
// import reactLogo from "./assets/react.svg";
import {invoke} from '@tauri-apps/api/core'
import './App.css'
// import { ReloadOptions, Store, getStore } from '@tauri-apps/plugin-store'

interface FileEntry {
	name: string
	path: string
	is_dir: boolean
	size: number
}

// function load_store() {
//   const last_path = getStore('~/.x-xp/')
//   console.log(last_path)
// }
// load_store()

export default function App() {
	const [currentPath, setCurrentPath] = useState<string>('/')
	const [files, setFiles] = useState<FileEntry[]>([])

	const loadDir = async (path: string) => {
		try {
			const res = await invoke<FileEntry[]>('read_dir', {path})
			setFiles(res)
			setCurrentPath(path)
		} catch (err: unknown) {
			console.error('Fehler beim Lesen:', err)
		}
	}

	useEffect(() => {
		loadDir(currentPath || '/') // Startet im Home-Verzeichnis
	}, [])

	return (
		<div className="bg-[#050505] text-[#00ff66] min-h-screen p-6 font-mono selection:bg-[#00ff66]/30">
			<div className="flex justify-between items-center mb-4">
				<div className="flex justify-between items-center">
					<input
						type="text"
						className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20"
						value={currentPath}
						onChange={e => setCurrentPath(e.target.value)}
					/>
					<button
						className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20"
						onClick={() => loadDir(currentPath)}
					>
						Go
					</button>
				</div>
			</div>
			{/* <header className="mb-4 text-sm opacity-80 border-b border-[#00ff66]/20 pb-2">
				PFAD: {currentPath || 'Home'}
			</header> */}
			<div className="flex justify-between items-center mb-4">
				<button className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20">
					Home
				</button>
				<button className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20">
					Back
				</button>
				<button className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20">
					Home
				</button>
				<button className="bg-[#00ff66]/10 px-3 py-2 rounded hover:bg-[#00ff66]/20">
					Forward
				</button>
			</div>
			<div className="grid grid-cols-1 gap-1">
				{files.map(file => (
					<div
						key={file.path}
						onDoubleClick={() => file.is_dir && loadDir(file.path)}
						className="px-3 py-2 hover:bg-[#00ff66]/10 cursor-pointer flex justify-between items-center rounded transition-colors"
					>
						<span
							className={
								file.is_dir ? 'font-bold text-white' : 'text-[#00ff66]/80'
							}
						>
							{file.is_dir ? '📁' : '📄'} {file.name}
						</span>
						<span className="text-xs opacity-50">
							{file.is_dir ? '' : `${Math.round(file.size / 1024)} KB`}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

// export default App;
