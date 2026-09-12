// Tao queues initial frame positioning during window creation. Finish startup on
// the next main-queue turn so those updates cannot overwrite restored placement.
pub fn after_window_creation(action: impl FnOnce() + Send + 'static) {
    #[cfg(target_os = "macos")]
    dispatch2::DispatchQueue::main().exec_async(action);
    #[cfg(not(target_os = "macos"))]
    action();
}

// Called after window creation settles, before the main window is shown.
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
