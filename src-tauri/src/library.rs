use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub date: String,
    pub url: String,
    pub cover: String,
    pub original: String,
    pub enabled: bool,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Layout {
    pub columns: u32,
    pub gap: f64,
    pub row_gap: f64,
    pub top: f64,
    pub radius: f64,
    pub shadow: f64,
}
impl Default for Layout {
    fn default() -> Self {
        Self {
            columns: 12,
            gap: 6.,
            row_gap: 14.,
            top: 42.,
            radius: 5.,
            shadow: 0.4,
        }
    }
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub logo: crate::branding::Logo,
    pub layout: Layout,
    pub wide_layout: Layout,
    pub hover_scale: f64,
    pub hover_enabled: bool,
    pub dim_others: bool,
    pub opacity: f64,
    pub sort: String,
    pub shuffle_seed: u32,
    pub theme: String,
    pub desktop_enabled: bool,
    pub open_mode: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            logo: crate::branding::Logo::default(),
            layout: Layout::default(),
            wide_layout: Layout {
                columns: 18,
                ..Layout::default()
            },
            hover_scale: 2.1,
            hover_enabled: true,
            dim_others: false,
            opacity: 1.,
            sort: "artist".into(),
            shuffle_seed: 0,
            theme: "dark".into(),
            desktop_enabled: true,
            open_mode: "library".into(),
        }
    }
}
#[derive(Clone, Serialize, Deserialize, Default, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Library {
    pub albums: Vec<Album>,
    pub settings: Settings,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub added: usize,
    pub duplicates: usize,
    pub errors: Vec<String>,
}
pub fn data_dir() -> PathBuf {
    dirs::data_dir()
        .expect("OS data directory unavailable")
        .join("com.plinth.desktop")
}
pub fn load(dir: &Path) -> Result<Library, String> {
    let path = dir.join("library.json");
    if !path.exists() {
        return Ok(Library::default());
    }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot read saved library: {e}"))
}
pub fn save(dir: &Path, library: &Library) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join("library.json");
    let temp = dir.join("library.json.tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(library).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if path.exists() {
        fs::copy(&path, dir.join("library.previous.json")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, path).map_err(|e| e.to_string())
}
pub fn metadata(filename: &str) -> (String, String, String, String) {
    let stem = Path::new(filename)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy();
    let (name, link) = stem.split_once('=').unwrap_or((&stem, ""));
    let re = regex::Regex::new(r"\s*\((\d{4}[-:]\d{2}[-:]\d{2})\)").unwrap();
    let date = re
        .captures(name)
        .map(|c| c[1].replace(':', "-"))
        .unwrap_or_default();
    let clean = re.replace(name, "");
    let (artist, title) = clean.split_once(" - ").unwrap_or(("", &clean));
    let parts: Vec<&str> = link.split('=').collect();
    let url = if parts.len() >= 3 && ["album", "playlist", "artist"].contains(&parts[0]) {
        format!("https://music.apple.com/ca/{}", parts.join("/"))
    } else {
        String::new()
    };
    (title.trim().to_owned(), artist.trim().to_owned(), date, url)
}
pub fn prepare_artwork(dir: &Path, path: &Path) -> Result<Album, String> {
    let meta = fs::metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("Select image files, not folders".into());
    }
    if meta.len() > 100 * 1024 * 1024 {
        return Err("Image exceeds 100 MB".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let id = format!("{:x}", Sha256::digest(&bytes));
    let mut reader = image::ImageReader::new(std::io::Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(24000);
    limits.max_image_height = Some(24000);
    limits.max_alloc = Some(512 * 1024 * 1024);
    reader.limits(limits);
    let decoded = reader.decode().map_err(|e| e.to_string())?;
    let resized = if decoded.width() > 1200 || decoded.height() > 1200 {
        decoded.resize(1200, 1200, image::imageops::FilterType::Lanczos3)
    } else {
        decoded
    };
    fs::create_dir_all(dir.join("covers")).map_err(|e| e.to_string())?;
    fs::create_dir_all(dir.join("originals")).map_err(|e| e.to_string())?;
    let cover = format!("{id}.jpg");
    let original = format!(
        "{id}.{}",
        path.extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase()
    );
    let mut out = std::io::BufWriter::new(
        fs::File::create(dir.join("covers").join(&cover)).map_err(|e| e.to_string())?,
    );
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 90)
        .encode_image(&resized.to_rgb8())
        .map_err(|e| e.to_string())?;
    use std::io::Write;
    out.flush().map_err(|e| e.to_string())?;
    fs::write(dir.join("originals").join(&original), bytes).map_err(|e| e.to_string())?;
    let (title, artist, date, url) =
        metadata(&path.file_name().unwrap_or_default().to_string_lossy());
    Ok(Album {
        id,
        title,
        artist,
        date,
        url,
        cover,
        original,
        enabled: true,
    })
}
pub fn import(
    dir: &Path,
    library: &mut Library,
    paths: Vec<PathBuf>,
) -> Result<ImportResult, String> {
    let mut result = ImportResult {
        added: 0,
        duplicates: 0,
        errors: vec![],
    };
    let mut files = paths;
    files.sort();
    for path in files {
        let attempt = (|| -> Result<bool, String> {
            if !path.is_file() {
                return Err("Select image files, not folders".into());
            }
            if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 100 * 1024 * 1024 {
                return Err("Image exceeds 100 MB".into());
            }
            let digest = format!(
                "{:x}.jpg",
                Sha256::digest(fs::read(&path).map_err(|e| e.to_string())?)
            );
            if library.albums.iter().any(|a| a.cover == digest) {
                return Ok(false);
            }
            library.albums.push(prepare_artwork(dir, &path)?);
            Ok(true)
        })();
        match attempt {
            Ok(true) => result.added += 1,
            Ok(false) => result.duplicates += 1,
            Err(e) => result.errors.push(format!(
                "{}: {e}",
                path.file_name().unwrap_or_default().to_string_lossy()
            )),
        }
    }
    save(dir, library)?;
    Ok(result)
}
pub fn replace_artwork(
    dir: &Path,
    library: &mut Library,
    id: &str,
    path: &Path,
) -> Result<Album, String> {
    let index = library
        .albums
        .iter()
        .position(|a| a.id == id)
        .ok_or("Album not found")?;
    let artwork = prepare_artwork(dir, path)?;
    let mut updated = library.clone();
    updated.albums[index].cover = artwork.cover;
    updated.albums[index].original = artwork.original;
    save(dir, &updated)?;
    *library = updated;
    Ok(library.albums[index].clone())
}
pub fn validate_settings(s: &Settings) -> Result<(), String> {
    for l in [&s.layout, &s.wide_layout] {
        if !(3..=30).contains(&l.columns)
            || ![l.gap, l.row_gap, l.top, l.radius, l.shadow]
                .iter()
                .all(|v| v.is_finite() && *v >= 0.)
            || l.gap > 40.
            || l.row_gap > 80.
            || l.top > 200.
            || l.radius > 40.
            || l.shadow > 1.
        {
            return Err("Layout values are outside their supported range".into());
        }
    }
    if !s.hover_scale.is_finite()
        || !(1.0..=3.0).contains(&s.hover_scale)
        || !s.opacity.is_finite()
        || !(0.1..=1.).contains(&s.opacity)
    {
        return Err("Invalid appearance values".into());
    }
    if !["artist", "title", "date", "oldest", "shuffle"].contains(&s.sort.as_str())
        || !["dark", "light", "system"].contains(&s.theme.as_str())
        || !["library", "link"].contains(&s.open_mode.as_str())
    {
        return Err("Invalid setting".into());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn imports_legacy_metadata() {
        let (t, a, d, u) = metadata("Artist - Title - EP (2025:04:03) =album=title=123.png");
        assert_eq!(
            (t.as_str(), a.as_str(), d.as_str()),
            ("Title - EP", "Artist", "2025-04-03")
        );
        assert_eq!(u, "https://music.apple.com/ca/album/title/123");
    }
    #[test]
    fn legacy_names_with_suffix_or_no_link_spacing() {
        let (title, _, date, _) =
            metadata("Artist - Record (2021:12:21) - EP =album=record=123.png");
        assert_eq!(title, "Record - EP");
        assert_eq!(date, "2021-12-21");
        let (title, _, date, url) = metadata("Artist - Record (2021:12:21)=album=record=123.png");
        assert_eq!(title, "Record");
        assert_eq!(date, "2021-12-21");
        assert_eq!(url, "https://music.apple.com/ca/album/record/123");
    }
    #[test]
    fn plain_filename_works() {
        assert_eq!(metadata("A cover.webp").0, "A cover");
    }
    #[test]
    fn replacement_preserves_metadata_and_originals() {
        let dir = std::env::temp_dir().join(format!("plinth-replace-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let first = dir.join("Artist - Title.png");
        let second = dir.join("Replacement.png");
        image::RgbImage::new(20, 20).save(&first).unwrap();
        image::RgbImage::new(25, 25).save(&second).unwrap();
        let mut lib = Library::default();
        import(&dir, &mut lib, vec![first]).unwrap();
        let old = lib.albums[0].clone();
        let album = replace_artwork(&dir, &mut lib, &old.id, &second).unwrap();
        assert_eq!(album.id, old.id);
        assert_eq!(album.title, old.title);
        assert_ne!(album.original, old.original);
        assert!(dir.join("originals").join(old.original).exists());
        assert_eq!(load(&dir).unwrap().albums.len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn legacy_bottom_spacing_is_ignored_on_load_and_removed_on_save() {
        let settings: Settings = serde_json::from_value(serde_json::json!({
            "layout": {"columns": 9, "bottom": 1800},
            "wideLayout": {"columns": 20, "bottom": 2000}
        }))
        .unwrap();
        assert_eq!(settings.layout.columns, 9);
        assert_eq!(settings.wide_layout.columns, 20);
        assert!(validate_settings(&settings).is_ok());
        let saved = serde_json::to_value(&settings).unwrap();
        assert!(saved["layout"].get("bottom").is_none());
        assert!(saved["wideLayout"].get("bottom").is_none());
    }
    #[test]
    fn invalid_settings_rejected() {
        let mut s = Settings::default();
        s.layout.columns = 0;
        assert!(validate_settings(&s).is_err());
    }
    #[test]
    fn import_preserves_original_deduplicates_and_survives_reload() {
        let dir = std::env::temp_dir().join(format!("plinth-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let src = dir.join("Artist - Record (2024-01-01).png");
        image::RgbImage::new(20, 20).save(&src).unwrap();
        let bytes = fs::read(&src).unwrap();
        let mut lib = Library::default();
        let r = import(&dir, &mut lib, vec![src.clone(), src.clone()]).unwrap();
        assert_eq!((r.added, r.duplicates), (1, 1));
        assert_eq!(
            fs::read(dir.join("originals").join(&lib.albums[0].original)).unwrap(),
            bytes
        );
        assert_eq!(load(&dir).unwrap().albums[0].title, "Record");
        assert!(src.exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
