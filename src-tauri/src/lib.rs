mod mouse_hook;
mod persistence;
mod plugins;
mod settings;
mod tray;
mod window;

use std::sync::Mutex;

use persistence::{SavedPosition, load_position, save_position};
use settings::{AppSettings, load_settings, save_settings};
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use window::{
    MAIN_WINDOW_LABEL, PetPosition, PositionArgs, SavePositionArgs, ScreenBottom, SizeArgs,
    get_pet_position, get_screen_bottom, set_window_position, set_window_size,
};

#[tauri::command]
fn get_screen_bottom_cmd(window: tauri::WebviewWindow) -> Result<ScreenBottom, String> {
    get_screen_bottom(&window)
}

#[tauri::command]
fn set_pet_position(window: tauri::WebviewWindow, args: PositionArgs) -> Result<(), String> {
    set_window_position(&window, args.x, args.y)
}

#[tauri::command]
fn get_pet_position_cmd(window: tauri::WebviewWindow) -> Result<PetPosition, String> {
    get_pet_position(&window)
}

#[tauri::command]
fn save_position_cmd(app: tauri::AppHandle, args: SavePositionArgs) -> Result<(), String> {
    save_position(
        &app,
        &SavedPosition {
            x: args.x,
            y: args.y,
            monitor_id: args.monitor_id,
        },
    )
}

#[tauri::command]
fn load_position_cmd(app: tauri::AppHandle) -> Result<Option<SavedPosition>, String> {
    load_position(&app)
}

#[tauri::command]
fn update_tray_stopwatch(app: tauri::AppHandle, label: String) -> Result<(), String> {
    tray::update_stopwatch_status(&app, &label)
}

#[tauri::command]
fn set_window_size_cmd(window: tauri::WebviewWindow, args: SizeArgs) -> Result<(), String> {
    set_window_size(&window, args.width, args.height)
}

#[tauri::command]
fn load_settings_cmd(app: tauri::AppHandle) -> Result<AppSettings, String> {
    load_settings(&app)
}

#[tauri::command]
fn save_settings_cmd(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    save_settings(&app, &settings)
}

fn restore_saved_position(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| format!("Window '{MAIN_WINDOW_LABEL}' not found"))?;

    if let Some(saved) = load_position(app)? {
        if window::find_monitor_by_id(&window, &saved.monitor_id)?.is_some() {
            set_window_position(&window, saved.x, saved.y)?;
            return Ok(());
        }
    }

    window::place_at_bottom_center(&window)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(plugins::PluginRegistry::new())
        .setup(|app| {
            let settings = load_settings(app.handle()).unwrap_or_default();
            app.manage(Mutex::new(settings));

            tray::setup_tray(app)?;

            if let Err(error) = restore_saved_position(app.handle()) {
                eprintln!("Failed to restore saved position: {error}");
            }

            mouse_hook::start_mouse_hook(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screen_bottom_cmd,
            set_pet_position,
            get_pet_position_cmd,
            save_position_cmd,
            load_position_cmd,
            update_tray_stopwatch,
            set_window_size_cmd,
            load_settings_cmd,
            save_settings_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
