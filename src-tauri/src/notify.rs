//! Windows toast notifications for an unpackaged app: the AppUserModelID is
//! registered under HKCU so scheduled toasts fire even while the app is closed.

use serde::Deserialize;
use std::path::Path;
use windows::core::HSTRING;
use windows::Data::Xml::Dom::XmlDocument;
use windows::Foundation::DateTime;
use windows::UI::Notifications::{ScheduledToastNotification, ToastNotification, ToastNotificationManager, ToastNotifier};
use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

pub const AUMID: &str = "ErickBode.SubscriptionsPlus";

#[derive(Deserialize)]
pub struct ToastItem {
    pub id: String,
    pub title: String,
    pub body: String,
    /// Unix time in milliseconds.
    pub at: i64,
}

/// Registers the app identity (name + icon shown on toasts) and binds this process to it.
pub fn register(icon_png: &Path) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(format!(r"Software\Classes\AppUserModelId\{AUMID}"))
        .map_err(|e| e.to_string())?;
    key.set_value("DisplayName", &"Subscriptions+").map_err(|e| e.to_string())?;
    key.set_value("IconUri", &icon_png.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    key.set_value("IconBackgroundColor", &"FF232323").map_err(|e| e.to_string())?;
    unsafe { SetCurrentProcessExplicitAppUserModelID(&HSTRING::from(AUMID)) }.map_err(|e| e.to_string())
}

fn notifier() -> windows::core::Result<ToastNotifier> {
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(AUMID))
}

fn escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn xml(title: &str, body: &str) -> windows::core::Result<XmlDocument> {
    let doc = XmlDocument::new()?;
    doc.LoadXml(&HSTRING::from(format!(
        r#"<toast><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual></toast>"#,
        escape(title),
        escape(body)
    )))?;
    Ok(doc)
}

/// Replaces every scheduled reminder with the given list.
pub fn schedule(items: &[ToastItem]) -> windows::core::Result<()> {
    let n = notifier()?;
    for old in n.GetScheduledToastNotifications()? {
        let _ = n.RemoveFromSchedule(&old);
    }
    for item in items {
        // FILETIME: 100ns ticks since 1601-01-01.
        let when = DateTime { UniversalTime: item.at * 10_000 + 116_444_736_000_000_000 };
        let toast = ScheduledToastNotification::CreateScheduledToastNotification(&xml(&item.title, &item.body)?, when)?;
        toast.SetId(&HSTRING::from(item.id.as_str()))?;
        n.AddToSchedule(&toast)?;
    }
    Ok(())
}

pub fn show_now(title: &str, body: &str) -> windows::core::Result<()> {
    let toast = ToastNotification::CreateToastNotification(&xml(title, body)?)?;
    notifier()?.Show(&toast)
}
