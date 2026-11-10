//! 配置备份与恢复：只打包 settings / library / session 三个文件。

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use super::{logging, storage};

const CONFIG_FILES: [(&str, &str); 3] = [
    ("settings.json", "设置"),
    ("library.json", "歌单与收藏"),
    ("session.json", "播放记录"),
];

fn config_dir() -> PathBuf {
    storage::config_root()
}

fn data_root() -> PathBuf {
    config_dir()
        .parent()
        .map(|path| path.to_path_buf())
        .unwrap_or_else(config_dir)
}

fn backups_dir() -> PathBuf {
    data_root().join("backups")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFileInfo {
    pub name: String,
    pub label: String,
    pub path: String,
    pub size: u64,
    pub exists: bool,
}

#[tauri::command]
pub fn data_files() -> Vec<DataFileInfo> {
    let dir = config_dir();
    CONFIG_FILES
        .iter()
        .map(|(name, label)| {
            let path = dir.join(name);
            DataFileInfo {
                name: (*name).to_string(),
                label: (*label).to_string(),
                path: logging::display_path(&path),
                size: fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0),
                exists: path.is_file(),
            }
        })
        .collect()
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created_at: u64,
    pub files: usize,
}

fn read_backup_info(path: &Path) -> Option<BackupInfo> {
    let text = fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;
    let files = json.get("files")?.as_object()?.len();
    Some(BackupInfo {
        name: path.file_name()?.to_string_lossy().to_string(),
        size: fs::metadata(path).map(|meta| meta.len()).unwrap_or(0),
        created_at: json
            .get("createdAt")
            .and_then(|value| value.as_u64())
            .unwrap_or(0),
        files,
    })
}

#[tauri::command]
pub fn backup_list() -> Vec<BackupInfo> {
    let Ok(entries) = fs::read_dir(backups_dir()) else {
        return Vec::new();
    };
    let mut items: Vec<BackupInfo> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("json")))
        .filter_map(|path| read_backup_info(&path))
        .collect();
    items.sort_by(|left, right| right.name.cmp(&left.name));
    items
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建目录失败：{error}"))?;
    }
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp).map_err(|error| format!("写入失败：{error}"))?;
        file.write_all(content.as_bytes())
            .map_err(|error| format!("写入失败：{error}"))?;
        file.sync_all().map_err(|error| format!("写入失败：{error}"))?;
    }
    fs::rename(&tmp, path).map_err(|error| format!("保存失败：{error}"))
}

#[tauri::command]
pub fn backup_create() -> Result<BackupInfo, String> {
    let dir = config_dir();
    let mut files = serde_json::Map::new();
    for (name, _) in CONFIG_FILES {
        let path = dir.join(name);
        if path.is_file() {
            let content =
                fs::read_to_string(&path).map_err(|error| format!("读取 {name} 失败：{error}"))?;
            files.insert(name.to_string(), serde_json::Value::String(content));
        }
    }
    if files.is_empty() {
        return Err("没有可备份的配置文件".to_string());
    }
    let file_count = files.len();

    let backups = backups_dir();
    fs::create_dir_all(&backups).map_err(|error| format!("创建备份目录失败：{error}"))?;

    let stamp = logging::file_stamp();
    let mut name = format!("backup-{stamp}.json");
    let mut index = 2;
    while backups.join(&name).exists() {
        name = format!("backup-{stamp}_{index}.json");
        index += 1;
    }

    let created_at = now_ms();
    let payload = serde_json::json!({
        "version": 1,
        "createdAt": created_at,
        "files": files,
    });
    let path = backups.join(&name);
    write_atomic(&path, &payload.to_string())?;

    Ok(BackupInfo {
        name,
        size: fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0),
        created_at,
        files: file_count,
    })
}

fn is_valid_backup_name(name: &str) -> bool {
    name.starts_with("backup-")
        && name.ends_with(".json")
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
}

#[tauri::command]
pub fn backup_restore(name: String) -> Result<(), String> {
    if !is_valid_backup_name(&name) {
        return Err("非法的备份文件名".to_string());
    }

    let path = backups_dir().join(&name);
    let text = fs::read_to_string(&path).map_err(|error| format!("读取备份失败：{error}"))?;
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|error| format!("备份文件格式错误：{error}"))?;
    let files = json
        .get("files")
        .and_then(|value| value.as_object())
        .ok_or_else(|| "备份缺少 files 字段".to_string())?;

    let dir = config_dir();
    for (file_name, _) in CONFIG_FILES {
        if let Some(serde_json::Value::String(content)) = files.get(file_name) {
            serde_json::from_str::<serde_json::Value>(content)
                .map_err(|error| format!("{file_name} 不是合法 JSON：{error}"))?;
            write_atomic(&dir.join(file_name), content)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn backup_delete(name: String) -> Result<(), String> {
    if !is_valid_backup_name(&name) {
        return Err("非法的备份文件名".to_string());
    }
    let path = backups_dir().join(&name);
    if !path.is_file() {
        return Err("备份文件不存在".to_string());
    }
    fs::remove_file(&path).map_err(|error| format!("删除备份失败：{error}"))?;
    Ok(())
}

/// 把已有备份复制到用户选择的任意位置。
#[tauri::command]
pub fn backup_export(name: String, dest: String) -> Result<(), String> {
    if !is_valid_backup_name(&name) {
        return Err("非法的备份文件名".to_string());
    }
    let source = backups_dir().join(&name);
    if !source.is_file() {
        return Err("备份文件不存在".to_string());
    }
    let content = fs::read_to_string(&source).map_err(|error| format!("读取备份失败：{error}"))?;
    let destination = PathBuf::from(&dest);
    if dest.trim().is_empty() {
        return Err("导出路径为空".to_string());
    }
    if destination.is_dir() {
        return Err("导出路径是文件夹".to_string());
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建导出目录失败：{error}"))?;
    }
    write_atomic(&destination, &content)?;
    Ok(())
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("删除 {} 失败：{error}", logging::display_path(path))),
    }
}

/// 按数据类别清除：settings / library / session / cache / logs / backups。
#[tauri::command]
pub fn clear_data(targets: Vec<String>) -> Result<(), String> {
    let dir = config_dir();
    for target in targets {
        match target.as_str() {
            "settings" | "library" | "session" => {
                let path = dir.join(format!("{target}.json"));
                remove_if_exists(&path)?;
                let _ = fs::remove_file(path.with_extension("json.bak"));
            }
            "cache" => {
                remove_if_exists(&dir.join("cache").join("library.json"))?;
                let _ = fs::remove_dir(dir.join("cache"));
            }
            "logs" => {
                if let Ok(entries) = fs::read_dir(logging::logs_dir()) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("log")) {
                            let _ = fs::remove_file(path);
                        }
                    }
                }
            }
            "backups" => {
                if let Ok(entries) = fs::read_dir(backups_dir()) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("json")) {
                            let _ = fs::remove_file(path);
                        }
                    }
                }
            }
            other => return Err(format!("未知的清除目标：{other}")),
        }
    }
    Ok(())
}
