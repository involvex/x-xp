use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocksmithProcess {
	pub pid: u32,
	pub name: String,
	#[serde(default)]
	pub user: String,
	#[serde(default)]
	pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocksmithResult {
	#[serde(default)]
	pub processes: Vec<LocksmithProcess>,
}

fn local_app_data() -> PathBuf {
	std::env::var_os("LOCALAPPDATA")
		.map(PathBuf::from)
		.unwrap_or_else(|| PathBuf::from(r"C:\Users\Public"))
}

fn default_locksmith_exe() -> PathBuf {
	local_app_data().join(r"PowerToys\FileLocksmithCLI.exe")
}

fn default_peek_exe() -> PathBuf {
	local_app_data().join(r"PowerToys\WinUI3Apps\PowerToys.Peek.UI.exe")
}

fn resolve_exe(override_path: Option<String>, default: PathBuf) -> Result<PathBuf, String> {
	let path = override_path
		.filter(|s| !s.trim().is_empty())
		.map(PathBuf::from)
		.unwrap_or(default);
	if !path.is_file() {
		return Err(format!("Tool not found: {}", path.display()));
	}
	Ok(path)
}

fn run_locksmith(
	exe: &Path,
	paths: &[String],
	kill: bool,
) -> Result<LocksmithResult, String> {
	let mut cmd = Command::new(exe);
	cmd.arg("--json");
	if kill {
		cmd.arg("--kill");
	}
	for p in paths {
		cmd.arg(p);
	}
	#[cfg(windows)]
	{
		use std::os::windows::process::CommandExt;
		const CREATE_NO_WINDOW: u32 = 0x0800_0000;
		cmd.creation_flags(CREATE_NO_WINDOW);
	}
	let output = cmd
		.output()
		.map_err(|e| format!("Failed to run FileLocksmithCLI: {e}"))?;
	let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
	let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
	if !output.status.success() && stdout.is_empty() {
		return Err(if stderr.is_empty() {
			format!("FileLocksmithCLI exited with {}", output.status)
		} else {
			stderr
		});
	}
	if stdout.is_empty() {
		return Ok(LocksmithResult {
			processes: Vec::new(),
		});
	}
	serde_json::from_str(&stdout).map_err(|e| {
		format!("Invalid FileLocksmithCLI JSON: {e}\nstdout: {stdout}\nstderr: {stderr}")
	})
}

#[tauri::command]
pub async fn file_locksmith_query(
	paths: Vec<String>,
	kill: bool,
	exe: Option<String>,
) -> Result<LocksmithResult, String> {
	if paths.is_empty() {
		return Err("No paths specified".into());
	}
	let exe_path = resolve_exe(exe, default_locksmith_exe())?;
	tauri::async_runtime::spawn_blocking(move || run_locksmith(&exe_path, &paths, kill))
		.await
		.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn open_peek(path: String, exe: Option<String>) -> Result<(), String> {
	let exe_path = resolve_exe(exe, default_peek_exe())?;
	let target = path.clone();
	tauri::async_runtime::spawn_blocking(move || {
		let mut cmd = Command::new(&exe_path);
		cmd.arg(&target);
		#[cfg(windows)]
		{
			use std::os::windows::process::CommandExt;
			const CREATE_NO_WINDOW: u32 = 0x0800_0000;
			cmd.creation_flags(CREATE_NO_WINDOW);
		}
		cmd.spawn()
			.map(|_| ())
			.map_err(|e| format!("Failed to launch Peek: {e}"))
	})
	.await
	.map_err(|e| e.to_string())?
}

fn terminal_candidates(override_path: Option<String>) -> Vec<PathBuf> {
	let mut out = Vec::new();
	if let Some(p) = override_path.filter(|s| !s.trim().is_empty()) {
		out.push(PathBuf::from(p));
	}
	let local = local_app_data();
	out.push(local.join(r"involvex-term\involvex-term.exe"));
	out.push(local.join(r"Programs\involvex-term\involvex-term.exe"));
	if let Some(user) = std::env::var_os("USERPROFILE") {
		let home = PathBuf::from(user);
		out.push(home.join(r"AppData\Local\involvex-term\involvex-term.exe"));
	}
	for drive in [r"I:\repos\involvex\involvex-term", r"C:\repos\involvex\involvex-term"] {
		out.push(PathBuf::from(drive).join(r"target\release\involvex-term.exe"));
		out.push(PathBuf::from(drive).join(r"dist\involvex-term.exe"));
		out.push(PathBuf::from(drive).join("involvex-term.exe"));
	}
	out.push(PathBuf::from("wt.exe"));
	out
}

#[tauri::command]
pub async fn open_terminal(path: String, exe: Option<String>) -> Result<(), String> {
	let dir = PathBuf::from(&path);
	if !dir.is_dir() {
		return Err(format!("Not a directory: {path}"));
	}
	tauri::async_runtime::spawn_blocking(move || {
		let candidates = terminal_candidates(exe);
		let mut last_err = String::from("No terminal executable found");
		for candidate in candidates {
			if candidate.file_name().and_then(|n| n.to_str()) == Some("wt.exe") {
				let mut cmd = Command::new(&candidate);
				cmd.args(["-d", &path]);
				match cmd.spawn() {
					Ok(_) => return Ok(()),
					Err(e) => {
						last_err = format!("wt.exe: {e}");
						continue;
					}
				}
			}
			if !candidate.is_file() {
				continue;
			}
			let mut cmd = Command::new(&candidate);
			cmd.current_dir(&dir);
			cmd.arg(&path);
			match cmd.spawn() {
				Ok(_) => return Ok(()),
				Err(e) => {
					last_err = format!("{}: {e}", candidate.display());
				}
			}
		}
		Err(last_err)
	})
	.await
	.map_err(|e| e.to_string())?
}
