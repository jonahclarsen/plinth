use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static DESKTOP_GENERATION: AtomicU64 = AtomicU64::new(0);

// AppKit screen and window geometry use the same global coordinate space in points.
// Keep display identity as well as bounds: swapping equal-sized displays can change
// the layout profile, and a scale change can leave the point dimensions unchanged.
#[cfg(target_os = "macos")]
#[derive(Clone, PartialEq)]
struct Screen {
    id: u32,
    frame: objc2_foundation::NSRect,
    visible_frame: objc2_foundation::NSRect,
    scale: f64,
}

#[cfg(target_os = "macos")]
fn screens() -> Result<Vec<Screen>, String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSScreen;
    use objc2_foundation::{ns_string, NSNumber};
    let mtm = MainThreadMarker::new().ok_or("Display placement requires the main thread")?;
    let mut screens = NSScreen::screens(mtm)
        .iter()
        .map(|screen| {
            let id = screen
                .deviceDescription()
                .objectForKey(ns_string!("NSScreenNumber"))
                .and_then(|n| n.downcast_ref::<NSNumber>().map(|n| n.unsignedIntValue()))
                .ok_or("Screen has no display identifier")?;
            Ok(Screen {
                id,
                frame: screen.frame(),
                visible_frame: screen.visibleFrame(),
                scale: screen.backingScaleFactor(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    screens.sort_by_key(|screen| screen.id);
    Ok(screens)
}

#[cfg(target_os = "macos")]
struct Placement {
    screens: Vec<Screen>,
    windows: Vec<(String, objc2_foundation::NSRect)>,
    all_spaces: bool,
    target_space: Option<u8>,
}

#[cfg(target_os = "macos")]
static PLACEMENT: std::sync::Mutex<Option<Placement>> = std::sync::Mutex::new(None);

/// Recover after hotplug, sleep, resolution/scale changes, or macOS moving a
/// desktop window. Rebuild also refreshes each webview's detected layout profile.
#[cfg(target_os = "macos")]
pub fn refresh_displays(app: &AppHandle) -> Result<(), String> {
    let config = {
        let state = PLACEMENT.lock().map_err(|e| e.to_string())?;
        let Some(placement) = state.as_ref() else {
            return Ok(());
        };
        let current = screens()?;
        // Displays can briefly disappear during wake or a mode switch.
        if current.is_empty() {
            return Ok(());
        }
        let aligned = placement.windows.iter().all(|(label, frame)| {
            app.get_webview_window(label)
                .and_then(|window| window.ns_window().ok())
                .is_some_and(|ptr| unsafe {
                    (&*ptr.cast::<objc2_app_kit::NSWindow>()).frame() == *frame
                })
        });
        if current == placement.screens && aligned {
            return Ok(());
        }
        (placement.all_spaces, placement.target_space)
    };
    rebuild(app, true, config.0, config.1)
}

pub fn rebuild(
    app: &AppHandle,
    enabled: bool,
    all_spaces: bool,
    target_space: Option<u8>,
) -> Result<(), String> {
    let previous = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with("desktop-"))
        .map(|(_, window)| window)
        .collect::<Vec<_>>();
    if !enabled {
        #[cfg(target_os = "macos")]
        {
            *PLACEMENT.lock().map_err(|e| e.to_string())? = None;
        }
        for window in previous {
            window.destroy().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    let target = target_space.map(crate::spaces::resolve).transpose()?;
    #[cfg(target_os = "macos")]
    let screens = screens()?;
    #[cfg(target_os = "macos")]
    let mut placements = vec![];
    let mut created: Vec<tauri::WebviewWindow> = vec![];
    let result = (|| -> Result<(), String> {
        // Tauri destroys webviews asynchronously; old labels may still be registered.
        let generation = DESKTOP_GENERATION.fetch_add(1, Ordering::Relaxed);
        #[cfg(target_os = "macos")]
        let surfaces = screens
            .iter()
            .map(|screen| {
                (
                    screen.frame.origin.x,
                    screen.frame.origin.y,
                    screen.frame.size.width,
                    screen.frame.size.height,
                )
            })
            .collect::<Vec<_>>();
        #[cfg(not(target_os = "macos"))]
        let surfaces = app
            .available_monitors()
            .map_err(|e| e.to_string())?
            .iter()
            .map(|monitor| {
                let scale = monitor.scale_factor();
                let pos = monitor.position();
                let size = monitor.size();
                (
                    pos.x as f64 / scale,
                    pos.y as f64 / scale,
                    size.width as f64 / scale,
                    size.height as f64 / scale,
                )
            })
            .collect::<Vec<_>>();
        for (i, (_x, _y, width, height)) in surfaces.into_iter().enumerate() {
            let window = WebviewWindowBuilder::new(
                app,
                format!("desktop-{generation}-{i}"),
                WebviewUrl::App("index.html?desktop=1".into()),
            )
            .title("Plinth Desktop")
            .accept_first_mouse(true)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .skip_taskbar(true)
            .focused(false)
            .focusable(false)
            .visible(false)
            .inner_size(width, height)
            .on_navigation(|url| {
                matches!(url.scheme(), "tauri" | "http" | "https")
                    && matches!(
                        url.host_str(),
                        Some("localhost" | "127.0.0.1" | "tauri.localhost")
                    )
            });
            #[cfg(not(target_os = "macos"))]
            let window = window.position(_x, _y);
            let window = window.build().map_err(|e| e.to_string())?;
            created.push(window.clone());
            #[cfg(target_os = "macos")]
            unsafe {
                use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
                let ns = &*window
                    .ns_window()
                    .map_err(|e| e.to_string())?
                    .cast::<NSWindow>();
                // Set the exact native frame before checking Space membership or
                // showing it; AppKit coordinates also match native pointer tracking.
                ns.setFrame_display(screens[i].frame, true);
                placements.push((window.label().to_owned(), screens[i].frame));
                if target
                    .as_ref()
                    .is_some_and(|space| !crate::spaces::matches_display(ns, space))
                {
                    window.destroy().map_err(|e| e.to_string())?;
                    created.pop();
                    placements.pop();
                    continue;
                }
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
                if let Some(space) = &target {
                    crate::spaces::move_window(ns.windowNumber() as u32, space)?;
                }
                // Same public desktop-icon window level used for Plash's browsing mode.
                ns.setLevel(-2147483602);
                ns.setAlphaValue(1.);
                ns.setCanHide(false);
                ns.setAcceptsMouseMovedEvents(true);
                ns.setHidesOnDeactivate(false);
                // Tauri show() makes this the key window on macOS. Order it without
                // activation so enabling artwork preserves the editor and app focus.
                ns.orderFrontRegardless();
            }
            #[cfg(not(target_os = "macos"))]
            window.show().map_err(|e| e.to_string())?;
            #[cfg(target_os = "macos")]
            if let Some(space) = &target {
                let pointer = window.ns_window().map_err(|e| e.to_string())?;
                let ns = unsafe { &*pointer.cast::<objc2_app_kit::NSWindow>() };
                crate::spaces::verify_window(ns.windowNumber() as u32, space)?;
            }
        }
        if created.is_empty() {
            return Err("The selected Space's display is unavailable".into());
        }
        Ok(())
    })();
    if let Err(error) = result {
        for window in created {
            let _ = window.destroy();
        }
        return Err(error);
    }
    #[cfg(target_os = "macos")]
    {
        *PLACEMENT.lock().map_err(|e| e.to_string())? = Some(Placement {
            screens,
            windows: placements,
            all_spaces,
            target_space,
        });
    }
    // Keep the previous windows until every replacement has been placed successfully.
    for window in previous {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub(crate) fn emit_pointer(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
    visible: bool,
    foreground_allowed: bool,
) {
    // Emitter::emit broadcasts even when called on a window. Each sample uses
    // this window's local coordinates, so it must never reach another display.
    let _ = window.emit_to(
        window.label(),
        "desktop-pointer",
        serde_json::json!({ "x": x, "y": y, "visible": visible, "foregroundAllowed": foreground_allowed }),
    );
}

pub fn start_pointer_tracking(app: AppHandle) {
    let previous = std::sync::Arc::new(std::sync::Mutex::new(None::<(f64, f64, isize, bool)>));
    std::thread::spawn(move || {
        let mut ticks = 0u32;
        loop {
            std::thread::sleep(Duration::from_millis(33));
            ticks = (ticks + 1) % 30;
            let refresh = ticks == 0;
            let handle = app.clone();
            let previous = previous.clone();
            let _ = app.run_on_main_thread(move || {
                #[cfg(target_os = "macos")]
                {
                    if refresh {
                        if let Err(error) = refresh_displays(&handle) {
                            eprintln!("Could not update desktop displays: {error}");
                        }
                    }
                    use objc2::MainThreadMarker;
                    use objc2_app_kit::{NSEvent, NSWindow, NSWorkspace};
                    let Some(mtm) = MainThreadMarker::new() else {
                        return;
                    };
                    let point = NSEvent::mouseLocation();
                    let top =
                        NSWindow::windowNumberAtPoint_belowWindowWithWindowNumber(point, 0, mtm);
                    let foreground_allowed = NSWorkspace::sharedWorkspace()
                        .frontmostApplication()
                        .is_some_and(|front| {
                            front.processIdentifier() as u32 == std::process::id()
                                || front
                                    .bundleIdentifier()
                                    .is_some_and(|id| id.to_string() == "com.apple.finder")
                        });
                    // Include focus so a stationary pointer responds to app switches.
                    let sample = (point.x, point.y, top, foreground_allowed);
                    if let Ok(mut last) = previous.lock() {
                        if *last == Some(sample) {
                            return;
                        }
                        *last = Some(sample);
                    }
                    for (label, window) in handle.webview_windows() {
                        if !label.starts_with("desktop-") {
                            continue;
                        }
                        if let Ok(ptr) = window.ns_window() {
                            unsafe {
                                let ns = &*ptr.cast::<NSWindow>();
                                let local = ns.convertPointFromScreen(point);
                                let visible = top == ns.windowNumber() && ns.isVisible();
                                emit_pointer(
                                    &window,
                                    local.x,
                                    ns.frame().size.height - local.y,
                                    visible,
                                    foreground_allowed,
                                );
                            }
                        }
                    }
                }
            });
        }
    });
}
