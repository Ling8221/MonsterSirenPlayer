//! 启动日志：每次启动一个文件，放在与 `config` **同级**的 `logs/` 目录下。
//!
//! 文件名格式：`YYYY-MM-DD_HH-MM-SS.log`（零填充、可排序、无空格）。
//! 总大小受设置页的「日志上限」约束：当前文件超过上限时滚到新文件，
//! 整个目录超过上限时从最旧的文件开始删除。

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::storage;

pub const DEFAULT_LOG_KB: u32 = 512;
const MIN_LOG_KB: u32 = 64;
const MAX_LOG_KB: u32 = 10240;

static LOG_LIMIT_KB: AtomicU32 = AtomicU32::new(DEFAULT_LOG_KB);
static CURRENT_LOG: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn clamp_log_kb(kb: u32) -> u32 {
    kb.clamp(MIN_LOG_KB, MAX_LOG_KB)
}

pub fn limit_bytes() -> u64 {
    u64::from(LOG_LIMIT_KB.load(Ordering::Relaxed)) * 1024
}

pub fn config_dir() -> PathBuf {
    storage::config_root()
}

/// 日志目录与 `config` 同级：`<数据根>/config` 与 `<数据根>/logs`。
pub fn logs_dir() -> PathBuf {
    let config = config_dir();
    match config.parent() {
        Some(parent) => parent.join("logs"),
        None => config.join("logs"),
    }
}

/// 供备份文件名复用的时间戳：`YYYY-MM-DD_HH-MM-SS`。
pub fn file_stamp() -> String {
    now_parts().file_stem()
}

/// 兼容上一版把日志放在 `config/logs` 的布局：启动时把旧文件搬到同级 `logs`。
fn migrate_legacy_logs() {
    let legacy = config_dir().join("logs");
    let target = logs_dir();
    if legacy == target || !legacy.is_dir() {
        return;
    }

    let Ok(entries) = fs::read_dir(&legacy) else { return };
    if fs::create_dir_all(&target).is_err() {
        return;
    }
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("log")) {
            if let Some(name) = path.file_name() {
                let destination = target.join(name);
                if !destination.exists() {
                    let _ = fs::rename(&path, &destination);
                }
            }
        }
    }

    // 搬空后把旧的 config/logs 目录删掉。
    if fs::read_dir(&legacy)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false)
    {
        let _ = fs::remove_dir(&legacy);
    }
}

pub fn prepare() {
    migrate_legacy_logs();
}

fn log_dir_candidates() -> Vec<PathBuf> {
    let mut dirs = vec![logs_dir()];
    dirs.push(std::env::temp_dir().join("monster-siren-logs"));
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.join("logs"));
        }
    }
    dirs
}

pub fn display_path(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

fn stamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

struct DateParts {
    year: u16,
    month: u8,
    day: u8,
    hour: u8,
    minute: u8,
    second: u8,
}

impl DateParts {
    fn file_stem(&self) -> String {
        format!(
            "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
            self.year, self.month, self.day, self.hour, self.minute, self.second
        )
    }
}

#[cfg(windows)]
fn now_parts() -> DateParts {
    use windows::Win32::System::SystemInformation::GetLocalTime;

    let time = unsafe { GetLocalTime() };
    DateParts {
        year: time.wYear,
        month: time.wMonth as u8,
        day: time.wDay as u8,
        hour: time.wHour as u8,
        minute: time.wMinute as u8,
        second: time.wSecond as u8,
    }
}

#[cfg(not(windows))]
fn now_parts() -> DateParts {
    // 非 Windows 沿用 UTC，保证目录名可排序即可。
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0);
    let days = seconds.div_euclid(86_400);
    let rest = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    DateParts {
        year,
        month,
        day,
        hour: (rest / 3600) as u8,
        minute: ((rest % 3600) / 60) as u8,
        second: (rest % 60) as u8,
    }
}

#[cfg(not(windows))]
fn civil_from_days(days: i64) -> (u16, u8, u8) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    (year as u16, month as u8, day as u8)
}

fn unique_path(dir: &Path, stem: &str) -> PathBuf {
    let base = dir.join(format!("{stem}.log"));
    if !base.exists() {
        return base;
    }
    for index in 2..10_000u32 {
        let candidate = dir.join(format!("{stem}_{index}.log"));
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!("{stem}_{}.log", std::process::id()))
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path).map(|meta| meta.len()).unwrap_or(0)
}

fn ensure_current() -> Option<PathBuf> {
    let mut guard = CURRENT_LOG.lock().ok()?;
    if let Some(path) = guard.as_ref() {
        return Some(path.clone());
    }

    let stem = now_parts().file_stem();
    for dir in log_dir_candidates() {
        if fs::create_dir_all(&dir).is_err() {
            continue;
        }
        let path = unique_path(&dir, &stem);
        // 用创建空文件的方式探测目录可写。
        if fs::write(&path, b"").is_ok() {
            *guard = Some(path.clone());
            return Some(path);
        }
    }
    None
}

fn invalidate_current() {
    if let Ok(mut guard) = CURRENT_LOG.lock() {
        *guard = None;
    }
}

fn rotate(path: &Path) -> PathBuf {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let new_path = unique_path(dir, &now_parts().file_stem());
    if let Ok(mut guard) = CURRENT_LOG.lock() {
        *guard = Some(new_path.clone());
    }
    new_path
}

fn append(path: &Path, line: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    file.write_all(line.as_bytes())?;
    file.sync_data()?;
    Ok(())
}

/// 只清理目录里的 `.log` 文件；按文件名从旧到新删除，保留当前文件。
fn cleanup_old_logs() {
    let Some(current) = CURRENT_LOG.lock().ok().and_then(|guard| guard.clone()) else {
        return;
    };
    let Some(dir) = current.parent() else { return };
    let Ok(entries) = fs::read_dir(dir) else { return };

    let mut files: Vec<(PathBuf, u64)> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("log")))
        .map(|path| {
            let size = file_size(&path);
            (path, size)
        })
        .collect();

    let limit = limit_bytes();
    let mut total: u64 = files.iter().map(|(_, size)| *size).sum();
    if total <= limit {
        return;
    }

    files.sort_by(|left, right| left.0.file_name().cmp(&right.0.file_name()));
    for (path, size) in files {
        if total <= limit {
            break;
        }
        if path == current {
            continue;
        }
        if fs::remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }

    // 只剩当前文件仍超限：把它截断，避免单个会话无限增长。
    if total > limit {
        let _ = fs::File::create(&current);
    }
}

pub fn log_line(message: &str) {
    let line = format!("[{}] {message}\n", stamp_millis());
    let Some(mut path) = ensure_current() else { return };

    let incoming = line.len() as u64;
    if file_size(&path) > 0 && file_size(&path) + incoming > limit_bytes() {
        path = rotate(&path);
    }

    if append(&path, &line).is_err() {
        invalidate_current();
        if let Some(fallback) = ensure_current() {
            let _ = append(&fallback, &line);
        }
    }

    cleanup_old_logs();
}

/// 从 `config/settings.json`（zustand persist 结构）读取日志上限。
pub fn load_limit() {
    let mut kb = DEFAULT_LOG_KB;
    let path = config_dir().join("settings.json");
    if let Ok(text) = fs::read_to_string(&path) {
        let text = text.trim_start_matches('\u{feff}');
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
            let value = json
                .pointer("/state/logMaxKb")
                .and_then(|value| value.as_u64())
                .or_else(|| json.get("logMaxKb").and_then(|value| value.as_u64()));
            if let Some(value) = value {
                kb = clamp_log_kb(value.min(u64::from(u32::MAX)) as u32);
            }
        }
    }
    LOG_LIMIT_KB.store(kb, Ordering::Relaxed);
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInfo {
    pub config_dir: String,
    pub exe_path: String,
    pub logs_dir: String,
    pub log_path: String,
    pub log_size: u64,
    pub log_files: u32,
    pub log_total_size: u64,
    pub log_limit_kb: u32,
}

fn scan_logs() -> (u32, u64) {
    let dir = logs_dir();
    let Ok(entries) = fs::read_dir(&dir) else {
        return (0, 0);
    };
    let mut count = 0u32;
    let mut total = 0u64;
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("log")) {
            count += 1;
            total += file_size(&path);
        }
    }
    (count, total)
}

#[tauri::command]
pub fn set_log_limit(kb: u32) -> u32 {
    let clamped = clamp_log_kb(kb);
    LOG_LIMIT_KB.store(clamped, Ordering::Relaxed);
    cleanup_old_logs();
    clamped
}

/// 前端运行事件（导航、播放、收藏、歌单、接口失败等）持续写入日志。
#[tauri::command]
pub fn log_event(level: String, message: String) {
    let level = match level.to_ascii_lowercase().as_str() {
        "warn" | "warning" => "WARN",
        "error" => "ERROR",
        _ => "INFO",
    };
    let single_line = message.replace(['\r', '\n'], " ");
    let truncated: String = single_line.chars().take(2000).collect();
    log_line(&format!("[{level}] {truncated}"));
}

#[tauri::command]
pub fn config_info() -> ConfigInfo {
    let current = ensure_current().unwrap_or_else(|| logs_dir());
    let (log_files, log_total_size) = scan_logs();
    ConfigInfo {
        config_dir: display_path(&config_dir()),
        exe_path: std::env::current_exe()
            .map(|path| display_path(&path))
            .unwrap_or_default(),
        logs_dir: display_path(&logs_dir()),
        log_path: display_path(&current),
        log_size: file_size(&current),
        log_files,
        log_total_size,
        log_limit_kb: LOG_LIMIT_KB.load(Ordering::Relaxed),
    }
}

#[tauri::command]
pub fn open_logs_dir() -> Result<(), String> {
    let dir = logs_dir();
    fs::create_dir_all(&dir).map_err(|error| format!("创建 logs 目录失败：{error}"))?;

    #[cfg(target_os = "windows")]
    let spawned = std::process::Command::new("explorer").arg(&dir).spawn();
    #[cfg(target_os = "macos")]
    let spawned = std::process::Command::new("open").arg(&dir).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let spawned = std::process::Command::new("xdg-open").arg(&dir).spawn();

    spawned
        .map(|_| ())
        .map_err(|error| format!("无法打开 logs 目录：{error}"))
}
