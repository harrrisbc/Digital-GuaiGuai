use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPosition {
    pub x: i32,
    pub y: i32,
    pub monitor_id: String,
}

const POSITION_FILE: &str = "position.json";

fn position_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;

    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join(POSITION_FILE))
}

pub fn save_position(app: &AppHandle, position: &SavedPosition) -> Result<(), String> {
    let path = position_path(app)?;
    let json = serde_json::to_string_pretty(position).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn load_position(app: &AppHandle) -> Result<Option<SavedPosition>, String> {
    let path = position_path(app)?;

    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let position = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(position))
}
