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

/// Strip Windows `\\?\` / `\\?\UNC\` prefixes from canonicalized paths.
pub fn normalize_path_display(path: PathBuf) -> String {
	let s = path.to_string_lossy();
	let trimmed = s
		.strip_prefix(r"\\?\UNC\")
		.map(|rest| format!(r"\\{rest}"))
		.or_else(|| s.strip_prefix(r"\\?\").map(|rest| rest.to_string()))
		.unwrap_or_else(|| s.into_owned());
	trimmed
}

/// Resolve relative paths (`.`, `..`, `foo`) against `cwd` or process CWD, then canonicalize.
pub fn resolve_existing_path(candidate: &str, cwd: Option<&str>) -> Option<PathBuf> {
	let raw = PathBuf::from(candidate);
	let absolute = if raw.is_absolute() {
		raw
	} else {
		let base = cwd
			.map(PathBuf::from)
			.or_else(|| std::env::current_dir().ok())?;
		base.join(raw)
	};
	absolute.canonicalize().ok()
}

#[tauri::command]
pub async fn resolve_path(path: String) -> Result<FileEntry, String> {
	let p = resolve_existing_path(&path, None)
		.ok_or_else(|| format!("Path does not exist: {path}"))?;
	let metadata = std::fs::metadata(&p).map_err(|e| e.to_string())?;
	let display = normalize_path_display(p.clone());
	let name = p
		.file_name()
		.map(|n| n.to_string_lossy().into_owned())
		.unwrap_or_else(|| display.clone());
	Ok(FileEntry {
		name,
		path: display,
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

/// Parse CLI args: first non-flag arg that is an existing path.
/// Relative args (`.`, `..`) are resolved against `cwd` (or process CWD) to an absolute path.
pub fn parse_startup_path(args: &[String]) -> Option<String> {
	parse_startup_path_with_cwd(args, None)
}

pub fn parse_startup_path_with_cwd(args: &[String], cwd: Option<&str>) -> Option<String> {
	args.iter()
		.skip(1)
		.find(|a| !a.starts_with('-'))
		.and_then(|candidate| {
			let path = resolve_existing_path(candidate, cwd)?;
			if path.is_dir() {
				Some(normalize_path_display(path))
			} else if path.is_file() {
				path.parent()
					.map(|p| normalize_path_display(p.to_path_buf()))
			} else {
				None
			}
		})
}
