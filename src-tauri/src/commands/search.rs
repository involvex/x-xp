use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;
use walkdir::WalkDir;

use super::fs::FileEntry;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
	pub entries: Vec<FileEntry>,
	pub truncated: bool,
	pub cancelled: bool,
}

pub struct SearchState {
	jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for SearchState {
	fn default() -> Self {
		Self {
			jobs: Mutex::new(HashMap::new()),
		}
	}
}

impl SearchState {
	fn register(&self, job_id: &str) -> Arc<AtomicBool> {
		let flag = Arc::new(AtomicBool::new(false));
		if let Ok(mut jobs) = self.jobs.lock() {
			jobs.insert(job_id.to_string(), flag.clone());
		}
		flag
	}

	fn unregister(&self, job_id: &str) {
		if let Ok(mut jobs) = self.jobs.lock() {
			jobs.remove(job_id);
		}
	}
}

fn job_id_or_new(job_id: Option<String>) -> String {
	job_id
		.filter(|s| !s.is_empty())
		.unwrap_or_else(|| {
			use std::time::{SystemTime, UNIX_EPOCH};
			let nanos = SystemTime::now()
				.duration_since(UNIX_EPOCH)
				.map(|d| d.as_nanos())
				.unwrap_or(0);
			format!("search-{nanos:x}")
		})
}

#[tauri::command]
pub async fn search_by_name(
	root: String,
	query: String,
	max_results: Option<usize>,
	job_id: Option<String>,
	state: State<'_, SearchState>,
) -> Result<SearchResult, String> {
	let limit = max_results.unwrap_or(200);
	let q = query.to_lowercase();
	if q.is_empty() {
		return Ok(SearchResult {
			entries: vec![],
			truncated: false,
			cancelled: false,
		});
	}

	let root_path = PathBuf::from(&root);
	if !root_path.is_dir() {
		return Err("Search root is not a directory".into());
	}

	let job_id = job_id_or_new(job_id);
	let cancelled = state.register(&job_id);

	let mut entries = Vec::new();
	let mut truncated = false;
	let mut was_cancelled = false;

	for entry in WalkDir::new(&root_path)
		.follow_links(false)
		.into_iter()
		.filter_map(|e| e.ok())
	{
		if cancelled.load(Ordering::SeqCst) {
			was_cancelled = true;
			break;
		}
		if entries.len() >= limit {
			truncated = true;
			break;
		}
		let name = entry.file_name().to_string_lossy().to_lowercase();
		if !name.contains(&q) {
			continue;
		}
		let path = entry.path();
		// Skip the search root itself
		if path == root_path {
			continue;
		}
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

	state.unregister(&job_id);

	Ok(SearchResult {
		entries,
		truncated,
		cancelled: was_cancelled,
	})
}

#[tauri::command]
pub async fn cancel_search(
	job_id: String,
	state: State<'_, SearchState>,
) -> Result<(), String> {
	if let Ok(jobs) = state.jobs.lock() {
		if let Some(flag) = jobs.get(&job_id) {
			flag.store(true, Ordering::SeqCst);
		}
	}
	Ok(())
}
