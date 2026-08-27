use std::time::Duration;

pub trait BackstagePlugin: Send + Sync {
    fn name(&self) -> &str;
    fn on_tick(&mut self, elapsed: Duration);
    fn send_command(&self, cmd: &str) -> Result<(), String>;
}

pub struct PluginRegistry {
    plugins: Vec<Box<dyn BackstagePlugin>>,
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }

    pub fn register(&mut self, plugin: Box<dyn BackstagePlugin>) {
        self.plugins.push(plugin);
    }

    pub fn plugins(&self) -> &[Box<dyn BackstagePlugin>] {
        &self.plugins
    }
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}
