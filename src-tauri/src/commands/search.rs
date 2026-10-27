use serde::Serialize;
use std::path::PathBuf;
use walkdir::WalkDir;

use super::fs::FileEntry;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
	pub entries: Vec<FileEntry>,
	pub truncated: bool,
}

#[tauri::command]
pub async fn search_by_name(
	root: String,
	query: String,
	max_results: Option<usize>,
) -> Result<SearchResult, String> {
	let limit = max_results.unwrap_or(200);
	let q = query.to_lowercase();
	if q.is_empty() {
		return Ok(SearchResult {
			entries: vec![],
			truncated: false,
		});
	}

	let root_path = PathBuf::from(&root);
	if !root_path.is_dir() {
		return Err("Search root is not a directory".into());
	}

	let mut entries = Vec::new();
	let mut truncated = false;

	for entry in WalkDir::new(&root_path)
		.follow_links(false)
		.into_iter()
		.filter_map(|e| e.ok())
	{
		if entries.len() >= limit {
			truncated = true;
			break;
		}
		let name = entry.file_name().to_string_lossy().to_lowercase();
		if !name.contains(&q) {
			continue;
		}
		let path = entry.path();
		let meta = match entry.metadata() {
			Ok(m) => m,
			Err(_) => continue,
		};
		entries.push(FileEntry {
			name: entry.file_name().to_string_lossy().into_owned(),
			path: path.to_string_lossy().into_owned(),
			is_dir: meta.is_dir(),
			size: if meta.is_dir() { 0 } else { meta.len() },
			extension: path
				.extension()
				.map(|e| e.to_string_lossy().into_owned())
				.unwrap_or_default(),
			modified: None,
			readonly: meta.permissions().readonly(),
			hidden: false,
		});
	}

	Ok(SearchResult {
		entries,
		truncated,
	})
}
