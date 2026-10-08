use std::sync::atomic::{AtomicBool, Ordering};

static LINK_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

// Ignore overlapping OS requests, preventing untrusted link storms from
// launching concurrent processes or racing artist menu navigation.
pub struct LinkNavigation;
impl LinkNavigation {
    pub fn begin() -> Option<Self> {
        LINK_IN_PROGRESS
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self)
    }
}
impl Drop for LinkNavigation {
    fn drop(&mut self) {
        LINK_IN_PROGRESS.store(false, Ordering::Release);
    }
}

pub fn script_command(script: &'static str, args: &[&str]) -> std::process::Command {
    let mut command = std::process::Command::new("/usr/bin/osascript");
    command.args(["-e", script, "--"]).args(args);
    command
}

/// The external protocol has no general-purpose URL, file, or command action.
#[derive(Debug, PartialEq, Eq)]
pub enum LibraryLink {
    Playlist(String),
    Album { title: String, artist: String },
    Artist(String),
}

fn decode_name(value: &str, query: bool) -> Result<String, &'static str> {
    let mut decoded = Vec::with_capacity(value.len());
    let mut bytes = value.bytes();
    while let Some(byte) = bytes.next() {
        match byte {
            b'%' => {
                let high = bytes.next().and_then(|b| (b as char).to_digit(16));
                let low = bytes.next().and_then(|b| (b as char).to_digit(16));
                let (Some(high), Some(low)) = (high, low) else {
                    return Err("Invalid percent encoding");
                };
                decoded.push((high * 16 + low) as u8);
            }
            b'+' if query => decoded.push(b' '),
            _ => decoded.push(byte),
        }
    }
    let name = String::from_utf8(decoded).map_err(|_| "Invalid UTF-8")?;
    if name.trim().is_empty() || name.len() > 512 || name.chars().any(char::is_control) {
        return Err("Invalid library name");
    }
    Ok(name)
}

impl LibraryLink {
    pub fn parse(value: &str) -> Result<Self, &'static str> {
        if value.len() > 2048 || value.chars().any(char::is_control) {
            return Err("Invalid link");
        }
        let url = tauri::Url::parse(value).map_err(|_| "Invalid URL")?;
        if url.scheme() != "plinth"
            || !url.username().is_empty()
            || url.password().is_some()
            || url.port().is_some()
            || url.fragment().is_some()
        {
            return Err("Invalid library link");
        }
        let path = url.path().strip_prefix('/').ok_or("Missing name")?;
        if path.contains('/') {
            return Err("Encode slashes inside names as %2F");
        }
        let name = decode_name(path, false)?;
        match url.host_str() {
            Some("playlist") if url.query().is_none() => Ok(Self::Playlist(name)),
            Some("artist") if url.query().is_none() => Ok(Self::Artist(name)),
            Some("album") => {
                let artist = match url.query() {
                    None => String::new(),
                    Some(query) => {
                        let value = query.strip_prefix("artist=").ok_or("Unknown option")?;
                        if value.contains('&') {
                            return Err("Only one artist option is allowed");
                        }
                        decode_name(value, true)?
                    }
                };
                Ok(Self::Album {
                    title: name,
                    artist,
                })
            }
            _ => Err("Unsupported library destination"),
        }
    }

    /// Both the executable and scripts are fixed; link text is only argv data.
    pub fn script_and_args(&self) -> (&'static str, Vec<&str>) {
        match self {
            Self::Playlist(name) => (include_str!("open_playlist.applescript"), vec![name]),
            Self::Album { title, artist } => (
                include_str!("open_library_album.applescript"),
                vec![title, artist],
            ),
            Self::Artist(name) => (include_str!("open_library_artist.applescript"), vec![name]),
        }
    }
}

/// Route saved Apple Music links through Music's native scheme, avoiding the browser.
/// Everything else falls back to library lookup.
pub fn apple_music_link(value: &str) -> Option<String> {
    let url = tauri::Url::parse(value.trim()).ok()?;
    (url.scheme() == "https" && url.host_str() == Some("music.apple.com"))
        .then(|| url.as_str().replacen("https:", "musics:", 1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overlapping_link_navigation_is_rejected_and_unlocks_after_completion() {
        let navigation = LinkNavigation::begin().unwrap();
        assert!(LinkNavigation::begin().is_none());
        drop(navigation);
        assert!(LinkNavigation::begin().is_some());
    }

    #[test]
    fn parses_only_library_destinations() {
        assert_eq!(
            LibraryLink::parse("plinth://playlist/Evening%20records"),
            Ok(LibraryLink::Playlist("Evening records".into()))
        );
        assert_eq!(
            LibraryLink::parse("plinth://album/Record?artist=An+Artist"),
            Ok(LibraryLink::Album {
                title: "Record".into(),
                artist: "An Artist".into()
            })
        );
        assert_eq!(
            LibraryLink::parse("plinth://album/Record"),
            Ok(LibraryLink::Album {
                title: "Record".into(),
                artist: "".into()
            })
        );
        assert_eq!(
            LibraryLink::parse("plinth://artist/Bj%C3%B6rk"),
            Ok(LibraryLink::Artist("Björk".into()))
        );
        assert_eq!(
            LibraryLink::parse("plinth://playlist/A%2FB%3F%23%26%25+C"),
            Ok(LibraryLink::Playlist("A/B?#&%+C".into()))
        );
    }

    #[test]
    fn rejects_other_actions_options_and_malformed_names() {
        for value in [
            "https://music.apple.com/album/123",
            "file:///tmp/install.sh",
            "javascript:alert(1)",
            "plinth://open/https%3A%2F%2Fexample.com",
            "plinth://run/script",
            "plinth://import/file",
            "plinth://playlist/",
            "plinth://playlist/%20",
            "plinth://playlist/a/b",
            "plinth://playlist/a?command=install",
            "plinth://artist/a?artist=b",
            "plinth://album/a?url=https://example.com",
            "plinth://album/a?artist=b&artist=c",
            "plinth://album/a?artist=b&run=c",
            "plinth://album/a?artist=",
            "plinth://playlist/a#run",
            "plinth://user@playlist/a",
            "plinth://playlist:123/a",
            "plinth://playlist/%00",
            "plinth://playlist/%0A",
            "plinth://playlist/%FF",
            "plinth://playlist/%",
            "plinth://playlist/%2",
            "plinth://playlist/%GG",
            "plinth://playlist/a\n",
        ] {
            assert!(LibraryLink::parse(value).is_err(), "{value}");
        }
        assert!(LibraryLink::parse(&format!("plinth://playlist/{}", "a".repeat(513))).is_err());
        assert!(LibraryLink::parse(&format!("plinth://playlist/{}", "%61".repeat(2048))).is_err());
    }

    #[test]
    fn executable_text_remains_an_argument_to_a_fixed_script() {
        let payload = "\" & do shell script \"touch /tmp/unwanted\" & \" $(curl evil) `id`";
        let mut url = tauri::Url::parse("plinth://playlist/").unwrap();
        url.path_segments_mut().unwrap().push(payload);
        let target = LibraryLink::parse(url.as_str()).unwrap();
        let (script, args) = target.script_and_args();
        assert_eq!(script, include_str!("open_playlist.applescript"));
        assert_eq!(args, vec![payload]);
        assert!(!script.contains(payload));
        let command = script_command(script, &args);
        assert_eq!(command.get_program(), "/usr/bin/osascript");
        assert_eq!(
            command.get_args().collect::<Vec<_>>(),
            vec!["-e", script, "--", payload]
        );
        for prefix in ["plinth://artist/", "plinth://album/"] {
            let mut url = tauri::Url::parse(prefix).unwrap();
            url.path_segments_mut().unwrap().push(payload);
            let target = LibraryLink::parse(url.as_str()).unwrap();
            let (script, args) = target.script_and_args();
            assert_eq!(args[0], payload);
            assert!(!script.contains(payload));
        }
        assert_eq!(decode_name("%2522", false), Ok("%22".into()));
    }

    #[test]
    fn recognizes_apple_music_links() {
        for value in [
            "https://music.apple.com/ca/album/record/123",
            "https://music.apple.com/ca/album/%E3%81%BC%E3%81%8F%E3%82%89%E3%81%AE%E3%81%84%E3%82%8D%E3%81%A8%E3%82%8A%E3%81%A9%E3%82%8A-ep/1156301514",
            " https://MUSIC.APPLE.COM/us/album/record/123?i=456 ",
        ] {
            assert!(apple_music_link(value).is_some(), "{value}");
        }
    }

    #[test]
    fn native_link_preserves_encoded_album_path_and_query() {
        let path = "/ca/album/%E3%81%BC%E3%81%8F%E3%82%89%E3%81%AE%E3%81%84%E3%82%8D%E3%81%A8%E3%82%8A%E3%81%A9%E3%82%8A-ep/1156301514?i=1156301520";
        assert_eq!(
            apple_music_link(&format!("https://music.apple.com{path}")),
            Some(format!("musics://music.apple.com{path}"))
        );
    }

    #[test]
    fn other_links_use_library_lookup() {
        for value in [
            "",
            "not a URL",
            "https://example.com/album/123",
            "http://music.apple.com/ca/album/record/123",
            "https://music.apple.com.example.com/album/123",
            "https://music.apple.com@example.com/album/123",
        ] {
            assert!(apple_music_link(value).is_none(), "{value}");
        }
    }
}
