#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notify;

use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

const APP_ICON: &[u8] = include_bytes!("../icons/128x128@2x.png");
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_NAME: &str = "Subscriptions+";

struct Tray(Mutex<Option<TrayIcon>>);
/// When the tray panel last hid itself on focus loss (a tray click right after must not reopen it).
struct TrayHidden(Mutex<Option<Instant>>);

const TRAY_TITLE: &str = "Subscriptions+ Tray";
const TRAY_W: f64 = 340.0;
const TRAY_H: f64 = 480.0;

/// Everything the app stores lives in a `data` folder next to the executable.
fn data_dir() -> PathBuf {
    let exe = std::env::current_exe().expect("exe path");
    let dir = exe.parent().expect("exe dir").join("data");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn data_file() -> PathBuf {
    data_dir().join("subscriptions.json")
}

#[tauri::command]
fn load_data() -> Result<Option<String>, String> {
    match fs::read_to_string(data_file()) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_data(json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("invalid data: {e}"))?;
    let tmp = data_dir().join("subscriptions.json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, data_file()).map_err(|e| e.to_string())
}

/// Saves a backup chosen by the user. Async so the blocking dialog runs off the main thread.
#[tauri::command]
async fn export_data(json: String, name: String, app: AppHandle) -> Result<bool, String> {
    let mut dialog = app.dialog().file().set_title("Export Subscriptions+ Data").set_file_name(name).add_filter("JSON", &["json"]);
    if let Some(w) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&w);
    }
    let Some(path) = dialog.blocking_save_file() else { return Ok(false) };
    fs::write(path.into_path().map_err(|e| e.to_string())?, json).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Reads a backup chosen by the user; None when cancelled. Validation happens in the frontend.
#[tauri::command]
async fn import_data(app: AppHandle) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_title("Import Subscriptions+ Data").add_filter("JSON", &["json"]);
    if let Some(w) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&w);
    }
    let Some(path) = dialog.blocking_pick_file() else { return Ok(None) };
    fs::read_to_string(path.into_path().map_err(|e| e.to_string())?).map(Some).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[allow(non_snake_case)]
struct Rates {
    USD: f64,
    BRL: f64,
    date: String,
}

#[tauri::command]
async fn fetch_rates() -> Result<Rates, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let urls = [
            "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,BRL",
            "https://api.frankfurter.app/latest?from=EUR&to=USD,BRL",
        ];
        let mut last_err = String::new();
        for url in urls {
            match ureq::get(url).timeout(std::time::Duration::from_secs(8)).call() {
                Ok(resp) => {
                    let body = resp.into_string().map_err(|e| e.to_string())?;
                    let v: serde_json::Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
                    let r = &v["rates"];
                    if let (Some(usd), Some(brl)) = (r["USD"].as_f64(), r["BRL"].as_f64()) {
                        return Ok(Rates { USD: usd, BRL: brl, date: v["date"].as_str().unwrap_or("").into() });
                    }
                    last_err = "unexpected response".into();
                }
                Err(e) => last_err = e.to_string(),
            }
        }
        Err(last_err)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn schedule_notifications(items: Vec<notify::ToastItem>) -> Result<(), String> {
    notify::schedule(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn test_notification() -> Result<(), String> {
    notify::show_now("Subscriptions+", "Notifications are working. You will be reminded before each charge.")
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(RUN_KEY).map_err(|e| e.to_string())?;
    if enabled {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        key.set_value(RUN_NAME, &format!("\"{}\" --tray", exe.display())).map_err(|e| e.to_string())
    } else {
        match key.delete_value(RUN_NAME) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
            _ => Ok(()),
        }
    }
}

#[tauri::command]
fn update_tray(tooltip: String, tray: State<Tray>) -> Result<(), String> {
    if let Some(t) = tray.0.lock().unwrap().as_ref() {
        t.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_action(action: String, app: AppHandle) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("no window")?;
    match action.as_str() {
        "minimize" => w.minimize(),
        _ => w.hide(),
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_main(action: Option<String>, app: AppHandle) {
    if let Some(t) = app.get_webview_window("tray") {
        let _ = t.hide();
    }
    show_main(&app);
    if let Some(a) = action {
        let _ = app.emit_to("main", "tray-action", a);
    }
}

/// Shows the tray panel just above (or below) the clicked tray icon, inside the monitor work area.
fn toggle_tray_panel(app: &AppHandle, click: PhysicalPosition<f64>) {
    let Some(panel) = app.get_webview_window("tray") else { return };
    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }
    if let Some(at) = *app.state::<TrayHidden>().0.lock().unwrap() {
        if at.elapsed() < Duration::from_millis(350) {
            return;
        }
    }
    let scale = panel.scale_factor().unwrap_or(1.0);
    let (w, h) = (TRAY_W * scale, TRAY_H * scale);
    let margin = 12.0 * scale;
    let (mut x, mut y) = (click.x - w / 2.0, click.y - h - margin);
    if let Ok(Some(mon)) = app.monitor_from_point(click.x, click.y) {
        let area = mon.work_area();
        let (ax, ay) = (area.position.x as f64, area.position.y as f64);
        let (aw, ah) = (area.size.width as f64, area.size.height as f64);
        x = x.clamp(ax + margin, ax + aw - w - margin);
        if y < ay + margin {
            y = click.y + margin; // taskbar at the top
        }
        y = y.clamp(ay + margin, ay + ah - h - margin);
    }
    let _ = panel.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
    let _ = panel.show();
    let _ = panel.set_focus();
    let _ = app.emit_to("tray", "tray-shown", ());
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn main() {
    let start_hidden = std::env::args().any(|a| a == "--tray");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .manage(Tray(Mutex::new(None)))
        .manage(TrayHidden(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            export_data,
            import_data,
            fetch_rates,
            schedule_notifications,
            test_notification,
            set_autostart,
            update_tray,
            window_action,
            open_main
        ])
        .setup(move |app| {
            // App identity for toasts: icon written next to the data file.
            let icon_path = data_dir().join("icon.png");
            if fs::metadata(&icon_path).map(|m| m.len() != APP_ICON.len() as u64).unwrap_or(true) {
                let _ = fs::write(&icon_path, APP_ICON);
            }
            if let Err(e) = notify::register(&icon_path) {
                eprintln!("toast registration failed: {e}");
            }

            let open = MenuItem::with_id(app, "open", "Open Subscriptions+", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &PredefinedMenuItem::separator(app)?, &quit])?;
            let tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("icon"))
                .tooltip("Subscriptions+")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, position, .. } => {
                        toggle_tray_panel(tray.app_handle(), position);
                    }
                    TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                        if let Some(t) = tray.app_handle().get_webview_window("tray") {
                            let _ = t.hide();
                        }
                        show_main(tray.app_handle());
                    }
                    _ => {}
                })
                .build(app)?;
            *app.state::<Tray>().0.lock().unwrap() = Some(tray);

            WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("index.html".into()))
                // Distinct title so window managers (komorebi) can ignore just this flyout.
                .title(TRAY_TITLE)
                .inner_size(TRAY_W, TRAY_H)
                .decorations(false)
                .resizable(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .visible(false)
                .focused(false)
                .theme(Some(tauri::Theme::Dark))
                .background_color(tauri::window::Color(42, 42, 42, 255))
                .build()?;

            if !start_hidden {
                show_main(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing keeps the app in the tray; quit from the tray menu.
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            // The tray panel behaves like a flyout: it disappears when it loses focus.
            WindowEvent::Focused(false) if window.label() == "tray" => {
                let _ = window.hide();
                *window.app_handle().state::<TrayHidden>().0.lock().unwrap() = Some(Instant::now());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Subscriptions+");
}
