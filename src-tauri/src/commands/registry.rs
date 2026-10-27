//! Windows folder-handler registration with backup + restore.
//! Prefer elevated MSI custom actions for HKLM; these commands work on HKCU mirrors
//! and can restore from `HKLM\Software\Involvex\x-xp\Backup` when readable.

use serde::{Deserialize, Serialize};

#[cfg(windows)]
use winreg::enums::*;
#[cfg(windows)]
use winreg::RegKey;

const BACKUP_ROOT: &str = r"Software\Involvex\x-xp\Backup";
const APP_PATHS: &str = r"Software\Microsoft\Windows\CurrentVersion\App Paths\x-xp.exe";

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegistryBackupStatus {
	pub has_backup: bool,
	pub is_default: bool,
	pub backup_keys: Vec<String>,
	pub message: String,
}

#[cfg(windows)]
fn open_hkcu() -> Result<RegKey, String> {
	RegKey::predef(HKEY_CURRENT_USER)
		.open_subkey("Software")
		.map_err(|e| e.to_string())?;
	Ok(RegKey::predef(HKEY_CURRENT_USER))
}

#[cfg(windows)]
fn read_string(root: &RegKey, subkey: &str, name: &str) -> Option<String> {
	root.open_subkey(subkey)
		.ok()
		.and_then(|k| k.get_value::<String, _>(name).ok())
}

#[cfg(windows)]
fn ensure_backup_key() -> Result<RegKey, String> {
	let hkcu = open_hkcu()?;
	hkcu.create_subkey(BACKUP_ROOT)
		.map(|(k, _)| k)
		.map_err(|e| e.to_string())
}

#[cfg(windows)]
fn backup_value(backup: &RegKey, key_id: &str, value: &str) -> Result<(), String> {
	backup
		.set_value(key_id, &value.to_string())
		.map_err(|e| e.to_string())
}

#[cfg(windows)]
fn directory_open_command() -> Option<String> {
	let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
	read_string(&hkcr, r"Directory\shell\open\command", "")
}

#[cfg(windows)]
fn exe_path() -> Result<String, String> {
	std::env::current_exe()
		.map(|p| p.to_string_lossy().into_owned())
		.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_registry_status() -> Result<RegistryBackupStatus, String> {
	#[cfg(windows)]
	{
		let hkcu = open_hkcu()?;
		let has_backup = hkcu.open_subkey(BACKUP_ROOT).is_ok();
		let mut backup_keys = Vec::new();
		if let Ok(backup) = hkcu.open_subkey(BACKUP_ROOT) {
			for name in backup.enum_values().filter_map(|v| v.ok()) {
				backup_keys.push(name.0);
			}
		}
		let exe = exe_path().unwrap_or_default();
		let current = directory_open_command().unwrap_or_default();
		let is_default = !exe.is_empty() && current.to_lowercase().contains(&exe.to_lowercase());
		Ok(RegistryBackupStatus {
			has_backup,
			is_default,
			backup_keys,
			message: if is_default {
				"x-xp is registered as the folder open handler.".into()
			} else if has_backup {
				"Backup present; x-xp is not currently the default.".into()
			} else {
				"No backup yet. Installer or Set Default will create one.".into()
			},
		})
	}
	#[cfg(not(windows))]
	{
		Ok(RegistryBackupStatus {
			has_backup: false,
			is_default: false,
			backup_keys: vec![],
			message: "Registry integration is Windows-only.".into(),
		})
	}
}

#[tauri::command]
pub async fn backup_folder_handlers() -> Result<String, String> {
	#[cfg(windows)]
	{
		let backup = ensure_backup_key()?;
		let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);

		let pairs = [
			("DirectoryOpenCommand", r"Directory\shell\open\command"),
			("DirectoryShellDefault", r"Directory\shell"),
			("FolderOpenCommand", r"Folder\shell\open\command"),
			("DriveOpenCommand", r"Drive\shell\open\command"),
		];

		for (id, sub) in pairs {
			if let Some(val) = read_string(&hkcr, sub, "") {
				backup_value(&backup, id, &val)?;
			}
		}
		Ok("Folder handler values backed up under HKCU\\Software\\Involvex\\x-xp\\Backup".into())
	}
	#[cfg(not(windows))]
	{
		Err("Windows only".into())
	}
}

#[tauri::command]
pub async fn set_as_default_folder_handler() -> Result<String, String> {
	#[cfg(windows)]
	{
		let _ = backup_folder_handlers().await?;
		let exe = exe_path()?;
		let command = format!("\"{exe}\" \"%1\"");
		let hkcu = open_hkcu()?;

		// User-level Class registration (no admin required)
		let classes = hkcu
			.create_subkey(r"Software\Classes")
			.map_err(|e| e.to_string())?
			.0;

		for (key, cmd) in [
			(r"Directory\shell\open\command", command.as_str()),
			(r"Directory\shell\x-xp\command", command.as_str()),
			(r"Drive\shell\open\command", command.as_str()),
			(r"Folder\shell\open\command", command.as_str()),
		] {
			let (k, _) = classes.create_subkey(key).map_err(|e| e.to_string())?;
			k.set_value("", &cmd.to_string())
				.map_err(|e| e.to_string())?;
		}

		let (label_key, _) = classes
			.create_subkey(r"Directory\shell\x-xp")
			.map_err(|e| e.to_string())?;
		label_key
			.set_value("", &"Open with x-xp".to_string())
			.map_err(|e| e.to_string())?;
		label_key
			.set_value("Icon", &format!("{exe},0"))
			.map_err(|e| e.to_string())?;

		// App Paths for `x-xp` CLI discovery
		let (app_paths, _) = hkcu.create_subkey(APP_PATHS).map_err(|e| e.to_string())?;
		app_paths
			.set_value("", &exe)
			.map_err(|e| e.to_string())?;
		if let Some(parent) = std::path::Path::new(&exe).parent() {
			app_paths
				.set_value("Path", &parent.to_string_lossy().to_string())
				.map_err(|e| e.to_string())?;
		}

		Ok("Registered x-xp as user-level default folder handler.".into())
	}
	#[cfg(not(windows))]
	{
		Err("Windows only".into())
	}
}

#[tauri::command]
pub async fn restore_folder_handlers() -> Result<String, String> {
	#[cfg(windows)]
	{
		let hkcu = open_hkcu()?;
		let backup = hkcu
			.open_subkey(BACKUP_ROOT)
			.map_err(|_| "No backup found. Use System Restore if needed.".to_string())?;
		let classes = hkcu
			.create_subkey(r"Software\Classes")
			.map_err(|e| e.to_string())?
			.0;

		let map = [
			("DirectoryOpenCommand", r"Directory\shell\open\command"),
			("FolderOpenCommand", r"Folder\shell\open\command"),
			("DriveOpenCommand", r"Drive\shell\open\command"),
		];

		let mut restored = 0usize;
		for (id, sub) in map {
			if let Ok(val) = backup.get_value::<String, _>(id) {
				let (k, _) = classes.create_subkey(sub).map_err(|e| e.to_string())?;
				k.set_value("", &val).map_err(|e| e.to_string())?;
				restored += 1;
			}
		}

		// Remove our open overrides if backup empty — delete x-xp shell entries
		let _ = classes.delete_subkey_all(r"Directory\shell\x-xp");

		Ok(format!(
			"Restored {restored} handler value(s) from backup. If folders still open wrongly, use System Restore point 'Before x-xp default explorer'."
		))
	}
	#[cfg(not(windows))]
	{
		Err("Windows only".into())
	}
}

#[tauri::command]
pub async fn create_system_restore_point(description: Option<String>) -> Result<String, String> {
	#[cfg(windows)]
	{
		let desc = description.unwrap_or_else(|| "Before x-xp default explorer".into());
		// Best-effort via PowerShell Checkpoint-Computer (requires admin + System Restore enabled)
		let output = std::process::Command::new("powershell")
			.args([
				"-NoProfile",
				"-Command",
				&format!(
					"try {{ Checkpoint-Computer -Description '{}' -RestorePointType MODIFY_SETTINGS; 'ok' }} catch {{ $_.Exception.Message }}",
					desc.replace('\'', "''")
				),
			])
			.output()
			.map_err(|e| e.to_string())?;
		let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
		let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
		if stdout.contains("ok") {
			Ok(format!("System Restore point created: {desc}"))
		} else {
			Err(format!(
				"Could not create restore point (admin / System Restore may be required): {stdout} {stderr}"
			))
		}
	}
	#[cfg(not(windows))]
	{
		let _ = description;
		Err("Windows only".into())
	}
}
