use serde::{Deserialize, Serialize};
use tauri::{LogicalPosition, LogicalSize, Monitor, WebviewWindow};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeArgs {
    pub width: u32,
    pub height: u32,
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

/// Returns the Y coordinate of the usable screen bottom in logical points.
pub fn get_work_area_bottom_logical(window: &WebviewWindow, monitor: &Monitor) -> Result<i32, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let work_area = monitor.work_area();
    let bottom_physical = work_area.position.y + work_area.size.height as i32;
    Ok((bottom_physical as f64 / scale).round() as i32)
}

pub fn get_screen_bottom(window: &WebviewWindow) -> Result<ScreenBottom, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found for window".to_string())?;

    Ok(ScreenBottom {
        bottom_y: get_work_area_bottom_logical(window, &monitor)?,
        monitor_id: monitor_id(&monitor),
    })
}

pub fn set_window_position(window: &WebviewWindow, x: i32, y: i32) -> Result<(), String> {
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

pub fn set_window_size(window: &WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

pub fn get_pet_position(window: &WebviewWindow) -> Result<PetPosition, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No monitor found for window".to_string())?;

    Ok(PetPosition {
        x: (position.x as f64 / scale).round() as i32,
        y: (position.y as f64 / scale).round() as i32,
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

    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let work_area = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let logical_width = (size.width as f64 / scale).round() as i32;
    let logical_height = (size.height as f64 / scale).round() as i32;
    let work_x = (work_area.position.x as f64 / scale).round() as i32;
    let work_width = (work_area.size.width as f64 / scale).round() as i32;
    let bottom_y = get_work_area_bottom_logical(window, &monitor)?;
    let x = work_x + (work_width - logical_width) / 2;
    let y = bottom_y - logical_height;

    set_window_position(window, x, y)
}
