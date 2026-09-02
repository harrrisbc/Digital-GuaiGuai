use std::sync::Mutex;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WebviewWindow,
};
use tauri_plugin_autostart::ManagerExt;

use crate::settings::{self, AppSettings};
use crate::window::MAIN_WINDOW_LABEL;

pub const TRAY_ID: &str = "main-tray";

pub struct TrayMenuState<R: Runtime> {
    pub show_hide: MenuItem<R>,
    pub stopwatch_status: Submenu<R>,
    pub click_through: CheckMenuItem<R>,
    pub autostart: CheckMenuItem<R>,
}

pub struct TrayStopwatchState {
    pub label: Mutex<String>,
}

impl TrayStopwatchState {
    pub fn new() -> Self {
        Self {
            label: Mutex::new("Stopwatch: 00:00:00 (stopped)".to_string()),
        }
    }
}

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItem::with_id(app, "tray-show-hide", "Hide", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "tray-pause", "Pause", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "tray-reset", "Reset", true, None::<&str>)?;

    let stopwatch_status = Submenu::with_id(
        app,
        "tray-stopwatch",
        "Stopwatch: 00:00:00 (stopped)",
        true,
    )?;
    stopwatch_status.append(&pause)?;
    stopwatch_status.append(&reset)?;

    let stored_settings = settings::load_settings(&app.handle()).unwrap_or_default();
    let click_through = CheckMenuItem::with_id(
        app,
        "tray-click-through",
        "Click-through",
        true,
        stored_settings.click_through,
        None::<&str>,
    )?;

    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart = CheckMenuItem::with_id(
        app,
        "tray-autostart",
        "Launch at startup",
        true,
        autostart_enabled,
        None::<&str>,
    )?;

    let quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_hide,
            &stopwatch_status,
            &separator,
            &click_through,
            &autostart,
            &separator,
            &quit,
        ],
    )?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("Missing default window icon")?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("Digital GuaiGuai")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if let Err(error) = handle_tray_menu_event(app, &event.id.as_ref()) {
                eprintln!("Tray menu handler error: {error}");
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(error) = toggle_window_visibility(tray.app_handle()) {
                    eprintln!("Tray click handler error: {error}");
                }
            }
        })
        .build(app)?;

    app.manage(TrayMenuState {
        show_hide,
        stopwatch_status,
        click_through,
        autostart,
    });
    app.manage(TrayStopwatchState::new());

    Ok(())
}

fn handle_tray_menu_event(app: &AppHandle, menu_id: &str) -> Result<(), String> {
    match menu_id {
        "tray-show-hide" => toggle_window_visibility(app),
        "tray-pause" => {
            app.emit("tray-pause", ())
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        "tray-reset" => {
            app.emit("tray-reset", ())
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        "tray-click-through" => toggle_click_through(app),
        "tray-autostart" => toggle_autostart(app),
        _ => Ok(()),
    }
}

pub fn toggle_window_visibility(app: &AppHandle) -> Result<(), String> {
    let window = get_main_window(app)?;
    let tray_state = app.state::<TrayMenuState<tauri::Wry>>();

    if window.is_visible().map_err(|e| e.to_string())? {
        window.hide().map_err(|e| e.to_string())?;
        tray_state
            .show_hide
            .set_text("Show")
            .map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        tray_state
            .show_hide
            .set_text("Hide")
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn update_stopwatch_status(app: &AppHandle, label: &str) -> Result<(), String> {
    let tray_state = app.state::<TrayMenuState<tauri::Wry>>();
    tray_state
        .stopwatch_status
        .set_text(label)
        .map_err(|e| e.to_string())?;

    if let Ok(mut cached) = app.state::<TrayStopwatchState>().label.lock() {
        *cached = label.to_string();
    }

    Ok(())
}

fn toggle_click_through(app: &AppHandle) -> Result<(), String> {
    let tray_state = app.state::<TrayMenuState<tauri::Wry>>();
    let enabled = tray_state
        .click_through
        .is_checked()
        .map_err(|e| e.to_string())?;

    let settings = AppSettings {
        click_through: enabled,
    };
    settings::save_settings(app, &settings)?;

    if let Ok(mut stored) = app.state::<Mutex<AppSettings>>().lock() {
        *stored = settings.clone();
    }

    app.emit("tray-click-through", enabled)
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn toggle_autostart(app: &AppHandle) -> Result<(), String> {
    let tray_state = app.state::<TrayMenuState<tauri::Wry>>();
    let enabled = tray_state
        .autostart
        .is_checked()
        .map_err(|e| e.to_string())?;

    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("Window '{MAIN_WINDOW_LABEL}' not found"))
}
