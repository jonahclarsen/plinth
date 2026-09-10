use serde::Serialize;

#[derive(Clone, Debug, PartialEq)]
pub struct DesktopSpace {
    pub number: u8,
    pub id: u64,
    pub display_id: Option<u32>,
    pub current: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Availability {
    pub available: Vec<u8>,
    pub reason: Option<String>,
}
pub fn availability() -> Availability {
    match list() {
        Ok(spaces) => Availability {
            available: spaces.into_iter().map(|space| space.number).collect(),
            reason: None,
        },
        Err(reason) => Availability {
            available: vec![],
            reason: Some(reason),
        },
    }
}
pub fn resolve(number: u8) -> Result<DesktopSpace, String> {
    select(&list()?, number)
}
fn select(spaces: &[DesktopSpace], number: u8) -> Result<DesktopSpace, String> {
    if !(1..=3).contains(&number) {
        return Err("Choose Space 1, 2, or 3".into());
    }
    spaces.iter().find(|space| space.number == number).cloned()
        .ok_or_else(|| format!("Space {number} is unavailable. Create it in Mission Control or choose another Space."))
}
pub fn label(all: bool, target: Option<u8>) -> String {
    target
        .map(|number| format!("Space {number}"))
        .unwrap_or_else(|| if all { "All Spaces" } else { "This Space" }.into())
}

#[cfg(target_os = "macos")]
mod macos {
    use super::DesktopSpace;
    use objc2::rc::Retained;
    use objc2_app_kit::NSWindow;
    use objc2_foundation::{ns_string, NSArray, NSDictionary, NSNumber, NSString};
    use std::{
        ffi::{c_char, c_int, c_void},
        sync::OnceLock,
    };

    type Connection = unsafe extern "C" fn() -> i32;
    type CopyDisplays = unsafe extern "C" fn(i32) -> *mut NSArray;
    type CopyWindowSpaces =
        unsafe extern "C" fn(i32, i32, *const NSArray<NSNumber>) -> *mut NSArray;
    type MoveWindow = unsafe extern "C" fn(i32, *const NSArray<NSNumber>, u64);
    struct Api {
        connection: Connection,
        displays: CopyDisplays,
        window_spaces: CopyWindowSpaces,
        move_window: MoveWindow,
    }
    unsafe extern "C" {
        fn dlopen(path: *const c_char, mode: c_int) -> *mut c_void;
        fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFUUIDCreateFromString(
            allocator: *const c_void,
            string: *const NSString,
        ) -> *const c_void;
        fn CFRelease(value: *const c_void);
    }
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGDisplayGetDisplayIDFromUUID(uuid: *const c_void) -> u32;
    }
    fn api() -> Result<&'static Api, String> {
        static API: OnceLock<Option<Api>> = OnceLock::new();
        API.get_or_init(|| unsafe {
            // Resolve private APIs at runtime so All Spaces / This Space remain usable
            // if a macOS update removes support for numbered placement.
            let handle = dlopen(c"/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight".as_ptr(), 1);
            if handle.is_null() { return None; }
            macro_rules! symbol {
                ($name:literal, $ty:ty) => {{
                    let pointer = dlsym(handle, concat!($name, "\0").as_ptr().cast());
                    if pointer.is_null() { return None; }
                    std::mem::transmute::<*mut c_void, $ty>(pointer)
                }};
            }
            Some(Api {
                connection: symbol!("SLSMainConnectionID", Connection),
                displays: symbol!("SLSCopyManagedDisplaySpaces", CopyDisplays),
                window_spaces: symbol!("SLSCopySpacesForWindows", CopyWindowSpaces),
                move_window: symbol!("SLSMoveWindowsToManagedSpace", MoveWindow),
            })
        }).as_ref().ok_or_else(|| "Numbered Spaces are unavailable on this macOS version. Choose All Spaces or This Space.".into())
    }
    fn number(dictionary: &NSDictionary, key: &NSString) -> Option<u64> {
        dictionary
            .objectForKey(key)?
            .downcast_ref::<NSNumber>()
            .map(|value| value.unsignedLongLongValue())
    }
    pub fn list() -> Result<Vec<DesktopSpace>, String> {
        let api = api()?;
        // Copy functions return retained CF collections, toll-free bridged to NSArray.
        let displays = unsafe { Retained::from_raw((api.displays)((api.connection)())) }
            .ok_or("Could not read Mission Control Spaces")?;
        let mut result = vec![];
        for value in displays.iter() {
            let Some(display) = value.downcast_ref::<NSDictionary>() else {
                continue;
            };
            let identifier = display.objectForKey(ns_string!("Display Identifier"));
            let identifier = identifier
                .as_ref()
                .and_then(|value| value.downcast_ref::<NSString>());
            let display_id = identifier
                .filter(|value| value.to_string() != "Main")
                .and_then(|value| unsafe {
                    let uuid = CFUUIDCreateFromString(std::ptr::null(), value);
                    if uuid.is_null() {
                        return None;
                    }
                    let id = CGDisplayGetDisplayIDFromUUID(uuid);
                    CFRelease(uuid);
                    (id != 0).then_some(id)
                });
            // "Main" describes shared Spaces when displays don't have separate Spaces.
            // Unknown display IDs must not put artwork onto an unrelated display.
            if identifier.is_none()
                || (identifier.is_some_and(|value| value.to_string() != "Main")
                    && display_id.is_none())
            {
                return Err("Could not identify the display for numbered Spaces".into());
            }
            let current = display.objectForKey(ns_string!("Current Space"));
            let current = current
                .as_ref()
                .and_then(|value| value.downcast_ref::<NSDictionary>())
                .and_then(|value| number(value, ns_string!("id64")));
            let spaces = display.objectForKey(ns_string!("Spaces"));
            let Some(spaces) = spaces
                .as_ref()
                .and_then(|value| value.downcast_ref::<NSArray>())
            else {
                continue;
            };
            for value in spaces.iter() {
                let Some(space) = value.downcast_ref::<NSDictionary>() else {
                    continue;
                };
                // Mission Control desktop numbers exclude full-screen application Spaces.
                if number(space, ns_string!("type")) != Some(0) {
                    continue;
                }
                if let Some(id) = number(space, ns_string!("id64")) {
                    result.push(DesktopSpace {
                        number: result.len() as u8 + 1,
                        id,
                        display_id,
                        current: current == Some(id),
                    });
                    if result.len() == 3 {
                        return Ok(result);
                    }
                }
            }
        }
        Ok(result)
    }
    pub fn matches_display(window: &NSWindow, space: &DesktopSpace) -> bool {
        let Some(target) = space.display_id else {
            return true;
        };
        window
            .screen()
            .and_then(|screen| {
                screen
                    .deviceDescription()
                    .objectForKey(ns_string!("NSScreenNumber"))
            })
            .and_then(|value| {
                value
                    .downcast_ref::<NSNumber>()
                    .map(|value| value.unsignedIntValue())
            })
            == Some(target)
    }
    pub fn move_window(window: u32, space: &DesktopSpace) -> Result<(), String> {
        let api = api()?;
        let windows = NSArray::from_retained_slice(&[NSNumber::new_u32(window)]);
        unsafe {
            (api.move_window)((api.connection)(), &*windows, space.id);
        }
        verify_window(window, space)
    }
    pub fn verify_window(window: u32, space: &DesktopSpace) -> Result<(), String> {
        let api = api()?;
        let windows = NSArray::from_retained_slice(&[NSNumber::new_u32(window)]);
        let assigned =
            unsafe { Retained::from_raw((api.window_spaces)((api.connection)(), 7, &*windows)) }
                .ok_or("Could not verify artwork Space placement")?;
        if assigned.len() == 1
            && assigned
                .objectAtIndex(0)
                .downcast_ref::<NSNumber>()
                .is_some_and(|number| number.unsignedLongLongValue() == space.id)
        {
            Ok(())
        } else {
            Err(format!("macOS could not move artwork to Space {}. Your previous desktop placement has been kept.", space.number))
        }
    }
}
#[cfg(target_os = "macos")]
pub use macos::{list, matches_display, move_window, verify_window};
#[cfg(not(target_os = "macos"))]
pub fn list() -> Result<Vec<DesktopSpace>, String> {
    Err("Numbered Spaces are available on macOS only".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resolves_only_existing_desktops_one_through_three() {
        let spaces = (1..=3)
            .map(|number| DesktopSpace {
                number,
                id: 100 + number as u64,
                display_id: Some(7),
                current: number == 1,
            })
            .collect::<Vec<_>>();
        for number in 1..=3 {
            assert_eq!(select(&spaces, number).unwrap().id, 100 + number as u64);
        }
        assert!(select(&spaces[..2], 3)
            .unwrap_err()
            .contains("Mission Control"));
        assert!(select(&spaces, 0).is_err());
        assert!(select(&spaces, 4).is_err());
        assert_eq!(label(false, Some(3)), "Space 3");
    }
}
