// Called during setup, before the main window is shown.
pub fn restore_size_and_center(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc2::MainThreadMarker;
        use objc2_app_kit::NSWindow;
        use objc2_foundation::NSSize;

        let _mtm = MainThreadMarker::new().ok_or("Window restoration requires the main thread")?;
        let native = window.ns_window().map_err(|error| error.to_string())?;
        let native = unsafe { &*native.cast::<NSWindow>() };
        // Tao queues set_size on the main dispatch queue, while center runs immediately.
        // Apply both synchronously so centering uses the restored dimensions.
        native.setContentSize(NSSize::new(width, height));
        native.center();
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        window
            .set_size(tauri::LogicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
        window.center().map_err(|error| error.to_string())
    }
}
