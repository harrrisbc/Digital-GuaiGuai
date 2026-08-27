use serde::{Deserialize, Serialize};
use tauri::{Monitor, PhysicalPosition, WebviewWindow};

pub const MAIN_WINDOW_LABEL: &str = "main";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenBottom {
    pub bottom_y: i32,
    pub monitor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetPosition {
    pub x: i32,
    pub y: i32,
    pub monitor_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionArgs {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePositionArgs {
    pub x: i32,
    pub y: i32,
    pub monitor_id: String,
}

pub fn monitor_id(monitor: &Monitor) -> String {
    monitor
        .name()
        .cloned()
        .unwrap_or_else(|| {
            let pos = monitor.position();
            format!("monitor-{}-{}", pos.x, pos.y)
        })
}

/// Returns the Y coordinate of the usable screen bottom (work area), excluding dock/taskbar.
pub fn get_work_area_bottom(monitor: &Monitor) -> i32 {
    let work_area = monitor.work_area();
    work_area.position.y + work_area.size.height as i32
}

pub fn get_screen_bottom(window: &WebviewWindow) -> Result<ScreenBottom, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found for window".to_string())?;

    Ok(ScreenBottom {
        bottom_y: get_work_area_bottom(&monitor),
        monitor_id: monitor_id(&monitor),
    })
}

pub fn set_window_position(window: &WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

pub fn get_pet_position(window: &WebviewWindow) -> Result<PetPosition, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found for window".to_string())?;

    Ok(PetPosition {
        x: position.x,
        y: position.y,
        monitor_id: monitor_id(&monitor),
    })
}

pub fn get_current_monitor(window: &WebviewWindow) -> Result<Option<Monitor>, String> {
    window.current_monitor().map_err(|e| e.to_string())
}

pub fn find_monitor_by_id(
    window: &WebviewWindow,
    target_monitor_id: &str,
) -> Result<Option<Monitor>, String> {
    let monitors = window
        .available_monitors()
        .map_err(|e| e.to_string())?;

    Ok(monitors.into_iter().find(|monitor| monitor_id(monitor) == target_monitor_id))
}

pub fn place_at_bottom_center(window: &WebviewWindow) -> Result<(), String> {
    let monitor = match window.current_monitor().map_err(|e| e.to_string())? {
        Some(monitor) => monitor,
        None => window
            .primary_monitor()
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "No monitor available".to_string())?,
    };

    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let x = work_area.position.x + (work_area.size.width as i32 - size.width as i32) / 2;
    let y = get_work_area_bottom(&monitor) - size.height as i32;

    set_window_position(window, x, y)
}
