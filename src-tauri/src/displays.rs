use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: u32,
    pub width: u64,
    pub height: u64,
    pub logical_width: u64,
    pub logical_height: u64,
    #[serde(default)]
    pub menu_bar_height: f64,
    pub built_in: bool,
    pub current: bool,
    pub remembered: bool,
}
impl DisplayInfo {
    fn valid(&self) -> bool {
        [
            self.width,
            self.height,
            self.logical_width,
            self.logical_height,
        ]
        .iter()
        .all(|n| (1..=32768).contains(n))
    }
}

// Older caches could contain a sleeping or mirrored panel's borrowed mode.
// Require a fresh, independently active panel reading before trusting dimensions.
#[derive(Serialize, Deserialize)]
struct InternalDisplayCache {
    version: u8,
    display: DisplayInfo,
}

fn remember_internal(displays: &mut Vec<DisplayInfo>, path: &Path) {
    if let Some(internal) = displays.iter().find(|d| d.built_in && d.valid()) {
        let mut saved = internal.clone();
        saved.current = false;
        saved.remembered = true;
        if let Ok(bytes) = serde_json::to_vec(&InternalDisplayCache {
            version: 1,
            display: saved,
        }) {
            if std::fs::read(path).ok().as_ref() != Some(&bytes) {
                let _ = std::fs::write(path, bytes);
            }
        }
    } else if let Ok(bytes) = std::fs::read(path) {
        if let Ok(cache) = serde_json::from_slice::<InternalDisplayCache>(&bytes) {
            let mut saved = cache.display;
            if cache.version == 1 && saved.built_in && saved.valid() {
                saved.current = false;
                saved.remembered = true;
                displays.push(saved);
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub fn detect(window: &tauri::WebviewWindow, dir: &Path) -> Result<Vec<DisplayInfo>, String> {
    use core_graphics::display::CGDisplay;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSScreen, NSWindow};
    use objc2_foundation::{ns_string, NSNumber};
    // Unlike NSScreen / available_monitors, this includes sleeping and mirrored panels.
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGGetOnlineDisplayList(max: u32, displays: *mut u32, count: *mut u32) -> i32;
    }
    let ptr = window.ns_window().map_err(|e| e.to_string())?;
    let ns = unsafe { &*ptr.cast::<NSWindow>() };
    let current = ns.screen().and_then(|s| {
        s.deviceDescription()
            .objectForKey(ns_string!("NSScreenNumber"))
            .and_then(|n| n.downcast_ref::<NSNumber>().map(|n| n.unsignedIntValue()))
    });
    let mut count = 0;
    if unsafe { CGGetOnlineDisplayList(0, std::ptr::null_mut(), &mut count) } != 0 {
        return Err("Could not detect displays".into());
    }
    let mut ids = vec![0; count as usize];
    if unsafe { CGGetOnlineDisplayList(count, ids.as_mut_ptr(), &mut count) } != 0 {
        return Err("Could not detect displays".into());
    }
    ids.truncate(count as usize);
    let mtm = MainThreadMarker::new().ok_or("Display detection requires the main thread")?;
    let screens = NSScreen::screens(mtm);
    let mut displays = Vec::new();
    for id in ids {
        let display = CGDisplay::new(id);
        // Online includes closed-lid and mirrored panels. Their mode need not
        // describe the panel independently, so never use it to refresh the cache.
        if display.is_builtin() && (!display.is_active() || display.is_in_mirror_set()) {
            continue;
        }
        if let Some(mode) = display.display_mode() {
            let info = DisplayInfo {
                id,
                width: mode.pixel_width(),
                height: mode.pixel_height(),
                logical_width: mode.width(),
                logical_height: mode.height(),
                menu_bar_height: screens
                    .iter()
                    .find(|screen| {
                        screen
                            .deviceDescription()
                            .objectForKey(ns_string!("NSScreenNumber"))
                            .and_then(|number| {
                                number
                                    .downcast_ref::<NSNumber>()
                                    .map(|number| number.unsignedIntValue())
                            })
                            == Some(id)
                    })
                    .map(|screen| {
                        let frame = screen.frame();
                        let visible = screen.visibleFrame();
                        (frame.origin.y + frame.size.height
                            - visible.origin.y
                            - visible.size.height)
                            .max(0.)
                    })
                    .unwrap_or(0.),
                built_in: display.is_builtin(),
                current: current == Some(id),
                remembered: false,
            };
            if info.valid() {
                displays.push(info);
            }
        }
    }
    let _ = std::fs::create_dir_all(dir);
    remember_internal(&mut displays, &dir.join("internal-display.json"));
    Ok(displays)
}

#[cfg(not(target_os = "macos"))]
pub fn detect(window: &tauri::WebviewWindow, _dir: &Path) -> Result<Vec<DisplayInfo>, String> {
    let current = window.current_monitor().map_err(|e| e.to_string())?;
    Ok(window
        .available_monitors()
        .map_err(|e| e.to_string())?
        .iter()
        .enumerate()
        .map(|(id, m)| DisplayInfo {
            id: id as u32,
            width: m.size().width as u64,
            height: m.size().height as u64,
            logical_width: (m.size().width as f64 / m.scale_factor()) as u64,
            logical_height: (m.size().height as f64 / m.scale_factor()) as u64,
            menu_bar_height: 0.,
            built_in: false,
            current: current.as_ref() == Some(m),
            remembered: false,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_legacy_cache_with_external_dimensions() {
        let path =
            std::env::temp_dir().join(format!("plinth-legacy-display-{}.json", std::process::id()));
        std::fs::write(&path, br#"{"id":1,"width":3840,"height":2160,"logicalWidth":1920,"logicalHeight":1080,"menuBarHeight":0.0,"builtIn":true,"current":false,"remembered":true}"#).unwrap();
        let mut displays = vec![];
        remember_internal(&mut displays, &path);
        assert!(displays.is_empty());
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn remembers_internal_panel_without_marking_it_as_current() {
        let path = std::env::temp_dir().join(format!("plinth-display-{}.json", std::process::id()));
        let panel = DisplayInfo {
            id: 1,
            width: 3024,
            height: 1964,
            logical_width: 1512,
            logical_height: 982,
            menu_bar_height: 37.,
            built_in: true,
            current: true,
            remembered: false,
        };
        // A fresh panel reading replaces even a pre-upgrade cache.
        std::fs::write(&path, b"legacy cache").unwrap();
        remember_internal(&mut vec![panel.clone()], &path);
        let mut offline = vec![];
        remember_internal(&mut offline, &path);
        assert_eq!(offline[0].width, 3024);
        assert!(offline[0].remembered);
        assert!(!offline[0].current);
        let external = DisplayInfo {
            id: 2,
            width: 3840,
            height: 2160,
            logical_width: 1920,
            logical_height: 1080,
            built_in: false,
            ..panel
        };
        let mut connected = vec![external.clone()];
        remember_internal(&mut connected, &path);
        assert_eq!(connected[0], external);
        assert_eq!(connected[1], offline[0]);
        let mut cache: InternalDisplayCache =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        cache.version = 99;
        std::fs::write(&path, serde_json::to_vec(&cache).unwrap()).unwrap();
        let mut unknown_version = vec![];
        remember_internal(&mut unknown_version, &path);
        assert!(unknown_version.is_empty());
        std::fs::write(&path, b"invalid").unwrap();
        let mut invalid = vec![];
        remember_internal(&mut invalid, &path);
        assert!(invalid.is_empty());
        std::fs::remove_file(path).unwrap();
    }
}
