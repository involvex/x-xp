use chrono::{DateTime, Local};
use fs_extra::dir::{
	copy_with_progress as copy_dir_with_progress, CopyOptions as DirCopyOptions,
	TransitProcessResult,
};
use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime};
use tauri::{AppHandle, Emitter, State};
use walkdir::WalkDir;

use super::transfer::{emit_progress, TransferProgress, TransferState};

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

fn transfer_job_id(job_id: Option<String>) -> String {
	job_id
		.filter(|s| !s.is_empty())
		.unwrap_or_else(|| format!("job-{}", uuid_lite()))
}

fn uuid_lite() -> String {
	use std::time::{SystemTime, UNIX_EPOCH};
	let nanos = SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map(|d| d.as_nanos())
		.unwrap_or(0);
	format!("{nanos:x}")
}

fn check_cancelled(flag: &AtomicBool) -> Result<(), String> {
	if flag.load(Ordering::SeqCst) {
		Err("Transfer cancelled".into())
	} else {
		Ok(())
	}
}

fn should_emit(last: &Mutex<Option<Instant>>) -> bool {
	let Ok(mut guard) = last.lock() else {
		return true;
	};
	let now = Instant::now();
	match *guard {
		Some(prev) if now.duration_since(prev) < std::time::Duration::from_millis(50) => false,
		_ => {
			*guard = Some(now);
			true
		}
	}
}

fn copy_file_cancellable(
	app: &AppHandle,
	job_id: &str,
	mode: &str,
	src_path: &Path,
	target: &Path,
	name: &str,
	index: u64,
	total: u64,
	cancelled: &AtomicBool,
) -> Result<(), String> {
	let meta = fs::metadata(src_path).map_err(|e| e.to_string())?;
	let total_bytes = meta.len();
	let mut reader = fs::File::open(src_path).map_err(|e| e.to_string())?;
	let mut writer = fs::File::create(target).map_err(|e| e.to_string())?;
	let mut buf = vec![0u8; 64 * 1024];
	let mut done: u64 = 0;
	let last = Mutex::new(None::<Instant>);
	loop {
		check_cancelled(cancelled)?;
		let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
		if n == 0 {
			break;
		}
		writer.write_all(&buf[..n]).map_err(|e| e.to_string())?;
		done += n as u64;
		if should_emit(&last) {
			let _ = app.emit(
				"transfer-progress",
				TransferProgress {
					job_id: job_id.to_string(),
					mode: mode.to_string(),
					index,
					total,
					name: name.to_string(),
					bytes_done: done,
					bytes_total: total_bytes,
					phase: "running".into(),
					message: None,
				},
			);
		}
	}
	writer.flush().map_err(|e| e.to_string())?;
	let _ = fs::set_permissions(target, meta.permissions());
	Ok(())
}

fn copy_path_with_progress(
	app: &AppHandle,
	state: &TransferState,
	job_id: &str,
	mode: &str,
	src_path: &Path,
	target: &Path,
	name: &str,
	index: u64,
	total: u64,
	cancelled: &Arc<AtomicBool>,
) -> Result<(), String> {
	check_cancelled(cancelled)?;
	emit_progress(
		app,
		state,
		TransferProgress {
			job_id: job_id.to_string(),
			mode: mode.to_string(),
			index,
			total,
			name: name.to_string(),
			bytes_done: 0,
			bytes_total: 0,
			phase: "running".into(),
			message: None,
		},
	);

	if src_path.is_dir() {
		let mut opts = DirCopyOptions::new();
		opts.copy_inside = true;
		opts.buffer_size = 64 * 1024;
		let app2 = app.clone();
		let job = job_id.to_string();
		let mode_s = mode.to_string();
		let fallback_name = name.to_string();
		let flag = cancelled.clone();
		let last = Mutex::new(None::<Instant>);

		let copy_result = copy_dir_with_progress(src_path, target, &opts, |proc| {
			if flag.load(Ordering::SeqCst) {
				return TransitProcessResult::Abort;
			}
			if should_emit(&last) {
				let file_name = if proc.file_name.is_empty() {
					fallback_name.clone()
				} else {
					proc.file_name.clone()
				};
				let _ = app2.emit(
					"transfer-progress",
					TransferProgress {
						job_id: job.clone(),
						mode: mode_s.clone(),
						index,
						total,
						name: file_name,
						bytes_done: proc.copied_bytes,
						bytes_total: proc.total_bytes,
						phase: "running".into(),
						message: None,
					},
				);
			}
			TransitProcessResult::ContinueOrAbort
		});

		if flag.load(Ordering::SeqCst) {
			let _ = fs::remove_dir_all(target);
			return Err("Transfer cancelled".into());
		}
		copy_result.map_err(|e| e.to_string())?;
	} else if let Err(e) = copy_file_cancellable(
		app, job_id, mode, src_path, target, name, index, total, cancelled,
	) {
		let _ = fs::remove_file(target);
		return Err(e);
	}
	check_cancelled(cancelled)
}

#[tauri::command]
pub async fn copy_entries(
	app: AppHandle,
	sources: Vec<String>,
	dest_dir: String,
	job_id: Option<String>,
	state: State<'_, TransferState>,
) -> Result<Vec<FileEntry>, String> {
	let dest = PathBuf::from(&dest_dir);
	if !dest.is_dir() {
		return Err("Destination is not a directory".into());
	}
	let job_id = transfer_job_id(job_id);
	let cancelled = state.register(&job_id);
	let total = sources.len() as u64;
	let mode = "copy";

	let result: Result<Vec<FileEntry>, String> = (|| {
		let mut results = Vec::new();
		for (i, src) in sources.into_iter().enumerate() {
			check_cancelled(&cancelled)?;
			let src_path = PathBuf::from(&src);
			let name = src_path
				.file_name()
				.ok_or_else(|| format!("Invalid source: {src}"))?
				.to_string_lossy()
				.into_owned();
			let target = unique_dest(&dest, &name);
			let index = (i as u64) + 1;
			copy_path_with_progress(
				&app, &state, &job_id, mode, &src_path, &target, &name, index, total, &cancelled,
			)?;
			results.push(entry_from_path(&target)?);
		}
		emit_progress(
			&app,
			&state,
			TransferProgress {
				job_id: job_id.clone(),
				mode: mode.into(),
				index: total,
				total,
				name: String::new(),
				bytes_done: 1,
				bytes_total: 1,
				phase: "done".into(),
				message: None,
			},
		);
		Ok(results)
	})();

	if let Err(ref e) = result {
		let phase = if e.contains("cancelled") {
			"cancelled"
		} else {
			"error"
		};
		emit_progress(
			&app,
			&state,
			TransferProgress {
				job_id: job_id.clone(),
				mode: mode.into(),
				index: 0,
				total,
				name: String::new(),
				bytes_done: 0,
				bytes_total: 0,
				phase: phase.into(),
				message: Some(e.clone()),
			},
		);
	}
	state.unregister(&job_id);
	result
}

#[tauri::command]
pub async fn move_entries(
	app: AppHandle,
	sources: Vec<String>,
	dest_dir: String,
	job_id: Option<String>,
	state: State<'_, TransferState>,
) -> Result<Vec<FileEntry>, String> {
	let dest = PathBuf::from(&dest_dir);
	if !dest.is_dir() {
		return Err("Destination is not a directory".into());
	}
	let job_id = transfer_job_id(job_id);
	let cancelled = state.register(&job_id);
	let total = sources.len() as u64;
	let mode = "move";

	let result: Result<Vec<FileEntry>, String> = (|| {
		let mut results = Vec::new();
		for (i, src) in sources.into_iter().enumerate() {
			check_cancelled(&cancelled)?;
			let src_path = PathBuf::from(&src);
			let name = src_path
				.file_name()
				.ok_or_else(|| format!("Invalid source: {src}"))?
				.to_string_lossy()
				.into_owned();
			let target = unique_dest(&dest, &name);
			let index = (i as u64) + 1;

			emit_progress(
				&app,
				&state,
				TransferProgress {
					job_id: job_id.clone(),
					mode: mode.into(),
					index,
					total,
					name: name.clone(),
					bytes_done: 0,
					bytes_total: 0,
					phase: "running".into(),
					message: None,
				},
			);

			let renamed = fs::rename(&src_path, &target).is_ok();
			if !renamed {
				copy_path_with_progress(
					&app, &state, &job_id, mode, &src_path, &target, &name, index, total,
					&cancelled,
				)?;
				if src_path.is_dir() {
					fs::remove_dir_all(&src_path).map_err(|e| e.to_string())?;
				} else {
					fs::remove_file(&src_path).map_err(|e| e.to_string())?;
				}
			} else {
				emit_progress(
					&app,
					&state,
					TransferProgress {
						job_id: job_id.clone(),
						mode: mode.into(),
						index,
						total,
						name: name.clone(),
						bytes_done: 1,
						bytes_total: 1,
						phase: "running".into(),
						message: None,
					},
				);
			}
			results.push(entry_from_path(&target)?);
		}
		emit_progress(
			&app,
			&state,
			TransferProgress {
				job_id: job_id.clone(),
				mode: mode.into(),
				index: total,
				total,
				name: String::new(),
				bytes_done: 1,
				bytes_total: 1,
				phase: "done".into(),
				message: None,
			},
		);
		Ok(results)
	})();

	if let Err(ref e) = result {
		let phase = if e.contains("cancelled") {
			"cancelled"
		} else {
			"error"
		};
		emit_progress(
			&app,
			&state,
			TransferProgress {
				job_id: job_id.clone(),
				mode: mode.into(),
				index: 0,
				total,
				name: String::new(),
				bytes_done: 0,
				bytes_total: 0,
				phase: phase.into(),
				message: Some(e.clone()),
			},
		);
	}
	state.unregister(&job_id);
	result
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
	open::that(path).map_err(|e| e.to_string())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntryProperties {
	pub name: String,
	pub path: String,
	pub location: String,
	pub is_dir: bool,
	pub kind: String,
	pub extension: String,
	pub size: u64,
	pub size_on_disk: u64,
	pub file_count: u64,
	pub folder_count: u64,
	pub created: Option<i64>,
	pub modified: Option<i64>,
	pub readonly: bool,
	pub hidden: bool,
}

fn folder_aggregate(path: &Path) -> (u64, u64, u64) {
	let mut size = 0u64;
	let mut files = 0u64;
	let mut folders = 0u64;
	for entry in WalkDir::new(path)
		.follow_links(false)
		.into_iter()
		.filter_map(|e| e.ok())
	{
		let p = entry.path();
		if p == path {
			continue;
		}
		if entry.file_type().is_dir() {
			folders += 1;
		} else if entry.file_type().is_file() {
			files += 1;
			if let Ok(meta) = entry.metadata() {
				size += meta.len();
			}
		}
	}
	(size, files, folders)
}

#[tauri::command]
pub async fn get_entry_properties(path: String) -> Result<EntryProperties, String> {
	tauri::async_runtime::spawn_blocking(move || {
		let p = PathBuf::from(&path);
		if !p.exists() {
			return Err(format!("Path does not exist: {path}"));
		}
		let metadata = fs::metadata(&p).map_err(|e| e.to_string())?;
		let name = p
			.file_name()
			.map(|n| n.to_string_lossy().into_owned())
			.unwrap_or_else(|| p.to_string_lossy().into_owned());
		let location = p
			.parent()
			.map(|parent| parent.to_string_lossy().into_owned())
			.unwrap_or_default();
		let extension = p
			.extension()
			.map(|e| e.to_string_lossy().into_owned())
			.unwrap_or_default();
		let created = metadata.created().ok().and_then(system_time_to_millis);
		let modified = metadata.modified().ok().and_then(system_time_to_millis);
		let readonly = metadata.permissions().readonly();
		let hidden = is_hidden(&p, &name);
		let is_dir = metadata.is_dir();

		let (size, size_on_disk, file_count, folder_count, kind) = if is_dir {
			let (s, files, folders) = folder_aggregate(&p);
			(s, s, files, folders, "File folder".to_string())
		} else {
			let len = metadata.len();
			let kind = if extension.is_empty() {
				"File".to_string()
			} else {
				format!("{} File", extension.to_uppercase())
			};
			(len, len, 0, 0, kind)
		};

		Ok(EntryProperties {
			name,
			path: p.to_string_lossy().into_owned(),
			location,
			is_dir,
			kind,
			extension,
			size,
			size_on_disk,
			file_count,
			folder_count,
			created,
			modified,
			readonly,
			hidden,
		})
	})
	.await
	.map_err(|e| e.to_string())?
}

/// Launch `program` with `args`. Use `{path}` placeholder; if missing, path is appended.
#[tauri::command]
pub async fn open_with(path: String, program: String, args: Vec<String>) -> Result<(), String> {
	tauri::async_runtime::spawn_blocking(move || {
		let mut cmd = Command::new(&program);
		let mut replaced = false;
		for a in &args {
			if a.contains("{path}") {
				replaced = true;
				cmd.arg(a.replace("{path}", &path));
			} else {
				cmd.arg(a);
			}
		}
		if !replaced {
			cmd.arg(&path);
		}
		#[cfg(windows)]
		{
			use std::os::windows::process::CommandExt;
			const CREATE_NO_WINDOW: u32 = 0x0800_0000;
			// Keep console apps visible when opening terminals; only hide for GUI-ish launches
			if !program.to_lowercase().contains("cmd")
				&& !program.to_lowercase().contains("powershell")
				&& !program.to_lowercase().contains("wt")
				&& !program.to_lowercase().contains("terminal")
			{
				cmd.creation_flags(CREATE_NO_WINDOW);
			}
		}
		cmd.spawn()
			.map_err(|e| format!("Failed to launch {program}: {e}"))?;
		Ok(())
	})
	.await
	.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_in_new_window(path: String) -> Result<(), String> {
	tauri::async_runtime::spawn_blocking(move || {
		let exe = std::env::current_exe().map_err(|e| e.to_string())?;
		Command::new(exe)
			.arg(&path)
			.spawn()
			.map_err(|e| e.to_string())?;
		Ok(())
	})
	.await
	.map_err(|e| e.to_string())?
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

/// Recursively sum file sizes under a folder (or return file length).
#[tauri::command]
pub async fn get_folder_size(path: String) -> Result<u64, String> {
	tauri::async_runtime::spawn_blocking(move || {
		let p = PathBuf::from(&path);
		if !p.exists() {
			return Err(format!("Path does not exist: {path}"));
		}
		let metadata = fs::metadata(&p).map_err(|e| e.to_string())?;
		if metadata.is_file() {
			return Ok(metadata.len());
		}
		if !metadata.is_dir() {
			return Err(format!("Not a directory: {path}"));
		}
		let (size, _, _) = folder_aggregate(&p);
		Ok(size)
	})
	.await
	.map_err(|e| e.to_string())?
}
