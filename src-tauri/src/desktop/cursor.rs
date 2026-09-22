//! WKWebView suppresses CSS cursor changes when its window isn't active.
//! Set the native cursor without making the desktop key or activating Plinth.
use objc2::MainThreadMarker;
use objc2_app_kit::{NSCursor, NSEvent, NSWindow};
use objc2_foundation::{ns_string, NSNumber, NSString};
use std::{
    ffi::{c_char, c_int, c_void},
    sync::{Mutex, OnceLock},
};

static OWNER: Mutex<Option<isize>> = Mutex::new(None);

type Connection = unsafe extern "C" fn() -> i32;
type SetProperty = unsafe extern "C" fn(i32, i32, *const NSString, *const NSNumber) -> i32;
struct Api {
    connection: Connection,
    set_property: SetProperty,
}
unsafe extern "C" {
    fn dlopen(path: *const c_char, mode: c_int) -> *mut c_void;
    fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
}
fn background_cursor(enabled: bool) -> Result<(), String> {
    static API: OnceLock<Option<Api>> = OnceLock::new();
    let api = API
        .get_or_init(|| unsafe {
            // Like numbered Spaces, guard private WindowServer APIs at runtime.
            let handle = dlopen(
                c"/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight".as_ptr(),
                1,
            );
            if handle.is_null() {
                return None;
            }
            let connection = dlsym(handle, c"SLSMainConnectionID".as_ptr());
            let set_property = dlsym(handle, c"SLSSetConnectionProperty".as_ptr());
            if connection.is_null() || set_property.is_null() {
                return None;
            }
            Some(Api {
                connection: std::mem::transmute::<*mut c_void, Connection>(connection),
                set_property: std::mem::transmute::<*mut c_void, SetProperty>(set_property),
            })
        })
        .as_ref()
        .ok_or("Background cursor control is unavailable on this macOS version")?;
    let value = NSNumber::new_bool(enabled);
    let result = unsafe {
        let connection = (api.connection)();
        (api.set_property)(
            connection,
            connection,
            ns_string!("SetsCursorInBackground"),
            &*value,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(format!("Background cursor control failed ({result})"))
    }
}

fn accepts_sample(
    visible: bool,
    window: isize,
    top: isize,
    requested: (f64, f64),
    current: (f64, f64),
) -> bool {
    visible
        && window == top
        && (requested.0 - current.0).abs() < 0.5
        && (requested.1 - current.1).abs() < 0.5
}

pub(super) fn update(
    window: &tauri::WebviewWindow,
    x: f64,
    y: f64,
    pointing: bool,
) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("Cursor updates require the main thread")?;
    let ptr = window.ns_window().map_err(|e| e.to_string())?;
    let ns = unsafe { &*ptr.cast::<NSWindow>() };
    let point = NSEvent::mouseLocation();
    let top = NSWindow::windowNumberAtPoint_belowWindowWithWindowNumber(point, 0, mtm);
    release_if_not_over(Some(top));
    let local = ns.convertPointFromScreen(point);
    // IPC replies can arrive after crossing a display, opening another window,
    // or moving onto blank desktop. Never apply an old webview hit test there.
    if !accepts_sample(
        ns.isVisible(),
        ns.windowNumber(),
        top,
        (x, y),
        (local.x, ns.frame().size.height - local.y),
    ) {
        return Ok(());
    }
    if pointing {
        let mut owner = OWNER.lock().unwrap();
        if owner.is_none() {
            background_cursor(true)?;
        }
        NSCursor::pointingHandCursor().set();
        *owner = Some(top);
    } else {
        release_if_not_over(None);
    }
    Ok(())
}

pub(super) fn release_if_not_over(top: Option<isize>) {
    debug_assert!(MainThreadMarker::new().is_some());
    let mut owner = OWNER.lock().unwrap();
    if owner.is_some() && *owner != top {
        // Do not overwrite an I-beam, resize cursor, etc. already set by the
        // newly hovered app. Relinquish background control on every departure.
        #[allow(deprecated)]
        if top.is_none()
            || NSCursor::currentSystemCursor()
                .is_none_or(|cursor| cursor == NSCursor::pointingHandCursor())
        {
            NSCursor::arrowCursor().set();
        }
        if let Err(error) = background_cursor(false) {
            eprintln!("Could not release desktop cursor: {error}");
        }
        *owner = None;
    }
}

#[cfg(test)]
mod tests {
    use super::accepts_sample;

    #[test]
    fn cursor_requires_visible_topmost_window_and_current_coordinates() {
        assert!(accepts_sample(true, 7, 7, (100., 50.), (100., 50.)));
        assert!(!accepts_sample(false, 7, 7, (100., 50.), (100., 50.)));
        assert!(!accepts_sample(true, 7, 8, (100., 50.), (100., 50.)));
        assert!(!accepts_sample(true, 7, 7, (100., 50.), (105., 50.)));
        assert!(!accepts_sample(true, 7, 7, (100., 50.), (100., 55.)));
        assert!(!accepts_sample(true, 7, 7, (f64::NAN, 50.), (100., 50.)));
    }
}
