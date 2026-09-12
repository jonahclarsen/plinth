// Verify startup placement without reading or modifying the real library.
#[path = "../src/window_placement.rs"]
mod window_placement;

// Pump a bounded number of events to detect deferred resizing.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use objc2_app_kit::NSWindow;
    use std::{thread, time::Duration};
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.plinth.window-placement-probe".into();
    context.config_mut().app.windows.clear();
    context.config_mut().build.dev_url = None;
    let mut app = tauri::Builder::default().build(context)?;
    app.run_iteration(|_, _| {});
    let window = WebviewWindowBuilder::new(
        app.handle(),
        "placement-probe",
        WebviewUrl::External("about:blank".parse()?),
    )
    .visible(false)
    .focused(false)
    .inner_size(1550., 840.)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .build()?;
    let native = unsafe { &*window.ns_window()?.cast::<NSWindow>() };
    for (width, height) in [(1470., 923.), (900., 650.), (1100., 720.)] {
        window_placement::restore_size_and_center(&window, width, height)?;
        let size = window
            .inner_size()?
            .to_logical::<f64>(window.scale_factor()?);
        assert_eq!((size.width, size.height), (width, height));
        let restored = native.frame();
        for _ in 0..10 {
            app.run_iteration(|_, _| {});
            thread::sleep(Duration::from_millis(20));
        }
        assert_eq!(
            native.frame(),
            restored,
            "placement drifted after event processing"
        );
        native.center();
        assert_eq!(native.frame(), restored, "restored window was not centered");
        println!("Verified {width} × {height}: {restored:?}");
    }
    window.destroy()?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn main() {}
