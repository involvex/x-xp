use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;

use super::fs::FileEntry;

pub struct StartupState {
	pub path: Mutex<Option<String>>,
}

impl StartupState {
	pub fn new(initial: Option<String>) -> Self {
		Self {
			path: Mutex::new(initial),
		}
	}
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KnownFolder {
	pub id: String,
	pub label: String,
	pub path: String,
}

fn folder(id: &str, label: &str, path: Option<PathBuf>) -> Option<KnownFolder> {
	path.filter(|p| p.exists()).map(|p| KnownFolder {
		id: id.into(),
		label: label.into(),
		path: p.to_string_lossy().into_owned(),
	})
}

#[tauri::command]
pub async fn get_home() -> Result<String, String> {
	dirs::home_dir()
		.map(|p| p.to_string_lossy().into_owned())
		.ok_or_else(|| "Home directory not found".into())
}

#[tauri::command]
pub async fn get_known_folders() -> Result<Vec<KnownFolder>, String> {
	let mut folders = Vec::new();
	if let Some(f) = folder("home", "Home", dirs::home_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("desktop", "Desktop", dirs::desktop_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("documents", "Documents", dirs::document_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("downloads", "Downloads", dirs::download_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("pictures", "Pictures", dirs::picture_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("music", "Music", dirs::audio_dir()) {
		folders.push(f);
	}
	if let Some(f) = folder("videos", "Videos", dirs::video_dir()) {
		folders.push(f);
	}
	Ok(folders)
}

#[tauri::command]
pub async fn get_startup_path(
	state: tauri::State<'_, StartupState>,
) -> Result<Option<String>, String> {
	let guard = state.path.lock().map_err(|e| e.to_string())?;
	Ok(guard.clone())
}

#[tauri::command]
pub async fn set_startup_path(
	path: Option<String>,
	state: tauri::State<'_, StartupState>,
) -> Result<(), String> {
	let mut guard = state.path.lock().map_err(|e| e.to_string())?;
	*guard = path;
	Ok(())
}

#[tauri::command]
pub async fn resolve_path(path: String) -> Result<FileEntry, String> {
	let p = PathBuf::from(&path);
	if !p.exists() {
		return Err(format!("Path does not exist: {path}"));
	}
	let metadata = std::fs::metadata(&p).map_err(|e| e.to_string())?;
	let name = p
		.file_name()
		.map(|n| n.to_string_lossy().into_owned())
		.unwrap_or_else(|| p.to_string_lossy().into_owned());
	Ok(FileEntry {
		name,
		path: p.to_string_lossy().into_owned(),
		is_dir: metadata.is_dir(),
		size: if metadata.is_dir() {
			0
		} else {
			metadata.len()
		},
		extension: p
			.extension()
			.map(|e| e.to_string_lossy().into_owned())
			.unwrap_or_default(),
		modified: None,
		readonly: metadata.permissions().readonly(),
		hidden: false,
	})
}

#[tauri::command]
pub async fn parent_path(path: String) -> Result<Option<String>, String> {
	let p = PathBuf::from(&path);
	Ok(p.parent().map(|parent| {
		let s = parent.to_string_lossy().into_owned();
		if s.is_empty() {
			path.clone()
		} else {
			s
		}
	}))
}

/// Parse CLI args: first non-flag arg that is an existing directory.
pub fn parse_startup_path(args: &[String]) -> Option<String> {
	args.iter()
		.skip(1)
		.find(|a| !a.starts_with('-'))
		.and_then(|candidate| {
			let path = PathBuf::from(candidate);
			if path.is_dir() {
				Some(path.to_string_lossy().into_owned())
			} else if path.is_file() {
				path.parent()
					.map(|p| p.to_string_lossy().into_owned())
			} else {
				None
			}
		})
}
