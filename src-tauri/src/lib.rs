mod commands;

use commands::archive::{compress_entries, extract_archive};
use commands::desktop::{
	build_tray_menu, get_desktop_prefs, handle_tray_menu, set_close_to_tray, set_start_minimized,
	show_main_window, sync_tray_recents, toggle_main_window_cmd, DesktopState,
};
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
use commands::search::{cancel_search, search_by_name, SearchState};
use commands::transfer::{cancel_transfer, TransferState};
use commands::watch::{unwatch_dir, watch_dir, WatchState};
use std::env;
use tauri::{
	tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
	Emitter, Manager, WindowEvent,
};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

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
		.manage(DesktopState::default())
		.manage(WatchState::default())
		.manage(TransferState::default())
		.manage(SearchState::default())
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
			get_desktop_prefs,
			set_close_to_tray,
			set_start_minimized,
			sync_tray_recents,
			toggle_main_window_cmd,
			watch_dir,
			unwatch_dir,
			cancel_transfer,
			cancel_search,
		])
		.setup(move |app| {
			let menu = build_tray_menu(app.handle(), &[])?;

			let icon = app
				.default_window_icon()
				.cloned()
				.expect("default window icon missing");

			let _tray = TrayIconBuilder::with_id("main")
				.icon(icon)
				.menu(&menu)
				.tooltip("x-xp")
				.on_menu_event(|app, event| {
					handle_tray_menu(app, event.id.as_ref());
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
				let app_handle = app.handle().clone();
				window.on_window_event(move |event| {
					if let WindowEvent::CloseRequested { api, .. } = event {
						let close_to_tray = app_handle
							.state::<DesktopState>()
							.close_to_tray
							.lock()
							.map(|g| *g)
							.unwrap_or(true);
						if close_to_tray {
							api.prevent_close();
							let _ = window_for_event.hide();
						}
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
