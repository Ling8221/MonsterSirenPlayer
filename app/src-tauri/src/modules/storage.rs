//! 本地持久化：全部数据放在程序自己的 `config` 目录里，不写系统 AppData。
//!
//! 位置规则：
//! - 开发模式（debug）：项目根目录下的 `config`（`cargo clean` 不会误删）
//! - 发布版：可执行文件同级的 `config`，可整目录拷走，属于便携式存储
//! - 环境变量 `MSR_CONFIG_DIR` 可覆盖以上规则
//!
//! 写入仍是「临时文件 + 重命名」，并保留 `.json.bak`。

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const CONFIG_DIR_NAME: &str = "config";

/// 配置目录（不保证已存在）。
pub fn config_root() -> PathBuf {
    if let Some(custom) = std::env::var_os("MSR_CONFIG_DIR") {
        let path = PathBuf::from(custom);
        if !path.as_os_str().is_empty() {
            return path;
        }
    }

    if cfg!(debug_assertions) {
        if let Some(manifest) = option_env!("CARGO_MANIFEST_DIR") {
            let manifest_dir = fs::canonicalize(manifest).unwrap_or_else(|_| PathBuf::from(manifest));
            if let Some(app_dir) = manifest_dir.parent() {
                return app_dir.join(CONFIG_DIR_NAME);
            }
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join(CONFIG_DIR_NAME);
        }
    }

    PathBuf::from(CONFIG_DIR_NAME)
}

fn ensure_config_root() -> Result<PathBuf, String> {
    let root = config_root();
    fs::create_dir_all(&root).map_err(|err| format!("创建 config 目录失败（{}）：{err}", root.display()))?;
    Ok(root)
}

/// 键名限制为 `a-z0-9_-` 与 `/` 分段，杜绝路径穿越。
fn key_path(key: &str) -> Result<PathBuf, String> {
    let valid = !key.is_empty()
        && key.len() <= 128
        && key.split('/').all(|segment| {
            !segment.is_empty()
                && segment
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
        });

    if !valid {
        return Err(format!("非法的存储键名：{key}"));
    }

    let mut path = ensure_config_root()?;
    for segment in key.split('/') {
        path.push(segment);
    }
    path.set_extension("json");
    Ok(path)
}

#[tauri::command]
pub fn storage_read(_app: AppHandle, key: String) -> Result<Option<String>, String> {
    let path = key_path(&key)?;
    match fs::read_to_string(&path) {
        Ok(text) if text.trim().is_empty() => Ok(None),
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(format!("读取 {key} 失败：{err}")),
    }
}

#[tauri::command]
pub fn storage_write(_app: AppHandle, key: String, data: String) -> Result<(), String> {
    let path = key_path(&key)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("创建目录失败：{err}"))?;
    }

    let tmp_path = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp_path).map_err(|err| format!("写入失败：{err}"))?;
        file.write_all(data.as_bytes())
            .map_err(|err| format!("写入失败：{err}"))?;
        file.sync_all().map_err(|err| format!("写入失败：{err}"))?;
    }

    fs::rename(&tmp_path, &path).map_err(|err| format!("保存 {key} 失败：{err}"))?;
    // 旧版本会额外生成 .bak 文件，现在统一走 backups 目录，顺手清掉。
    let _ = fs::remove_file(path.with_extension("json.bak"));
    Ok(())
}

#[tauri::command]
pub fn storage_remove(_app: AppHandle, key: String) -> Result<(), String> {
    let path = key_path(&key)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(format!("删除 {key} 失败：{err}")),
    }
}

/// 读取旧版（0.1.x）写在 `%APPDATA%\com.monster-siren.player\data.json` 的收藏与歌单，
/// 仅用于首次启动迁移；只读，不写系统目录。
#[tauri::command]
pub fn read_legacy_state(app: AppHandle) -> Result<Option<String>, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("无法定位旧版数据目录：{err}"))?;
    let path = dir.join("data.json");
    match fs::read_to_string(&path) {
        Ok(text) if text.trim().is_empty() => Ok(None),
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(format!("读取旧版数据失败：{err}")),
    }
}
