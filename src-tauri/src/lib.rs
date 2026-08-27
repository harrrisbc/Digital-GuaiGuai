mod persistence;
mod plugins;
mod tray;
mod window;

use persistence::{SavedPosition, load_position, save_position};
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use window::{
    MAIN_WINDOW_LABEL, PetPosition, PositionArgs, SavePositionArgs, ScreenBottom, get_pet_position,
    get_screen_bottom, set_window_position,
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
            tray::setup_tray(app)?;

            if let Err(error) = restore_saved_position(app.handle()) {
                eprintln!("Failed to restore saved position: {error}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_screen_bottom_cmd,
            set_pet_position,
            get_pet_position_cmd,
            save_position_cmd,
            load_position_cmd,
            update_tray_stopwatch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
