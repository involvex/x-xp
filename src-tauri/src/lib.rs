mod commands;

use commands::archive::{compress_entries, extract_archive};
use commands::fs::{
	copy_entries, create_dir, create_file, delete_entries, format_modified, get_drives,
	get_entry_properties, get_folder_size, move_entries, open_in_new_window, open_path, open_with,
	read_dir, read_text_preview, rename_entry,
};
use commands::path::{
	get_home, get_known_folders, get_startup_path, parent_path, parse_startup_path,
	parse_startup_path_with_cwd, resolve_path, set_startup_path, StartupState,
};
use commands::recycle::{delete_recycle_item, list_recycle_bin, restore_recycle_item};
use commands::registry::{
	backup_folder_handlers, create_system_restore_point, get_registry_status,
	restore_folder_handlers, set_as_default_folder_handler,
};
use commands::search::search_by_name;
use std::env;
use tauri::{
	menu::{Menu, MenuItem},
	tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
	Emitter, Manager, WindowEvent,
};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

fn show_main_window(app: &tauri::AppHandle) {
	if let Some(window) = app.get_webview_window("main") {
		let _ = window.show();
		let _ = window.unminimize();
		let _ = window.set_focus();
	}
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	let args: Vec<String> = env::args().collect();
	let startup = parse_startup_path(&args);

	tauri::Builder::default()
		.plugin(tauri_plugin_opener::init())
		.plugin(tauri_plugin_store::Builder::new().build())
		.plugin(
			WindowStateBuilder::default()
				.with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
				.build(),
		)
		.plugin(tauri_plugin_global_shortcut::Builder::new().build())
		.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
			let path = parse_startup_path_with_cwd(&argv, Some(cwd.as_str()));
			show_main_window(app);
			if let Some(p) = path {
				if let Some(window) = app.get_webview_window("main") {
					let _ = window.emit("open-path", p);
				}
			}
		}))
		.manage(StartupState::new(startup.clone()))
		.invoke_handler(tauri::generate_handler![
			read_dir,
			get_drives,
			create_dir,
			create_file,
			rename_entry,
			delete_entries,
			copy_entries,
			move_entries,
			open_path,
			open_with,
			open_in_new_window,
			get_entry_properties,
			get_folder_size,
			extract_archive,
			compress_entries,
			list_recycle_bin,
			restore_recycle_item,
			delete_recycle_item,
			read_text_preview,
			format_modified,
			get_home,
			get_known_folders,
			get_startup_path,
			set_startup_path,
			resolve_path,
			parent_path,
			search_by_name,
			get_registry_status,
			backup_folder_handlers,
			set_as_default_folder_handler,
			restore_folder_handlers,
			create_system_restore_point,
		])
		.setup(move |app| {
			let show_i = MenuItem::with_id(app, "show", "Show x-xp", true, None::<&str>)?;
			let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
			let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

			let icon = app
				.default_window_icon()
				.cloned()
				.expect("default window icon missing");

			let _tray = TrayIconBuilder::with_id("main")
				.icon(icon)
				.menu(&menu)
				.tooltip("x-xp")
				.on_menu_event(|app, event| match event.id.as_ref() {
					"show" => show_main_window(app),
					"quit" => {
						app.exit(0);
					}
					_ => {}
				})
				.on_tray_icon_event(|tray, event| {
					if let TrayIconEvent::Click {
						button: MouseButton::Left,
						button_state: MouseButtonState::Up,
						..
					} = event
					{
						show_main_window(tray.app_handle());
					}
				})
				.build(app)?;

			if let Some(window) = app.get_webview_window("main") {
				let window_for_event = window.clone();
				window.on_window_event(move |event| {
					if let WindowEvent::CloseRequested { api, .. } = event {
						api.prevent_close();
						let _ = window_for_event.hide();
					}
				});
			}

			if let Some(path) = startup {
				if let Some(window) = app.get_webview_window("main") {
					let _ = window.emit("open-path", path);
				}
			}
			Ok(())
		})
		.run(tauri::generate_context!())
		.expect("error while running x-xp");
}
