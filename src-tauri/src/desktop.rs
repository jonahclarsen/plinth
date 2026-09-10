use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn rebuild(app: &AppHandle, enabled: bool, all_spaces: bool) -> Result<(), String> {
    for (label, window) in app.webview_windows() {
        if label.starts_with("desktop-") {
            window.destroy().map_err(|e| e.to_string())?;
        }
    }
    if !enabled {
        return Ok(());
    }
    for (i, monitor) in app
        .available_monitors()
        .map_err(|e| e.to_string())?
        .iter()
        .enumerate()
    {
        let scale = monitor.scale_factor();
        let pos = monitor.position();
        let size = monitor.size();
        let window = WebviewWindowBuilder::new(
            app,
            format!("desktop-{i}"),
            WebviewUrl::App("index.html?desktop=1".into()),
        )
        .title("Plinth Desktop")
        .accept_first_mouse(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .focused(false)
        .visible(false)
        .position(pos.x as f64 / scale, pos.y as f64 / scale)
        .inner_size(size.width as f64 / scale, size.height as f64 / scale)
        .on_navigation(|url| {
            matches!(url.scheme(), "tauri" | "http" | "https")
                && matches!(
                    url.host_str(),
                    Some("localhost" | "127.0.0.1" | "tauri.localhost")
                )
        })
        .build()
        .map_err(|e| e.to_string())?;
        #[cfg(target_os = "macos")]
        unsafe {
            use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
            let ns = &*window
                .ns_window()
                .map_err(|e| e.to_string())?
                .cast::<NSWindow>();
            ns.setCollectionBehavior(
                (if all_spaces {
                    NSWindowCollectionBehavior::CanJoinAllSpaces
                } else {
                    NSWindowCollectionBehavior::Default
                }) | NSWindowCollectionBehavior::Stationary
                    | NSWindowCollectionBehavior::IgnoresCycle,
            );
            if !all_spaces {
                // Establish membership in the active Space at the normal window level.
                // Ordering a new window at the desktop level first leaves it off-Space.
                // Keep it transparent during placement and never activate it.
                ns.setAlphaValue(0.);
                ns.orderFrontRegardless();
            }
            // Same public desktop-icon window level used for Plash's browsing mode.
            ns.setLevel(-2147483602);
            ns.setAlphaValue(1.);
            ns.setCanHide(false);
            ns.setAcceptsMouseMovedEvents(true);
            ns.setHidesOnDeactivate(false);
        }
        window.show().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn start_pointer_tracking(app: AppHandle) {
    let previous = std::sync::Arc::new(std::sync::Mutex::new(None::<(f64, f64, isize)>));
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(33));
        let handle = app.clone();
        let previous = previous.clone();
        let _ = app.run_on_main_thread(move || {
            #[cfg(target_os="macos")] {
                use objc2::MainThreadMarker;
                use objc2_app_kit::{NSWindow,NSEvent};
                let Some(mtm)=MainThreadMarker::new() else {return};
                let point=NSEvent::mouseLocation();
                let top=NSWindow::windowNumberAtPoint_belowWindowWithWindowNumber(point,0,mtm);
                let sample=(point.x,point.y,top);
                if let Ok(mut last)=previous.lock() {if *last==Some(sample) {return;} *last=Some(sample);}
                for (label,window) in handle.webview_windows() {
                    if !label.starts_with("desktop-") {continue;}
                    if let Ok(ptr)=window.ns_window() { unsafe {
                        let ns=&*ptr.cast::<NSWindow>(); let local=ns.convertPointFromScreen(point);
                        let visible=top==ns.windowNumber() && ns.isVisible();
                        let _=window.emit("desktop-pointer",serde_json::json!({"x":local.x,"y":ns.frame().size.height-local.y,"visible":visible}));
                    } }
                }
            }
        });
    });
}
