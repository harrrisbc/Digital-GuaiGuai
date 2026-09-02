use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::window::MAIN_WINDOW_LABEL;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MouseMovePayload {
    pub x: f64,
    pub y: f64,
}

/// Listen for global mouse moves and emit them to the main webview for click-through hit testing.
pub fn start_mouse_hook(app: AppHandle) {
    std::thread::spawn(move || {
        if let Err(error) = rdev::listen(move |event| {
            if let rdev::EventType::MouseMove { x, y } = event.event_type {
                let _ = app.emit_to(MAIN_WINDOW_LABEL, "device-mouse-move", MouseMovePayload { x, y });
            }
        }) {
            eprintln!("Global mouse hook stopped: {error:?}");
        }
    });
}
