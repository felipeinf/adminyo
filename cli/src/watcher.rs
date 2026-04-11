use notify::{Event, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::runtime::Handle;

use crate::server::routes::reload_config_async;
use crate::state::AppState;

pub fn spawn_config_watcher(
    config_dir: PathBuf,
    active_env: String,
    state: Arc<AppState>,
    handle: Handle,
) -> Result<notify::RecommendedWatcher, notify::Error> {
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            for p in event.paths {
                if let Some(name) = p.file_name().and_then(|s| s.to_str()) {
                    if name == "adminyo.yml" || name == "envs.yml" {
                        let _ = tx.send(());
                        break;
                    }
                }
            }
        }
    })?;
    let p1 = config_dir.join("adminyo.yml");
    let p2 = config_dir.join("envs.yml");
    if p1.exists() {
        let _ = watcher.watch(&p1, RecursiveMode::NonRecursive);
    }
    if p2.exists() {
        let _ = watcher.watch(&p2, RecursiveMode::NonRecursive);
    }
    let state_th = state.clone();
    let env_th = active_env.clone();
    std::thread::spawn(move || {
        let mut last_fire = Instant::now() - Duration::from_secs(60);
        while rx.recv().is_ok() {
            if last_fire.elapsed() < Duration::from_millis(250) {
                continue;
            }
            last_fire = Instant::now();
            let st = state_th.clone();
            let env = env_th.clone();
            handle.spawn(async move {
                match reload_config_async(&st, &env).await {
                    Ok(()) => {
                        let _ = st.ws_tx.send(r#"{"type":"config-reload"}"#.to_string());
                    }
                    Err(e) => tracing::error!("config reload failed: {e}"),
                }
            });
        }
    });
    Ok(watcher)
}
