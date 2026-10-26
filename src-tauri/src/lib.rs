use std::fs;
use std::path::Path;
use serde::Serialize;
use std::env;

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

#[tauri::command]
async fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let target_path = if path.is_empty() {
        // Fallback auf Home oder Root, falls leer
        dirs::home_dir().ok_or("Konnte Home-Verzeichnis nicht finden")?
    } else {
        Path::new(&path).to_owned()
    };

    let entries = fs::read_dir(target_path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let path = entry.path().to_string_lossy().into_owned();
            
            files.push(FileEntry {
                name,
                path,
                is_dir: metadata.is_dir(),
                size: if metadata.is_dir() { 0 } else { metadata.len() },
            });
        }
    }

    // Ordner zuerst sortieren, dann Dateien
    files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));

    Ok(files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        let target_path = &args[1];
        println!("Gestartet mit Pfad aus Kontextmenü: {}", target_path);
    }
    if let Err(e) = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_dir])
        .run(tauri::generate_context!())
    {
        eprintln!("Fehler beim Starten der Tauri-App: {}", e);
    }
}