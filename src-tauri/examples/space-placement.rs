// Run manually on macOS: cargo run --example space-placement.
// Uses invisible, temporary windows only; never opens the Plinth library.
#[allow(dead_code)]
#[path = "../src/spaces.rs"]
mod spaces;

#[cfg(target_os = "macos")]
fn main() -> Result<(), String> {
    use objc2::{MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationPolicy, NSBackingStoreType, NSWindow,
        NSWindowCollectionBehavior, NSWindowStyleMask, NSWorkspace,
    };
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    let mtm = MainThreadMarker::new().ok_or("Must run on the main thread")?;
    let app = NSApplication::sharedApplication(mtm);
    app.setActivationPolicy(NSApplicationActivationPolicy::Prohibited);
    let workspace = NSWorkspace::sharedWorkspace();
    let focused = || {
        workspace
            .frontmostApplication()
            .map(|app| app.processIdentifier())
    };
    let initial_focus = focused();
    let desktops = spaces::list()?;
    let current = desktops
        .iter()
        .filter(|space| space.current)
        .map(|space| space.id)
        .collect::<Vec<_>>();
    for desktop in &desktops {
        let window = unsafe {
            NSWindow::initWithContentRect_styleMask_backing_defer(
                NSWindow::alloc(mtm),
                NSRect::new(NSPoint::new(100., 100.), NSSize::new(32., 32.)),
                NSWindowStyleMask::Borderless,
                NSBackingStoreType::Buffered,
                false,
            )
        };
        unsafe {
            window.setReleasedWhenClosed(false);
        }
        window.setAlphaValue(0.);
        window.setIgnoresMouseEvents(true);
        window.setCollectionBehavior(
            NSWindowCollectionBehavior::Stationary | NSWindowCollectionBehavior::IgnoresCycle,
        );
        window.orderFrontRegardless();
        if !spaces::matches_display(&window, desktop) {
            window.close();
            println!(
                "Space {}: belongs to another display; placement probe skipped",
                desktop.number
            );
            continue;
        }
        let result = (|| {
            spaces::move_window(window.windowNumber() as u32, desktop)?;
            window.setLevel(-2147483602);
            window.orderFrontRegardless();
            // Verify showing the desktop-level window didn't change its membership.
            spaces::verify_window(window.windowNumber() as u32, desktop)?;
            let after = spaces::list()?
                .into_iter()
                .filter(|space| space.current)
                .map(|space| space.id)
                .collect::<Vec<_>>();
            if after != current || focused() != initial_focus {
                return Err("Placement changed the active Space or focused app".into());
            }
            Ok::<_, String>(())
        })();
        window.close();
        result?;
        println!(
            "Space {}: verified own-window placement; active Space and focus preserved",
            desktop.number
        );
    }
    if desktops.len() < 3 {
        println!("Space 3: unavailable; the option will be disabled until it exists");
    }
    Ok(())
}
#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("This smoke test requires macOS.");
}
