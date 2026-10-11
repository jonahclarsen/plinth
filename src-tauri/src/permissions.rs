use serde::{Deserialize, Serialize};

/// A privacy permission a Music link depends on. Playlists and albums only
/// automate Music; artist links also drive Music's menu through System Events.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Permission {
    Music,
    SystemEvents,
    Accessibility,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Access {
    Allowed,
    Denied,
    /// macOS hasn't asked yet; the next use shows its prompt.
    NotRequested,
    /// Automation can only be checked while the target app is running.
    NotRunning,
    Unknown,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub id: Permission,
    pub title: &'static str,
    pub detail: &'static str,
    pub access: Access,
}

impl Permission {
    fn bundle_id(self) -> Option<&'static str> {
        match self {
            Self::Music => Some("com.apple.Music"),
            Self::SystemEvents => Some("com.apple.systemevents"),
            Self::Accessibility => None,
        }
    }
    fn title(self) -> &'static str {
        match self {
            Self::Music => "Control Music",
            Self::SystemEvents => "Control System Events",
            Self::Accessibility => "Accessibility",
        }
    }
    fn detail(self) -> &'static str {
        match self {
            Self::Music => "Automation · finds items in your library",
            Self::SystemEvents => "Automation · uses Music’s Song menu",
            Self::Accessibility => "Lets Plinth click Show Artist in Library",
        }
    }
    /// Fixed System Settings destinations; nothing from a link reaches `open`.
    pub fn settings_url(self) -> &'static str {
        match self {
            Self::Music | Self::SystemEvents => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
            }
            Self::Accessibility => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            }
        }
    }
    pub fn status(self) -> Status {
        Status {
            id: self,
            title: self.title(),
            detail: self.detail(),
            access: self.check(false),
        }
    }
    /// Never call on the main thread: Apple Event consent can block for a prompt.
    pub fn check(self, ask: bool) -> Access {
        match self.bundle_id() {
            Some(bundle) => automation(bundle, ask),
            None => accessibility(),
        }
    }
}

/// True when an osascript failure was a privacy refusal rather than a library problem.
pub fn is_denial(error: &str) -> bool {
    [
        "(-1743)",
        "(-1744)",
        "(-1719)",
        "(-25211)",
        "assistive access",
    ]
    .iter()
    .any(|code| error.contains(code))
}

#[cfg(target_os = "macos")]
mod mac {
    use std::ffi::c_void;
    #[repr(C)]
    pub struct AEDesc {
        pub descriptor_type: u32,
        pub data_handle: *mut c_void,
    }
    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        pub fn AECreateDesc(
            type_code: u32,
            data: *const c_void,
            size: isize,
            result: *mut AEDesc,
        ) -> i16;
        pub fn AEDisposeDesc(desc: *mut AEDesc) -> i16;
        pub fn AEDeterminePermissionToAutomateTarget(
            target: *const AEDesc,
            event_class: u32,
            event_id: u32,
            ask_user_if_needed: u8,
        ) -> i32;
    }
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        pub fn AXIsProcessTrusted() -> u8;
    }
}

#[cfg(target_os = "macos")]
fn automation(bundle: &str, ask: bool) -> Access {
    const TYPE_APPLICATION_BUNDLE_ID: u32 = u32::from_be_bytes(*b"bund");
    const TYPE_WILDCARD: u32 = u32::from_be_bytes(*b"****");
    let mut target = mac::AEDesc {
        descriptor_type: 0,
        data_handle: std::ptr::null_mut(),
    };
    // SAFETY: the descriptor copies the bundle bytes and is disposed below.
    let status = unsafe {
        if mac::AECreateDesc(
            TYPE_APPLICATION_BUNDLE_ID,
            bundle.as_ptr().cast(),
            bundle.len() as isize,
            &mut target,
        ) != 0
        {
            return Access::Unknown;
        }
        let status = mac::AEDeterminePermissionToAutomateTarget(
            &target,
            TYPE_WILDCARD,
            TYPE_WILDCARD,
            ask as u8,
        );
        mac::AEDisposeDesc(&mut target);
        status
    };
    access_from_status(status)
}

#[cfg(not(target_os = "macos"))]
fn automation(_bundle: &str, _ask: bool) -> Access {
    Access::Unknown
}

#[cfg(target_os = "macos")]
fn accessibility() -> Access {
    // macOS doesn't distinguish "denied" from "never asked" here.
    if unsafe { mac::AXIsProcessTrusted() } != 0 {
        Access::Allowed
    } else {
        Access::Denied
    }
}

#[cfg(not(target_os = "macos"))]
fn accessibility() -> Access {
    Access::Unknown
}

fn access_from_status(status: i32) -> Access {
    match status {
        0 => Access::Allowed,
        -1743 => Access::Denied,
        -1744 => Access::NotRequested,
        -600 => Access::NotRunning,
        _ => Access::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automation_status_codes_map_to_access() {
        assert_eq!(access_from_status(0), Access::Allowed);
        assert_eq!(access_from_status(-1743), Access::Denied);
        assert_eq!(access_from_status(-1744), Access::NotRequested);
        assert_eq!(access_from_status(-600), Access::NotRunning);
        assert_eq!(access_from_status(-50), Access::Unknown);
    }

    #[test]
    fn only_privacy_refusals_count_as_denials() {
        assert!(is_denial(
            "execution error: Not authorized to send Apple events to Music. (-1743)"
        ));
        assert!(is_denial(
            "System Events got an error: osascript is not allowed assistive access. (-1719)"
        ));
        assert!(!is_denial(
            "execution error: Music got an error: Can’t get playlist 1. (-1728)"
        ));
        assert!(!is_denial(
            "Music’s Show Artist in Library command is unavailable. (-2700)"
        ));
    }

    #[test]
    fn settings_links_are_fixed_privacy_panes() {
        for permission in [
            Permission::Music,
            Permission::SystemEvents,
            Permission::Accessibility,
        ] {
            assert!(permission
                .settings_url()
                .starts_with("x-apple.systempreferences:com.apple.preference.security?Privacy_"));
        }
    }
}
