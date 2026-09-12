// Exercise startup and showing the window without touching the real library.
#[path = "../src/window_placement.rs"]
mod window_placement;

#[cfg(target_os = "macos")]
#[allow(deprecated)] // Pump bounded event batches to detect deferred placement.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use objc2_app_kit::NSWindow;
    use std::{
        sync::{Arc, Mutex},
        thread,
        time::Duration,
    };
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    let placements = Arc::new(Mutex::new(Vec::new()));
    let captured = placements.clone();
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.plinth.window-placement-probe".into();
    context.config_mut().app.windows.clear();
    context.config_mut().build.dev_url = None;
    let mut app = tauri::Builder::default()
        .setup(move |app| {
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            for (index, (width, height)) in [(1470., 906.), (900., 650.), (1100., 720.)]
                .into_iter()
                .enumerate()
            {
                let label = format!("placement-{index}");
                let window = WebviewWindowBuilder::new(
                    app.handle(),
                    &label,
                    WebviewUrl::External("about:blank".parse()?),
                )
                .visible(false)
                .focused(false)
                .inner_size(1550., 840.)
                .center()
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .build()?;
                let captured = captured.clone();
                let handle = app.handle().clone();
                window_placement::after_window_creation(move || {
                    window_placement::restore_size_and_center(&window, width, height).unwrap();
                    let native = unsafe { &*window.ns_window().unwrap().cast::<NSWindow>() };
                    let frame = native.frame();
                    captured.lock().unwrap().push((label, width, height, frame));
                    handle
                        .set_activation_policy(tauri::ActivationPolicy::Regular)
                        .unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                });
            }
            Ok(())
        })
        .build(context)?;
    for _ in 0..50 {
        app.run_iteration(|_, _| {});
        thread::sleep(Duration::from_millis(20));
    }
    let placements = placements.lock().unwrap();
    assert_eq!(placements.len(), 3, "startup callbacks must execute");
    for (label, width, height, restored) in placements.iter() {
        let window = app.get_webview_window(label).unwrap();
        assert!(window.is_visible()?);
        let native = unsafe { &*window.ns_window()?.cast::<NSWindow>() };
        let size = window
            .inner_size()?
            .to_logical::<f64>(window.scale_factor()?);
        assert_eq!((size.width, size.height), (*width, *height));
        assert_eq!(
            native.frame(),
            *restored,
            "placement drifted after startup/show"
        );
        native.center();
        assert_eq!(native.frame(), *restored, "shown window was not centered");
        println!("Verified startup/show at {width} × {height}: {restored:?}");
        window.destroy()?;
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn main() {}
