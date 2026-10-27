use chrono::{DateTime, Local};
use fs_extra::dir::{copy as copy_dir, CopyOptions as DirCopyOptions};
use fs_extra::file::{copy as copy_file, CopyOptions as FileCopyOptions};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
	pub name: String,
	pub path: String,
	pub is_dir: bool,
	pub size: u64,
	pub extension: String,
	pub modified: Option<i64>,
	pub readonly: bool,
	pub hidden: bool,
}

fn system_time_to_millis(time: SystemTime) -> Option<i64> {
	time.duration_since(SystemTime::UNIX_EPOCH)
		.ok()
		.map(|d| d.as_millis() as i64)
}

fn is_hidden(path: &Path, name: &str) -> bool {
	if name.starts_with('.') {
		return true;
	}
	#[cfg(windows)]
	{
		use std::os::windows::fs::MetadataExt;
		const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
		if let Ok(meta) = fs::metadata(path) {
			return meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0;
		}
	}
	#[cfg(not(windows))]
	{
		let _ = path;
	}
	false
}

fn entry_from_path(path: &Path) -> Result<FileEntry, String> {
	let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
	let name = path
		.file_name()
		.map(|n| n.to_string_lossy().into_owned())
		.unwrap_or_else(|| path.to_string_lossy().into_owned());
	let extension = path
		.extension()
		.map(|e| e.to_string_lossy().into_owned())
		.unwrap_or_default();
	let modified = metadata.modified().ok().and_then(system_time_to_millis);
	let readonly = metadata.permissions().readonly();
	let hidden = is_hidden(path, &name);
	Ok(FileEntry {
		name,
		path: path.to_string_lossy().into_owned(),
		is_dir: metadata.is_dir(),
		size: if metadata.is_dir() {
			0
		} else {
			metadata.len()
		},
		extension,
		modified,
		readonly,
		hidden,
	})
}

#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
	let target_path = if path.is_empty() {
		dirs::home_dir().ok_or_else(|| "Home directory not found".to_string())?
	} else {
		PathBuf::from(&path)
	};

	if !target_path.exists() {
		return Err(format!("Path does not exist: {}", target_path.display()));
	}
	if !target_path.is_dir() {
		return Err(format!("Not a directory: {}", target_path.display()));
	}

	let entries = fs::read_dir(&target_path).map_err(|e| e.to_string())?;
	let mut files = Vec::new();

	for entry in entries.flatten() {
		if let Ok(file) = entry_from_path(&entry.path()) {
			files.push(file);
		}
	}

	files.sort_by(|a, b| {
		b.is_dir
			.cmp(&a.is_dir)
			.then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
	});

	Ok(files)
}

#[tauri::command]
pub async fn get_drives() -> Result<Vec<FileEntry>, String> {
	#[cfg(windows)]
	{
		let mut drives = Vec::new();
		for letter in b'A'..=b'Z' {
			let root = format!("{}:\\", letter as char);
			let path = PathBuf::from(&root);
			if path.exists() {
				drives.push(FileEntry {
					name: root.clone(),
					path: root,
					is_dir: true,
					size: 0,
					extension: String::new(),
					modified: None,
					readonly: false,
					hidden: false,
				});
			}
		}
		return Ok(drives);
	}
	#[cfg(not(windows))]
	{
		Ok(vec![FileEntry {
			name: "/".into(),
			path: "/".into(),
			is_dir: true,
			size: 0,
			extension: String::new(),
			modified: None,
			readonly: false,
			hidden: false,
		}])
	}
}

#[tauri::command]
pub async fn create_dir(path: String) -> Result<FileEntry, String> {
	fs::create_dir_all(&path).map_err(|e| e.to_string())?;
	entry_from_path(Path::new(&path))
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<FileEntry, String> {
	if let Some(parent) = Path::new(&path).parent() {
		fs::create_dir_all(parent).map_err(|e| e.to_string())?;
	}
	fs::File::create(&path).map_err(|e| e.to_string())?;
	entry_from_path(Path::new(&path))
}

#[tauri::command]
pub async fn rename_entry(from: String, to: String) -> Result<FileEntry, String> {
	fs::rename(&from, &to).map_err(|e| e.to_string())?;
	entry_from_path(Path::new(&to))
}

#[tauri::command]
pub async fn delete_entries(paths: Vec<String>) -> Result<(), String> {
	let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
	trash::delete_all(&path_bufs).map_err(|e| e.to_string())
}

fn unique_dest(dest_dir: &Path, name: &str) -> PathBuf {
	let mut candidate = dest_dir.join(name);
	if !candidate.exists() {
		return candidate;
	}
	let stem = Path::new(name)
		.file_stem()
		.map(|s| s.to_string_lossy().into_owned())
		.unwrap_or_else(|| name.to_string());
	let ext = Path::new(name)
		.extension()
		.map(|e| format!(".{}", e.to_string_lossy()))
		.unwrap_or_default();
	let mut i = 1;
	loop {
		candidate = dest_dir.join(format!("{stem} ({i}){ext}"));
		if !candidate.exists() {
			return candidate;
		}
		i += 1;
	}
}

#[tauri::command]
pub async fn copy_entries(sources: Vec<String>, dest_dir: String) -> Result<Vec<FileEntry>, String> {
	let dest = PathBuf::from(&dest_dir);
	if !dest.is_dir() {
		return Err("Destination is not a directory".into());
	}
	let mut results = Vec::new();
	for src in sources {
		let src_path = PathBuf::from(&src);
		let name = src_path
			.file_name()
			.ok_or_else(|| format!("Invalid source: {src}"))?
			.to_string_lossy()
			.into_owned();
		let target = unique_dest(&dest, &name);
		if src_path.is_dir() {
			let mut opts = DirCopyOptions::new();
			opts.copy_inside = true;
			copy_dir(&src_path, &target, &opts).map_err(|e| e.to_string())?;
		} else {
			copy_file(&src_path, &target, &FileCopyOptions::new()).map_err(|e| e.to_string())?;
		}
		results.push(entry_from_path(&target)?);
	}
	Ok(results)
}

#[tauri::command]
pub async fn move_entries(sources: Vec<String>, dest_dir: String) -> Result<Vec<FileEntry>, String> {
	let dest = PathBuf::from(&dest_dir);
	if !dest.is_dir() {
		return Err("Destination is not a directory".into());
	}
	let mut results = Vec::new();
	for src in sources {
		let src_path = PathBuf::from(&src);
		let name = src_path
			.file_name()
			.ok_or_else(|| format!("Invalid source: {src}"))?
			.to_string_lossy()
			.into_owned();
		let target = unique_dest(&dest, &name);
		fs::rename(&src_path, &target).or_else(|_| {
			if src_path.is_dir() {
				let mut opts = DirCopyOptions::new();
				opts.copy_inside = true;
				copy_dir(&src_path, &target, &opts).map_err(|e| e.to_string())?;
				fs::remove_dir_all(&src_path).map_err(|e| e.to_string())?;
			} else {
				copy_file(&src_path, &target, &FileCopyOptions::new()).map_err(|e| e.to_string())?;
				fs::remove_file(&src_path).map_err(|e| e.to_string())?;
			}
			Ok::<(), String>(())
		})?;
		results.push(entry_from_path(&target)?);
	}
	Ok(results)
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
	open::that(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_text_preview(path: String, max_bytes: Option<usize>) -> Result<String, String> {
	let limit = max_bytes.unwrap_or(256 * 1024);
	let data = fs::read(&path).map_err(|e| e.to_string())?;
	let slice = if data.len() > limit {
		&data[..limit]
	} else {
		&data
	};
	Ok(String::from_utf8_lossy(slice).into_owned())
}

#[tauri::command]
pub async fn format_modified(ts: Option<i64>) -> Result<String, String> {
	let Some(millis) = ts else {
		return Ok(String::new());
	};
	let secs = millis / 1000;
	let dt = DateTime::from_timestamp(secs, 0)
		.map(|d| d.with_timezone(&Local))
		.ok_or_else(|| "Invalid timestamp".to_string())?;
	Ok(dt.format("%Y-%m-%d %H:%M").to_string())
}
