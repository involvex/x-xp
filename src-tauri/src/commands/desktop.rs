use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
	menu::{Menu, MenuItem, PredefinedMenuItem},
	AppHandle, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "main";
const RECENT_CAP: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopPrefsSnapshot {
	pub close_to_tray: bool,
	pub start_minimized: bool,
}

pub struct DesktopState {
	pub close_to_tray: Mutex<bool>,
	pub start_minimized: Mutex<bool>,
	pub recent: Mutex<Vec<String>>,
}

impl Default for DesktopState {
	fn default() -> Self {
		Self {
			close_to_tray: Mutex::new(true),
			start_minimized: Mutex::new(false),
			recent: Mutex::new(Vec::new()),
		}
	}
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
	if let Some(window) = app.get_webview_window("main") {
		let _ = window.show();
		let _ = window.unminimize();
		let _ = window.set_focus();
	}
}

pub fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
	if let Some(window) = app.get_webview_window("main") {
		let visible = window.is_visible().unwrap_or(false);
		let focused = window.is_focused().unwrap_or(false);
		if visible && focused {
			let _ = window.hide();
		} else {
			show_main_window(app);
		}
	}
}

fn recent_label(path: &str) -> String {
	let trimmed = path.trim_end_matches(['\\', '/']);
	trimmed
		.rsplit(['\\', '/'])
		.next()
		.filter(|s| !s.is_empty())
		.unwrap_or(path)
		.to_string()
}

pub fn build_tray_menu<R: Runtime>(
	app: &AppHandle<R>,
	recent: &[String],
) -> Result<Menu<R>, tauri::Error> {
	let menu = Menu::new(app)?;
	menu.append(&MenuItem::with_id(
		app,
		"toggle",
		"Show / Hide",
		true,
		None::<&str>,
	)?)?;
	menu.append(&MenuItem::with_id(
		app,
		"home",
		"Open Home",
		true,
		None::<&str>,
	)?)?;
	menu.append(&PredefinedMenuItem::separator(app)?)?;

	for (i, path) in recent.iter().take(RECENT_CAP).enumerate() {
		let id = format!("recent:{i}");
		let label = recent_label(path);
		menu.append(&MenuItem::with_id(app, &id, &label, true, None::<&str>)?)?;
	}
	if !recent.is_empty() {
		menu.append(&PredefinedMenuItem::separator(app)?)?;
	}

	menu.append(&MenuItem::with_id(
		app,
		"new_window",
		"New window",
		true,
		None::<&str>,
	)?)?;
	menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;
	Ok(menu)
}

pub fn rebuild_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
	let state = app.state::<DesktopState>();
	let recent = state
		.recent
		.lock()
		.map_err(|e| e.to_string())?
		.clone();
	let menu = build_tray_menu(app, &recent).map_err(|e| e.to_string())?;
	if let Some(tray) = app.tray_by_id(TRAY_ID) {
		tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
	}
	Ok(())
}

pub fn handle_tray_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
	match id {
		"toggle" => toggle_main_window(app),
		"home" => {
			show_main_window(app);
			let _ = app.emit("open-path", "home:".to_string());
		}
		"new_window" => {
			if let Ok(exe) = std::env::current_exe() {
				let _ = std::process::Command::new(exe).arg("home:").spawn();
			}
		}
		"quit" => {
			app.exit(0);
		}
		other if other.starts_with("recent:") => {
			if let Ok(idx) = other.trim_start_matches("recent:").parse::<usize>() {
				let path = {
					let state = app.state::<DesktopState>();
					state
						.recent
						.lock()
						.ok()
						.and_then(|recent| recent.get(idx).cloned())
				};
				if let Some(path) = path {
					show_main_window(app);
					let _ = app.emit("open-path", path);
				}
			}
		}
		_ => {}
	}
}

#[tauri::command]
pub async fn get_desktop_prefs(
	state: tauri::State<'_, DesktopState>,
) -> Result<DesktopPrefsSnapshot, String> {
	Ok(DesktopPrefsSnapshot {
		close_to_tray: *state.close_to_tray.lock().map_err(|e| e.to_string())?,
		start_minimized: *state.start_minimized.lock().map_err(|e| e.to_string())?,
	})
}

#[tauri::command]
pub async fn set_close_to_tray(
	enabled: bool,
	state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
	*state.close_to_tray.lock().map_err(|e| e.to_string())? = enabled;
	Ok(())
}

#[tauri::command]
pub async fn set_start_minimized(
	enabled: bool,
	state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
	*state.start_minimized.lock().map_err(|e| e.to_string())? = enabled;
	Ok(())
}

#[tauri::command]
pub async fn sync_tray_recents(
	app: AppHandle,
	paths: Vec<String>,
	state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
	{
		let mut recent = state.recent.lock().map_err(|e| e.to_string())?;
		*recent = paths.into_iter().take(RECENT_CAP).collect();
	}
	rebuild_tray_menu(&app)
}

#[tauri::command]
pub async fn toggle_main_window_cmd(app: AppHandle) -> Result<(), String> {
	toggle_main_window(&app);
	Ok(())
}
