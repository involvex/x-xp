use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RecycleItem {
	pub id: String,
	pub name: String,
	pub original_path: String,
	pub deleted_date: String,
	pub size_display: String,
	pub is_dir: bool,
}

#[cfg(windows)]
fn run_ps(script: &str) -> Result<String, String> {
	let output = Command::new("powershell")
		.args([
			"-NoProfile",
			"-NonInteractive",
			"-ExecutionPolicy",
			"Bypass",
			"-Command",
			script,
		])
		.output()
		.map_err(|e| format!("Failed to start PowerShell: {e}"))?;
	if !output.status.success() {
		let err = String::from_utf8_lossy(&output.stderr);
		return Err(if err.trim().is_empty() {
			"PowerShell recycle bin command failed".into()
		} else {
			err.trim().to_string()
		});
	}
	Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(windows)]
fn escape_ps_single(s: &str) -> String {
	s.replace('\'', "''")
}

/// List Recycle Bin items via Shell.Application COM (Windows only).
#[tauri::command]
pub async fn list_recycle_bin() -> Result<Vec<RecycleItem>, String> {
	#[cfg(not(windows))]
	{
		Err("Recycle Bin browsing is only available on Windows".into())
	}
	#[cfg(windows)]
	{
		tauri::async_runtime::spawn_blocking(|| {
			let script = r#"
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace(0x0a)
if (-not $folder) { throw 'Could not open Recycle Bin' }
$items = @()
foreach ($item in $folder.Items()) {
  $name = [string]$item.Name
  $orig = [string]$folder.GetDetailsOf($item, 1)
  $deleted = [string]$folder.GetDetailsOf($item, 2)
  $size = [string]$folder.GetDetailsOf($item, 3)
  $path = [string]$item.Path
  $isDir = [bool]$item.IsFolder
  $items += [PSCustomObject]@{
    id = $path
    name = $name
    originalPath = $orig
    deletedDate = $deleted
    sizeDisplay = $size
    isDir = $isDir
  }
}
if ($items.Count -eq 0) { '[]' } else { $items | ConvertTo-Json -Compress -Depth 3 }
"#;
			let raw = run_ps(script)?;
			if raw.is_empty() {
				return Ok(Vec::new());
			}
			let parsed: serde_json::Value =
				serde_json::from_str(&raw).map_err(|e| format!("Parse recycle list: {e}\n{raw}"))?;
			let arr = match parsed {
				serde_json::Value::Array(a) => a,
				serde_json::Value::Object(_) => vec![parsed],
				_ => Vec::new(),
			};
			let mut items = Vec::new();
			for v in arr {
				let id = v
					.get("id")
					.and_then(|x| x.as_str())
					.unwrap_or("")
					.to_string();
				if id.is_empty() {
					continue;
				}
				items.push(RecycleItem {
					id: id.clone(),
					name: v
						.get("name")
						.and_then(|x| x.as_str())
						.unwrap_or("")
						.to_string(),
					original_path: v
						.get("originalPath")
						.and_then(|x| x.as_str())
						.unwrap_or("")
						.to_string(),
					deleted_date: v
						.get("deletedDate")
						.and_then(|x| x.as_str())
						.unwrap_or("")
						.to_string(),
					size_display: v
						.get("sizeDisplay")
						.and_then(|x| x.as_str())
						.unwrap_or("")
						.to_string(),
					is_dir: v.get("isDir").and_then(|x| x.as_bool()).unwrap_or(false),
				});
			}
			Ok(items)
		})
		.await
		.map_err(|e| e.to_string())?
	}
}

#[cfg(windows)]
fn recycle_verb(id: String, action: &str) -> Result<(), String> {
	let id_esc = escape_ps_single(&id);
	let is_restore = action == "restore";
	let script = if is_restore {
		format!(
			r#"
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace(0x0a)
if (-not $folder) {{ throw 'Could not open Recycle Bin' }}
$target = $null
foreach ($item in $folder.Items()) {{
  if ([string]$item.Path -eq '{id}') {{ $target = $item; break }}
}}
if (-not $target) {{ throw 'Item not found in Recycle Bin' }}
$done = $false
foreach ($v in @($target.Verbs())) {{
  $name = (([string]$v.Name) -replace '&','').Trim()
  if ($name -match '(?i)^(restore|undelete|wiederherstellen)') {{
    $v.DoIt(); $done = $true; break
  }}
}}
if (-not $done) {{ $target.InvokeVerb('undelete') }}
"#,
			id = id_esc
		)
	} else {
		format!(
			r#"
$ErrorActionPreference = 'Stop'
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace(0x0a)
if (-not $folder) {{ throw 'Could not open Recycle Bin' }}
$target = $null
foreach ($item in $folder.Items()) {{
  if ([string]$item.Path -eq '{id}') {{ $target = $item; break }}
}}
if (-not $target) {{ throw 'Item not found in Recycle Bin' }}
$done = $false
foreach ($v in @($target.Verbs())) {{
  $name = (([string]$v.Name) -replace '&','').Trim()
  if ($name -match '(?i)^(delete|remove|löschen|permanent)') {{
    $v.DoIt(); $done = $true; break
  }}
}}
if (-not $done) {{ $target.InvokeVerb('delete') }}
"#,
			id = id_esc
		)
	};
	run_ps(&script)?;
	Ok(())
}

#[tauri::command]
pub async fn restore_recycle_item(id: String) -> Result<(), String> {
	#[cfg(not(windows))]
	{
		let _ = id;
		Err("Recycle Bin actions are only available on Windows".into())
	}
	#[cfg(windows)]
	{
		tauri::async_runtime::spawn_blocking(move || recycle_verb(id, "restore"))
			.await
			.map_err(|e| e.to_string())?
	}
}

#[tauri::command]
pub async fn delete_recycle_item(id: String) -> Result<(), String> {
	#[cfg(not(windows))]
	{
		let _ = id;
		Err("Recycle Bin actions are only available on Windows".into())
	}
	#[cfg(windows)]
	{
		tauri::async_runtime::spawn_blocking(move || recycle_verb(id, "delete"))
			.await
			.map_err(|e| e.to_string())?
	}
}
