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
