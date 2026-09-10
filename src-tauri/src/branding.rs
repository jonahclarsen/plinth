use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Logo {
    #[default]
    #[serde(rename = "logo-1")]
    One,
    #[serde(rename = "logo-2")]
    Two,
    #[serde(rename = "logo-3")]
    Three,
}
impl Logo {
    pub fn png(self) -> &'static [u8] {
        match self {
            Self::One => include_bytes!("../../public/logos/logo-1.png"),
            Self::Two => include_bytes!("../../public/logos/logo-2.png"),
            Self::Three => include_bytes!("../../public/logos/logo-3.png"),
        }
    }
    pub fn tray(self) -> Result<tauri::image::Image<'static>, tauri::Error> {
        tauri::image::Image::from_bytes(match self {
            Self::One => include_bytes!("../icons/tray-1.png"),
            Self::Two => include_bytes!("../icons/tray-2.png"),
            Self::Three => include_bytes!("../icons/tray-3.png"),
        })
    }
}

// Called on the main thread, including whenever the Dock icon becomes visible.
pub fn apply(app: &tauri::AppHandle, logo: Logo, update_finder: bool) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("plinth") {
        tray.set_icon(Some(logo.tray().map_err(|e| e.to_string())?))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        use objc2::{AllocAnyThread, MainThreadMarker};
        use objc2_app_kit::{NSApplication, NSImage, NSWorkspace, NSWorkspaceIconCreationOptions};
        use objc2_foundation::{NSBundle, NSData};

        let mtm = MainThreadMarker::new().ok_or("Logo updates require the main thread")?;
        let data = NSData::with_bytes(logo.png());
        let icon = NSImage::initWithData(NSImage::alloc(), &data).ok_or("Cannot load app logo")?;
        unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&icon)) };
        if update_finder {
            let path = NSBundle::mainBundle().bundlePath();
            // Finder custom icons preserve the signed bundle's packaged resources.
            // Plain Cargo binaries have no app bundle to update.
            if path.to_string().ends_with(".app")
                && !NSWorkspace::sharedWorkspace().setIcon_forFile_options(
                    Some(&icon),
                    &path,
                    NSWorkspaceIconCreationOptions::empty(),
                )
            {
                return Err("The logo was saved, but macOS could not update its Finder icon. Move Plinth to a writable Applications folder and reopen it.".into());
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        use tauri::Manager;
        let _ = update_finder;
        for window in app.webview_windows().values() {
            window
                .set_icon(tauri::image::Image::from_bytes(logo.png()).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::{self, Library, Settings};

    #[test]
    fn legacy_settings_default_to_first_logo_and_unknown_logos_are_rejected() {
        let settings: Settings = serde_json::from_str(r#"{"theme":"light"}"#).unwrap();
        assert_eq!(settings.logo, Logo::One);
        assert_eq!(settings.theme, "light");
        assert!(serde_json::from_str::<Settings>(r#"{"logo":"old-logo"}"#).is_err());
    }

    #[test]
    fn record_logo_has_transparent_background_and_grooves_with_black_centers() {
        let image = image::load_from_memory(Logo::Two.png()).unwrap().to_rgba8();
        assert_eq!(image.get_pixel(0, 0).0[3], 0);
        for x in [265, 512, 759] {
            assert_eq!(image.get_pixel(x, 400).0, [255, 255, 255, 255]);
            assert_eq!(image.get_pixel(x + 20, 512).0, [0, 0, 0, 255]);
            assert_eq!(image.get_pixel(x, 512).0, [255, 255, 255, 255]);
            assert_eq!(image.get_pixel(x - 118, 478).0[3], 0);
        }
    }

    #[test]
    fn every_logo_survives_library_reload_and_has_valid_native_assets() {
        let dir = std::env::temp_dir().join(format!("plinth-logo-test-{}", std::process::id()));
        for logo in [Logo::One, Logo::Two, Logo::Three] {
            let mut library = Library::default();
            library.settings.logo = logo;
            library::save(&dir, &library).unwrap();
            assert_eq!(library::load(&dir).unwrap().settings.logo, logo);
            let image = image::load_from_memory(logo.png()).unwrap();
            assert_eq!((image.width(), image.height()), (1024, 1024));
            let tray = logo.tray().unwrap();
            assert_eq!((tray.width(), tray.height()), (44, 44));
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}
