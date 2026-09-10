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
        NSRunningApplication, NSWindow, NSWorkspace,
    };
    use std::{thread, time::Duration};
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

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
                    assert!(!ns.canBecomeKeyWindow());
                    assert!(!ns.canBecomeMainWindow());
                    assert!(ns.isVisible());
                }
            }
        }
        println!(
            "{}: repeated enable/disable preserved editor, app, and Space focus",
            spaces::label(all, target)
        );
    }
    editor.destroy()?;
    app.run_iteration(|_, _| {});
    app.cleanup_before_exit();
    Ok(())
}
#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("This smoke test requires macOS.");
}
