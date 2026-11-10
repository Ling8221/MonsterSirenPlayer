//! 系统托盘：显示主窗口、播放控制与退出；配合窗口关闭行为设置。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

/// true = 关闭窗口时隐藏到托盘；false = 直接退出。
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static TRAY_AVAILABLE: AtomicBool = AtomicBool::new(false);
static EXIT_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn close_to_tray() -> bool {
    TRAY_AVAILABLE.load(Ordering::Relaxed) && CLOSE_TO_TRAY.load(Ordering::Relaxed)
}

pub fn disable_close_to_tray() {
    CLOSE_TO_TRAY.store(false, Ordering::Relaxed);
}

pub fn exit_requested() -> bool {
    EXIT_REQUESTED.load(Ordering::Relaxed)
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let play = MenuItem::with_id(app, "play", "播放 / 暂停", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, "previous", "上一首", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "下一首", true, None::<&str>)?;
    let separator_top = PredefinedMenuItem::separator(app)?;
    let separator_bottom = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &separator_top,
            &play,
            &previous,
            &next,
            &separator_bottom,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("Monster Siren")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "play" => {
                let _ = app.emit("tray://play-pause", ());
            }
            "previous" => {
                let _ = app.emit("tray://previous", ());
            }
            "next" => {
                let _ = app.emit("tray://next", ());
            }
            "quit" => {
                EXIT_REQUESTED.store(true, Ordering::Relaxed);
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
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder.build(app)?;
    app.manage(tray);
    TRAY_AVAILABLE.store(true, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn set_close_behavior(behavior: String) {
    if !TRAY_AVAILABLE.load(Ordering::Relaxed) {
        CLOSE_TO_TRAY.store(false, Ordering::Relaxed);
        return;
    }
    CLOSE_TO_TRAY.store(behavior != "exit", Ordering::Relaxed);
}
