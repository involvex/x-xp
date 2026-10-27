use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

fn is_zip_path(path: &Path) -> bool {
	path.extension()
		.map(|e| e.eq_ignore_ascii_case("zip"))
		.unwrap_or(false)
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

fn sanitize_zip_path(name: &str) -> Option<PathBuf> {
	let path = Path::new(name);
	let mut out = PathBuf::new();
	for comp in path.components() {
		match comp {
			Component::Normal(c) => out.push(c),
			Component::CurDir => {}
			Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
				return None;
			}
		}
	}
	if out.as_os_str().is_empty() {
		None
	} else {
		Some(out)
	}
}

fn default_extract_dir(archive: &Path) -> PathBuf {
	let parent = archive.parent().unwrap_or_else(|| Path::new("."));
	let stem = archive
		.file_stem()
		.map(|s| s.to_string_lossy().into_owned())
		.unwrap_or_else(|| "extracted".into());
	unique_dest(parent, &stem)
}

/// Extract a zip archive. If `dest` is None, extracts into a sibling folder named after the zip.
#[tauri::command]
pub async fn extract_archive(path: String, dest: Option<String>) -> Result<String, String> {
	tauri::async_runtime::spawn_blocking(move || {
		let archive_path = PathBuf::from(&path);
		if !archive_path.is_file() {
			return Err(format!("Not a file: {path}"));
		}
		if !is_zip_path(&archive_path) {
			return Err("Only .zip archives are supported".into());
		}
		let dest_dir = match dest {
			Some(d) if !d.trim().is_empty() => {
				let p = PathBuf::from(d.trim());
				if p.exists() && !p.is_dir() {
					return Err(format!("Destination is not a directory: {}", p.display()));
				}
				fs::create_dir_all(&p).map_err(|e| e.to_string())?;
				p
			}
			_ => {
				let p = default_extract_dir(&archive_path);
				fs::create_dir_all(&p).map_err(|e| e.to_string())?;
				p
			}
		};

		let file = File::open(&archive_path).map_err(|e| e.to_string())?;
		let mut zip = ZipArchive::new(file).map_err(|e| e.to_string())?;
		for i in 0..zip.len() {
			let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
			let Some(rel) = sanitize_zip_path(entry.name()) else {
				continue;
			};
			let out_path = dest_dir.join(&rel);
			if entry.is_dir() || entry.name().ends_with('/') || entry.name().ends_with('\\') {
				fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
				continue;
			}
			if let Some(parent) = out_path.parent() {
				fs::create_dir_all(parent).map_err(|e| e.to_string())?;
			}
			let mut out = File::create(&out_path).map_err(|e| e.to_string())?;
			std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
		}
		Ok(dest_dir.to_string_lossy().into_owned())
	})
	.await
	.map_err(|e| e.to_string())?
}

fn add_file_to_zip(
	zip: &mut ZipWriter<File>,
	path: &Path,
	name_in_zip: &str,
	opts: SimpleFileOptions,
) -> Result<(), String> {
	zip.start_file(name_in_zip.replace('\\', "/"), opts)
		.map_err(|e| e.to_string())?;
	let mut f = File::open(path).map_err(|e| e.to_string())?;
	let mut buf = Vec::new();
	f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
	zip.write_all(&buf).map_err(|e| e.to_string())?;
	Ok(())
}

fn add_dir_to_zip(
	zip: &mut ZipWriter<File>,
	dir: &Path,
	prefix: &str,
	opts: SimpleFileOptions,
) -> Result<(), String> {
	for entry in WalkDir::new(dir)
		.follow_links(false)
		.into_iter()
		.filter_map(|e| e.ok())
	{
		let p = entry.path();
		if p == dir {
			continue;
		}
		let rel = p
			.strip_prefix(dir)
			.map_err(|e| e.to_string())?
			.to_string_lossy()
			.replace('\\', "/");
		let name = if prefix.is_empty() {
			rel
		} else {
			format!("{prefix}/{rel}")
		};
		if entry.file_type().is_dir() {
			let dir_name = if name.ends_with('/') {
				name
			} else {
				format!("{name}/")
			};
			zip.add_directory(dir_name, opts)
				.map_err(|e| e.to_string())?;
		} else if entry.file_type().is_file() {
			add_file_to_zip(zip, p, &name, opts)?;
		}
	}
	Ok(())
}

/// Compress paths into a zip at `dest_zip`.
#[tauri::command]
pub async fn compress_entries(paths: Vec<String>, dest_zip: String) -> Result<String, String> {
	tauri::async_runtime::spawn_blocking(move || {
		if paths.is_empty() {
			return Err("No paths to compress".into());
		}
		let dest = PathBuf::from(&dest_zip);
		if !dest
			.extension()
			.map(|e| e.eq_ignore_ascii_case("zip"))
			.unwrap_or(false)
		{
			return Err("Destination must end with .zip".into());
		}
		if let Some(parent) = dest.parent() {
			fs::create_dir_all(parent).map_err(|e| e.to_string())?;
		}
		let file = File::create(&dest).map_err(|e| e.to_string())?;
		let mut zip = ZipWriter::new(file);
		let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

		for src in &paths {
			let src_path = PathBuf::from(src);
			if !src_path.exists() {
				return Err(format!("Path does not exist: {src}"));
			}
			let name = src_path
				.file_name()
				.ok_or_else(|| format!("Invalid path: {src}"))?
				.to_string_lossy()
				.into_owned();
			if src_path.is_dir() {
				zip.add_directory(format!("{name}/"), opts)
					.map_err(|e| e.to_string())?;
				add_dir_to_zip(&mut zip, &src_path, &name, opts)?;
			} else {
				add_file_to_zip(&mut zip, &src_path, &name, opts)?;
			}
		}
		zip.finish().map_err(|e| e.to_string())?;
		Ok(dest.to_string_lossy().into_owned())
	})
	.await
	.map_err(|e| e.to_string())?
}
