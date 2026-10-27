use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

const DEBOUNCE_MS: u64 = 300;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangedPayload {
	pub path: String,
}

struct WatchSlot {
	_watcher: RecommendedWatcher,
	refs: usize,
}

pub struct WatchState {
	watches: Mutex<HashMap<String, WatchSlot>>,
	/// Debounce map: key → last event Instant
	pending: Arc<Mutex<HashMap<String, Instant>>>,
}

impl Default for WatchState {
	fn default() -> Self {
		Self {
			watches: Mutex::new(HashMap::new()),
			pending: Arc::new(Mutex::new(HashMap::new())),
		}
	}
}

fn is_virtual_path(path: &str) -> bool {
	let lower = path.to_ascii_lowercase();
	lower.starts_with("home:") || lower.starts_with("recycle:")
}

fn normalize_key(path: &str) -> String {
	path.trim_end_matches(['\\', '/'])
		.replace('/', "\\")
		.to_ascii_lowercase()
}

fn schedule_emit(app: AppHandle, emit_path: String, pending: Arc<Mutex<HashMap<String, Instant>>>) {
	let key = normalize_key(&emit_path);
	{
		let Ok(mut map) = pending.lock() else {
			return;
		};
		map.insert(key.clone(), Instant::now());
	}
	let pending2 = pending.clone();
	thread::spawn(move || {
		thread::sleep(Duration::from_millis(DEBOUNCE_MS));
		let should_emit = {
			let Ok(mut map) = pending2.lock() else {
				return;
			};
			match map.get(&key) {
				Some(t) if t.elapsed() >= Duration::from_millis(DEBOUNCE_MS.saturating_sub(20)) => {
					map.remove(&key);
					true
				}
				_ => false,
			}
		};
		if should_emit {
			let _ = app.emit(
				"fs-changed",
				FsChangedPayload {
					path: emit_path,
				},
			);
		}
	});
}

#[tauri::command]
pub async fn watch_dir(
	app: AppHandle,
	path: String,
	state: State<'_, WatchState>,
) -> Result<(), String> {
	if path.is_empty() || is_virtual_path(&path) {
		return Err("cannot watch virtual or empty path".into());
	}
	let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
	if !meta.is_dir() {
		return Err("path is not a directory".into());
	}

	let key = normalize_key(&path);
	let mut watches = state.watches.lock().map_err(|e| e.to_string())?;
	if let Some(slot) = watches.get_mut(&key) {
		slot.refs += 1;
		return Ok(());
	}

	let emit_path = path.trim_end_matches(['\\', '/']).to_string();
	let app_handle = app.clone();
	let pending = state.pending.clone();
	let emit_for_cb = emit_path;

	let mut watcher = RecommendedWatcher::new(
		move |res: Result<Event, notify::Error>| {
			if res.is_ok() {
				schedule_emit(app_handle.clone(), emit_for_cb.clone(), pending.clone());
			}
		},
		notify::Config::default(),
	)
	.map_err(|e| e.to_string())?;

	watcher
		.watch(Path::new(&path), RecursiveMode::NonRecursive)
		.map_err(|e| e.to_string())?;

	watches.insert(
		key,
		WatchSlot {
			_watcher: watcher,
			refs: 1,
		},
	);
	Ok(())
}

#[tauri::command]
pub async fn unwatch_dir(path: String, state: State<'_, WatchState>) -> Result<(), String> {
	if path.is_empty() || is_virtual_path(&path) {
		return Ok(());
	}
	let key = normalize_key(&path);
	let mut watches = state.watches.lock().map_err(|e| e.to_string())?;
	let remove = if let Some(slot) = watches.get_mut(&key) {
		if slot.refs > 1 {
			slot.refs -= 1;
			false
		} else {
			true
		}
	} else {
		false
	};
	if remove {
		watches.remove(&key);
	}
	Ok(())
}
