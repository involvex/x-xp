use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
	pub job_id: String,
	pub mode: String,
	pub index: u64,
	pub total: u64,
	pub name: String,
	pub bytes_done: u64,
	pub bytes_total: u64,
	pub phase: String,
	pub message: Option<String>,
}

pub struct TransferState {
	jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
	last_emit: Mutex<HashMap<String, Instant>>,
}

impl Default for TransferState {
	fn default() -> Self {
		Self {
			jobs: Mutex::new(HashMap::new()),
			last_emit: Mutex::new(HashMap::new()),
		}
	}
}

impl TransferState {
	pub fn register(&self, job_id: &str) -> Arc<AtomicBool> {
		let flag = Arc::new(AtomicBool::new(false));
		if let Ok(mut jobs) = self.jobs.lock() {
			jobs.insert(job_id.to_string(), flag.clone());
		}
		flag
	}

	pub fn unregister(&self, job_id: &str) {
		if let Ok(mut jobs) = self.jobs.lock() {
			jobs.remove(job_id);
		}
		if let Ok(mut last) = self.last_emit.lock() {
			last.remove(job_id);
		}
	}
}

pub fn emit_progress(app: &AppHandle, state: &TransferState, progress: TransferProgress) {
	let force = progress.phase != "running";
	if !force {
		if let Ok(mut last) = state.last_emit.lock() {
			let now = Instant::now();
			if let Some(prev) = last.get(&progress.job_id) {
				if now.duration_since(*prev) < Duration::from_millis(50) {
					return;
				}
			}
			last.insert(progress.job_id.clone(), now);
		}
	}
	let _ = app.emit("transfer-progress", progress);
}

#[tauri::command]
pub async fn cancel_transfer(
	job_id: String,
	state: State<'_, TransferState>,
) -> Result<(), String> {
	if let Ok(jobs) = state.jobs.lock() {
		if let Some(flag) = jobs.get(&job_id) {
			flag.store(true, Ordering::SeqCst);
		}
	}
	Ok(())
}
