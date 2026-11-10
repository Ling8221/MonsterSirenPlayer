mod modules;

use std::fs;

use modules::{backup, fonts, http, logging, storage, tray};
use tauri::Manager;

/// 启动时静默检查数据目录；只有写不了时才提示，平时不刷屏。
/// 需要排查环境时设置 `MSR_DEBUG=1`，会额外打印路径与进程完整性级别。
fn check_config_dir() {
    let dir = storage::config_root();
    let probe = dir.join(".write-probe");
    let result = fs::create_dir_all(&dir).and_then(|_| fs::write(&probe, b"1"));
    let _ = fs::remove_file(&probe);

    if let Err(error) = result {
        let message = format!(
            "无法写入数据目录：{}（{error}）。请把程序放到可写目录，或用环境变量 MSR_CONFIG_DIR 指定数据目录。",
            logging::display_path(&dir)
        );
        eprintln!("[monster-siren] {message}");
        logging::log_line(&format!("storage: {message}"));
        return;
    }

    if std::env::var_os("MSR_DEBUG").is_some() {
        eprintln!("[monster-siren] config = {}", logging::display_path(&dir));
        eprintln!(
            "[monster-siren] logs = {}",
            logging::display_path(&logging::logs_dir())
        );
        if let Ok(exe) = std::env::current_exe() {
            eprintln!("[monster-siren] exe = {}", logging::display_path(&exe));
        }
        if let Ok(output) = std::process::Command::new("whoami").arg("/groups").output() {
            let text = String::from_utf8_lossy(&output.stdout);
            for token in text.split_whitespace() {
                if token.starts_with("S-1-16-") {
                    eprintln!("[monster-siren] integrity = {token}");
                }
            }
        }
    }
}

#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    fonts::list_system_fonts()
}

/// 运行时版本号，和 Cargo.toml 保持一致，避免前端构建缓存导致的旧版本号。
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn open_config_dir() -> Result<(), String> {
    let dir = storage::config_root();
    fs::create_dir_all(&dir).map_err(|error| format!("创建 config 目录失败：{error}"))?;

    #[cfg(target_os = "windows")]
    let spawned = std::process::Command::new("explorer").arg(&dir).spawn();
    #[cfg(target_os = "macos")]
    let spawned = std::process::Command::new("open").arg(&dir).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let spawned = std::process::Command::new("xdg-open").arg(&dir).spawn();

    spawned
        .map(|_| ())
        .map_err(|error| format!("无法打开 config 目录：{error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::prepare();
    logging::load_limit();
    logging::log_line("boot: starting monster-siren");
    check_config_dir();

    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        logging::log_line(&format!(
            "panic: {info}\nbacktrace:\n{}",
            std::backtrace::Backtrace::force_capture()
        ));
        default_hook(info);
    }));

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let labels: Vec<String> = app.webview_windows().keys().cloned().collect();
            logging::log_line(&format!("setup: webview windows = {labels:?}"));
            if let Err(error) = tray::setup(app.handle()) {
                logging::log_line(&format!("tray: setup failed: {error}"));
                tray::disable_close_to_tray();
            }
            Ok(())
        })
        .on_page_load(|_webview, payload| {
            logging::log_line(&format!(
                "page load: {} ({:?})",
                payload.url(),
                payload.event()
            ));
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                logging::log_line("window: close requested");
                if window.label() == "main" && tray::close_to_tray() && !tray::exit_requested() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            tauri::WindowEvent::Destroyed => logging::log_line("window: destroyed"),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            http::api_get,
            http::fetch_text,
            http::fetch_image,
            storage::storage_read,
            storage::storage_write,
            storage::storage_remove,
            storage::read_legacy_state,
            logging::set_log_limit,
            logging::log_event,
            logging::config_info,
            logging::open_logs_dir,
            backup::data_files,
            backup::backup_create,
            backup::backup_list,
            backup::backup_restore,
            backup::backup_delete,
            backup::backup_export,
            backup::clear_data,
            open_config_dir,
            list_system_fonts,
            app_version,
            tray::set_close_behavior,
        ])
        .run(tauri::generate_context!());

    match &result {
        Ok(()) => logging::log_line("exit: run returned Ok"),
        Err(error) => logging::log_line(&format!("exit: run returned error: {error}")),
    }

    if let Err(error) = result {
        eprintln!("monster-siren failed to start: {error}");
        std::process::exit(1);
    }
}
