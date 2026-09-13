/// Use saved Apple Music links; everything else falls back to library lookup.
pub fn apple_music_link(value: &str) -> Option<tauri::Url> {
    let url = tauri::Url::parse(value.trim()).ok()?;
    (url.scheme() == "https" && url.host_str() == Some("music.apple.com")).then_some(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_apple_music_links() {
        for value in [
            "https://music.apple.com/ca/album/record/123",
            " https://MUSIC.APPLE.COM/us/album/record/123?i=456 ",
        ] {
            assert!(apple_music_link(value).is_some(), "{value}");
        }
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
