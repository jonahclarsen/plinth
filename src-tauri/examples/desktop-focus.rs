// Exercise the real Tauri desktop rebuild without loading the Plinth library.
#[allow(dead_code)]
#[path = "../src/desktop.rs"]
mod desktop;
#[allow(dead_code)]
#[path = "../src/spaces.rs"]
mod spaces;

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use objc2::{rc::Retained, MainThreadMarker};
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationOptions, NSApplicationActivationPolicy,
        NSRunningApplication, NSScreen, NSWindow, NSWorkspace,
    };
    use std::{thread, time::Duration};
    use tauri::{Listener, Manager, WebviewUrl, WebviewWindowBuilder};

    struct RestoreFocus(Option<Retained<NSRunningApplication>>);
    impl Drop for RestoreFocus {
        fn drop(&mut self) {
            if let Some(app) = &self.0 {
                app.activateWithOptions(NSApplicationActivationOptions::ActivateIgnoringOtherApps);
            }
        }
    }
    let workspace = NSWorkspace::sharedWorkspace();
    let _restore_focus = RestoreFocus(workspace.frontmostApplication());
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.plinth.desktop-focus-probe".into();
    context.config_mut().app.windows.clear();
    // No server, library commands, plugins, or application state are installed.
    context.config_mut().build.dev_url = None;
    let mut app = tauri::Builder::default().build(context)?;
    let native = NSApplication::sharedApplication(MainThreadMarker::new().unwrap());
    native.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
    app.run_iteration(|_, _| {});
    let editor = WebviewWindowBuilder::new(
        app.handle(),
        "focus-probe",
        WebviewUrl::External("about:blank".parse()?),
    )
    .visible(false)
    .focused(false)
    .inner_size(32., 32.)
    .build()?;
    let editor_ns = unsafe { &*editor.ns_window()?.cast::<NSWindow>() };
    editor_ns.setAlphaValue(0.);
    editor_ns.orderFrontRegardless();
    native.activateIgnoringOtherApps(true);
    editor_ns.makeKeyWindow();
    for _ in 0..8 {
        app.run_iteration(|_, _| {});
        thread::sleep(Duration::from_millis(20));
    }
    assert!(
        editor_ns.isKeyWindow(),
        "probe must start with a key editor window"
    );
    let editor_nonactivating: bool = unsafe { objc2::msg_send![editor_ns, _isNonactivatingPanel] };
    assert!(
        !editor_nonactivating,
        "editor must retain normal activation"
    );
    let focus = || {
        workspace
            .frontmostApplication()
            .map(|app| app.processIdentifier())
    };
    let initial_focus = focus();
    let current_spaces = || {
        spaces::list()
            .unwrap()
            .into_iter()
            .filter(|s| s.current)
            .map(|s| s.id)
            .collect::<Vec<_>>()
    };
    let initial_spaces = current_spaces();
    let mut choices = vec![(true, None), (false, None)];
    choices.extend(spaces::list()?.into_iter().map(|s| (false, Some(s.number))));
    for (all, target) in choices {
        for enabled in [true, false, true, false] {
            desktop::rebuild(app.handle(), enabled, all, target)?;
            // Drain deferred Tauri show/destroy messages, where the focus regression occurred.
            for _ in 0..8 {
                app.run_iteration(|_, _| {});
                thread::sleep(Duration::from_millis(20));
            }
            assert!(
                editor_ns.isKeyWindow(),
                "{} enabled={enabled} took editor focus",
                spaces::label(all, target)
            );
            assert_eq!(focus(), initial_focus, "frontmost application changed");
            assert_eq!(current_spaces(), initial_spaces, "active desktop changed");
            for (label, window) in app.webview_windows() {
                if label.starts_with("desktop-") {
                    let ns = unsafe { &*window.ns_window()?.cast::<NSWindow>() };
                    let nonactivating: bool =
                        unsafe { objc2::msg_send![ns, _isNonactivatingPanel] };
                    assert!(nonactivating, "desktop clicks must not activate the app");
                    assert!(!ns.canBecomeKeyWindow());
                    assert!(!ns.canBecomeMainWindow());
                    assert!(ns.isVisible());
                    let frame = ns.frame();
                    assert!(
                        NSScreen::screens(MainThreadMarker::new().unwrap())
                            .iter()
                            .any(|screen| screen.frame() == frame),
                        "desktop must cover one complete native display"
                    );
                    for (x, y) in [(1., 1.), (frame.size.width - 1., frame.size.height - 1.)] {
                        let local = ns.convertPointFromScreen(objc2_foundation::NSPoint::new(
                            frame.origin.x + x,
                            frame.origin.y + frame.size.height - y,
                        ));
                        assert!((local.x - x).abs() < 0.01);
                        assert!((frame.size.height - local.y - y).abs() < 0.01);
                    }
                }
            }
        }
        println!(
            "{}: repeated enable/disable preserved editor, app, and Space focus",
            spaces::label(all, target)
        );
    }
    // Simulate macOS leaving a laptop-sized window on the external display.
    desktop::rebuild(app.handle(), true, true, None)?;
    for _ in 0..8 {
        app.run_iteration(|_, _| {});
        thread::sleep(Duration::from_millis(20));
    }
    fn windows(app: &tauri::App) -> Vec<(String, tauri::WebviewWindow)> {
        app.webview_windows()
            .into_iter()
            .filter(|(label, _)| label.starts_with("desktop-"))
            .collect()
    }
    let before = windows(&app);
    let desktop_window = &before[0].1;
    let desktop_ns = unsafe { &*desktop_window.ns_window()?.cast::<NSWindow>() };
    let expected = desktop_ns.frame();
    let mut stale = expected;
    stale.size.width *= 0.7;
    stale.size.height *= 0.7;
    desktop_ns.setFrame_display(stale, true);
    desktop::refresh_displays(app.handle())?;
    for _ in 0..8 {
        app.run_iteration(|_, _| {});
        thread::sleep(Duration::from_millis(20));
    }
    let repaired = windows(&app);
    assert_eq!(repaired.len(), before.len());
    assert!(repaired.iter().any(|(_, window)| unsafe {
        (&*window.ns_window().unwrap().cast::<NSWindow>()).frame() == expected
    }));
    assert!(!repaired.iter().any(|(label, _)| *label == before[0].0));
    let labels = repaired
        .iter()
        .map(|(label, _)| label.clone())
        .collect::<std::collections::BTreeSet<_>>();
    desktop::refresh_displays(app.handle())?;
    assert_eq!(
        windows(&app)
            .into_iter()
            .map(|(label, _)| label)
            .collect::<std::collections::BTreeSet<_>>(),
        labels,
        "unchanged displays should not rebuild"
    );
    assert!(editor_ns.isKeyWindow());
    assert_eq!(focus(), initial_focus);
    assert_eq!(current_spaces(), initial_spaces);

    // Two independent window listeners must never receive each other's samples.
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    let received = Arc::new(AtomicUsize::new(0));
    let leaked = Arc::new(AtomicUsize::new(0));
    let count = received.clone();
    repaired[0].1.listen("desktop-pointer", move |_| {
        count.fetch_add(1, Ordering::SeqCst);
    });
    let count = leaked.clone();
    editor.listen("desktop-pointer", move |_| {
        count.fetch_add(1, Ordering::SeqCst);
    });
    desktop::emit_pointer(&repaired[0].1, 10., 20., true, true);
    assert_eq!(received.load(Ordering::SeqCst), 1);
    assert_eq!(
        leaked.load(Ordering::SeqCst),
        0,
        "pointer sample leaked into another window"
    );
    desktop::rebuild(app.handle(), false, true, None)?;
    for _ in 0..8 {
        app.run_iteration(|_, _| {});
        thread::sleep(Duration::from_millis(20));
    }
    desktop::refresh_displays(app.handle())?;
    assert!(
        windows(&app).is_empty(),
        "display refresh must preserve disabled artwork"
    );
    println!("Display bounds, corner hit coordinates, stale-window recovery, and pointer isolation verified");
    editor.destroy()?;
    app.run_iteration(|_, _| {});
    app.cleanup_before_exit();
    Ok(())
}
#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("This smoke test requires macOS.");
}
