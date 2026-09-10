#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod branding;
mod desktop;
mod displays;
mod history;
mod library;
use library::{Album, Library, Settings};
use std::{path::PathBuf, process::Command, sync::Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
struct DesktopMenu(MenuItem<tauri::Wry>);
fn desktop_action(enabled: bool) -> &'static str {
    if enabled {
        "Hide desktop"
    } else {
        "Show desktop"
    }
}
struct Store {
    dir: PathBuf,
    library: Mutex<Library>,
}
fn editor(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("Open the library window to make changes".into())
    }
}
fn broadcast(app: &tauri::AppHandle, library: &Library) {
    let handle = app.clone();
    let enabled = library.settings.desktop_enabled;
    let _ = app.run_on_main_thread(move || {
        if let Some(menu) = handle.try_state::<DesktopMenu>() {
            let _ = menu.0.set_text(desktop_action(enabled));
        }
    });
    let _ = app.emit("library-changed", library);
}
#[tauri::command]
fn get_displays(
    window: tauri::WebviewWindow,
    store: State<Store>,
) -> Result<Vec<displays::DisplayInfo>, String> {
    displays::detect(&window, &store.dir)
}
#[tauri::command]
fn get_library(store: State<Store>) -> Result<serde_json::Value, String> {
    Ok(
        serde_json::json!({"library":store.library.lock().map_err(|e|e.to_string())?.clone(),"dataDir":store.dir.to_string_lossy()}),
    )
}
#[tauri::command]
fn save_settings(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    store: State<Store>,
    settings: Settings,
) -> Result<(), String> {
    editor(&window)?;
    library::validate_settings(&settings)?;
    let mut lib = store.library.lock().map_err(|e| e.to_string())?;
    let before = lib.settings.clone();
    let mut updated = lib.clone();
    updated.settings = settings;
    library::save(&store.dir, &updated)?;
    *lib = updated;
    broadcast(&app, &lib);
    let after = lib.settings.clone();
    drop(lib);
    apply_settings_effects(&app, &before, &after)
}

fn apply_settings_effects(
    app: &tauri::AppHandle,
    before: &Settings,
    after: &Settings,
) -> Result<(), String> {
    let logo_changed = before.logo != after.logo;
    let changed =
        before.desktop_enabled != after.desktop_enabled || before.all_spaces != after.all_spaces;
    let logo = after.logo;
    let enabled = after.desktop_enabled;
    let all_spaces = after.all_spaces;
    if logo_changed {
        let a = app.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = branding::apply(&a, logo, true) {
                let _ = a.emit("app-error", e);
            }
        })
        .map_err(|e| e.to_string())?;
    }
    if changed {
        let a = app.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = desktop::rebuild(&a, enabled, all_spaces) {
                let _ = a.emit("app-error", e);
            }
        })
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
async fn get_history(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<history::HistoryView, String> {
    editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let _library = store.library.lock().map_err(|e| e.to_string())?;
        history::list(&store.dir)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn navigate_history(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    action: String,
    id: Option<usize>,
) -> Result<history::HistoryView, String> {
    editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let mut library = store.library.lock().map_err(|e| e.to_string())?;
        let before = library.settings.clone();
        let (restored, history) = history::navigate(&store.dir, &action, id)?;
        *library = restored;
        broadcast(&app, &library);
        let after = library.settings.clone();
        drop(library);
        apply_settings_effects(&app, &before, &after)?;
        Ok(history)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn import_images(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<library::ImportResult, String> {
    editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let mut lib = store.library.lock().map_err(|e| e.to_string())?;
        let result = library::import(
            &store.dir,
            &mut lib,
            paths.into_iter().map(PathBuf::from).collect(),
        )?;
        broadcast(&app, &lib);
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn choose_images(window: tauri::WebviewWindow, single: bool) -> Result<Vec<String>, String> {
    editor(&window)?;
    let dialog = rfd::AsyncFileDialog::new()
        .set_title("Choose artwork")
        .add_filter(
            "Artwork",
            &["png", "jpg", "jpeg", "webp", "gif", "tiff", "bmp"],
        );
    let files = if single {
        dialog.pick_file().await.into_iter().collect()
    } else {
        dialog.pick_files().await.unwrap_or_default()
    };
    Ok(files
        .into_iter()
        .map(|f| f.path().to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
fn update_album(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    store: State<Store>,
    album: Album,
) -> Result<(), String> {
    editor(&window)?;
    if album.title.trim().is_empty() {
        return Err("Give this album a title".into());
    }
    if !album.url.is_empty() {
        let u = tauri::Url::parse(&album.url).map_err(|_| "Enter a valid https URL")?;
        if u.scheme() != "https" {
            return Err("Album links must use HTTPS".into());
        }
    }
    let mut lib = store.library.lock().map_err(|e| e.to_string())?;
    let mut updated = lib.clone();
    let original = updated
        .albums
        .iter_mut()
        .find(|a| a.id == album.id)
        .ok_or("Album not found")?;
    original.title = album.title;
    original.artist = album.artist;
    original.date = album.date;
    original.url = album.url;
    original.enabled = album.enabled;
    library::save(&store.dir, &updated)?;
    *lib = updated;
    broadcast(&app, &lib);
    Ok(())
}
#[tauri::command]
fn remove_album(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    store: State<Store>,
    id: String,
) -> Result<(), String> {
    editor(&window)?;
    let mut lib = store.library.lock().map_err(|e| e.to_string())?;
    let mut updated = lib.clone();
    updated.albums.retain(|a| a.id != id);
    library::save(&store.dir, &updated)?;
    *lib = updated;
    broadcast(&app, &lib);
    Ok(())
}
#[tauri::command]
async fn open_album(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let lib = store.library.lock().map_err(|e| e.to_string())?;
        let album = lib
            .albums
            .iter()
            .find(|a| a.id == id)
            .ok_or("Album not found")?
            .clone();
        let mode = lib.settings.open_mode.clone();
        drop(lib);
        if mode == "link" && !album.url.is_empty() {
            let u = tauri::Url::parse(&album.url).map_err(|e| e.to_string())?;
            if u.scheme() != "https" {
                return Err("Only HTTPS album links are supported".into());
            }
            let status = Command::new("open")
                .arg(&album.url)
                .status()
                .map_err(|e| e.to_string())?;
            return if status.success() {
                Ok(())
            } else {
                Err("Could not open album link".into())
            };
        }
        // Pass user text as argv, never interpolate it into AppleScript or shell code.
        let script = include_str!("open_album.applescript");
        let output = Command::new("osascript")
            .args(["-e", script, "--", &album.title, &album.artist])
            .output()
            .map_err(|e| e.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).trim().to_owned())
        }
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|result| result);
    if let Err(error) = result {
        let message = if error.contains("-1743") {
            "Allow Plinth to control Music in System Settings → Privacy & Security → Automation."
        } else {
            "Apple Music couldn’t open this album. Check that it is in your library, or add an album link in Plinth."
        };
        show_alert(message.into()).await?;
    }
    Ok(())
}
#[tauri::command]
async fn replace_artwork(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    id: String,
    path: String,
) -> Result<Album, String> {
    editor(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let store = app.state::<Store>();
        let mut lib = store.library.lock().map_err(|e| e.to_string())?;
        let album = library::replace_artwork(&store.dir, &mut lib, &id, &PathBuf::from(path))?;
        broadcast(&app, &lib);
        Ok(album)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn reveal_artwork(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    editor(&window)?;
    let source = {
        let store = app.state::<Store>();
        let lib = store.library.lock().map_err(|e| e.to_string())?;
        let album = lib
            .albums
            .iter()
            .find(|album| album.id == id)
            .ok_or("Album not found")?;
        store.dir.join("originals").join(&album.original)
    };
    tauri::async_runtime::spawn_blocking(move || {
        if !source.is_file() {
            return Err("Original artwork not found".into());
        }
        let status = Command::new("open")
            .arg("-R")
            .arg(source)
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("Finder could not reveal the artwork".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn show_alert(message: String) -> Result<(), String> {
    rfd::AsyncMessageDialog::new()
        .set_title("Plinth")
        .set_description(message)
        .set_level(rfd::MessageLevel::Warning)
        .show()
        .await;
    Ok(())
}
#[tauri::command]
fn reveal_data(window: tauri::WebviewWindow, store: State<Store>) -> Result<(), String> {
    editor(&window)?;
    Command::new("open")
        .arg(&store.dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
fn remember_window_size(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if let (Ok(size), Ok(scale)) = (w.inner_size(), w.scale_factor()) {
            if size.width == 0 || size.height == 0 {
                return;
            }
            let dir = library::data_dir();
            let _ = std::fs::create_dir_all(&dir);
            let value = serde_json::json!({"width":size.width as f64/scale,"height":size.height as f64/scale});
            if std::fs::write(dir.join("window.json.tmp"), value.to_string()).is_ok() {
                let _ = std::fs::rename(dir.join("window.json.tmp"), dir.join("window.json"));
            }
        }
    }
}
fn restore_window_size(app: &tauri::AppHandle) {
    let result = (|| -> Option<()> {
        let data = std::fs::read(library::data_dir().join("window.json")).ok()?;
        let size: serde_json::Value = serde_json::from_slice(&data).ok()?;
        let w = app.get_webview_window("main")?;
        let width = size["width"].as_f64()?;
        let height = size["height"].as_f64()?;
        if !width.is_finite() || !height.is_finite() {
            return None;
        }
        let monitor = w.current_monitor().ok()??;
        let scale = monitor.scale_factor();
        let max_width = (monitor.size().width as f64 / scale).max(640.);
        let max_height = (monitor.size().height as f64 / scale - 50.).max(500.);
        let _ = w.set_size(tauri::LogicalSize::new(
            width.clamp(640., max_width),
            height.clamp(500., max_height),
        ));
        let _ = w.center();
        Some(())
    })();
    let _ = result;
}
fn show_main(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    let logo = app.state::<Store>().library.lock().unwrap().settings.logo;
    if let Err(e) = branding::apply(app, logo, false) {
        let _ = app.emit("app-error", e);
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}
fn hide_main(app: &tauri::AppHandle) {
    remember_window_size(app);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}
fn request_quit(app: &tauri::AppHandle) {
    show_main(app);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.emit("request-quit", ());
    }
}
#[tauri::command]
fn hide_window(window: tauri::WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    editor(&window)?;
    hide_main(&app);
    Ok(())
}
#[tauri::command]
fn quit_app(window: tauri::WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    editor(&window)?;
    remember_window_size(&app);
    app.exit(0);
    Ok(())
}

fn main() {
    let dir = library::data_dir();
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--import") {
        let result = (|| -> Result<(), String> {
            let path = args
                .get(2)
                .ok_or("Usage: plinth --import IMAGE [--settings JSON_FILE]")?;
            let mut lib = library::load(&dir)?;
            let r = library::import(&dir, &mut lib, vec![PathBuf::from(path)])?;
            if args.get(3).map(String::as_str) == Some("--settings") {
                let s = args.get(4).ok_or("Missing settings file")?;
                lib.settings =
                    serde_json::from_slice(&std::fs::read(s).map_err(|e| e.to_string())?)
                        .map_err(|e| e.to_string())?;
                library::validate_settings(&lib.settings)?;
                library::save(&dir, &lib)?;
            }
            println!("{}", serde_json::to_string(&r).unwrap());
            Ok(())
        })();
        if let Err(e) = result {
            eprintln!("{e}");
            std::process::exit(1);
        }
        return;
    }
    let lib = library::load(&dir).unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(1)
    });
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .manage(Store {
            dir,
            library: Mutex::new(lib),
        })
        .invoke_handler(tauri::generate_handler![
            hide_window,
            quit_app,
            replace_artwork,
            reveal_artwork,
            show_alert,
            get_displays,
            get_library,
            get_history,
            navigate_history,
            save_settings,
            import_images,
            choose_images,
            update_album,
            remove_album,
            open_album,
            reveal_data
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            let open = MenuItem::with_id(app, "open", "Open Plinth", true, None::<&str>)?;
            let enabled = app
                .state::<Store>()
                .library
                .lock()
                .unwrap()
                .settings
                .desktop_enabled;
            let toggle =
                MenuItem::with_id(app, "toggle", desktop_action(enabled), true, None::<&str>)?;
            app.manage(DesktopMenu(toggle.clone()));
            let quit = MenuItem::with_id(app, "quit", "Quit Plinth", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &toggle, &quit])?;
            let logo = app.state::<Store>().library.lock().unwrap().settings.logo;
            TrayIconBuilder::with_id("plinth")
                .icon(logo.tray()?)
                .icon_as_template(false)
                .tooltip("Plinth — your records, on your desktop")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => request_quit(app),
                    "toggle" => {
                        let store = app.state::<Store>();
                        if let Ok(mut lib) = store.library.lock() {
                            let mut updated = lib.clone();
                            updated.settings.desktop_enabled = !updated.settings.desktop_enabled;
                            if library::save(&store.dir, &updated).is_ok() {
                                *lib = updated;
                                broadcast(app, &lib);
                                let _ = desktop::rebuild(
                                    app,
                                    lib.settings.desktop_enabled,
                                    lib.settings.all_spaces,
                                );
                            }
                        };
                    }
                    _ => {}
                })
                .build(app)?;
            let settings = app
                .state::<Store>()
                .library
                .lock()
                .unwrap()
                .settings
                .clone();
            desktop::rebuild(app.handle(), settings.desktop_enabled, settings.all_spaces)?;
            desktop::start_pointer_tracking(app.handle().clone());
            if let Err(e) = branding::apply(app.handle(), logo, true) {
                eprintln!("{e}");
            }
            restore_window_size(app.handle());
            show_main(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    hide_main(window.app_handle());
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Could not build Plinth")
        .run(|app, event| match event {
            tauri::RunEvent::ExitRequested {
                api, code: None, ..
            } => {
                api.prevent_exit();
                request_quit(app);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => show_main(app),
            _ => {}
        });
}
