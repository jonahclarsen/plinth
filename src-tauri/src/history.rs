use crate::library::{Library, Settings};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: usize,
    parent: Option<usize>,
    timestamp: u64,
    label: String,
    details: Vec<String>,
    state: Library,
}
#[derive(Serialize, Deserialize)]
struct History {
    entries: Vec<Entry>,
    current: usize,
    redo: Vec<usize>,
}
#[derive(Serialize, Deserialize)]
struct Document {
    #[serde(flatten)]
    library: Library,
    #[serde(default)]
    history: Option<History>,
    #[serde(skip)]
    needs_history: bool,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    id: usize,
    parent: Option<usize>,
    timestamp: u64,
    label: String,
    details: Vec<String>,
    album_count: usize,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryView {
    entries: Vec<HistoryEntry>,
    current: usize,
    can_undo: bool,
    can_redo: bool,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn same(a: &Library, b: &Library) -> bool {
    serde_json::to_value(a).ok() == serde_json::to_value(b).ok()
}
fn read(dir: &Path) -> Result<Document, String> {
    let path = dir.join("library.json");
    let mut document: Document = if path.exists() {
        serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
            .map_err(|e| format!("Cannot read saved history: {e}"))?
    } else {
        Document {
            library: Library::default(),
            history: None,
            needs_history: false,
        }
    };
    if let Some(history) = &document.history {
        if history.entries.is_empty()
            || history.current >= history.entries.len()
            || history.entries.iter().enumerate().any(|(index, entry)| {
                entry.id != index || entry.parent.is_some_and(|parent| parent >= index)
            })
            || history.redo.iter().any(|id| *id >= history.entries.len())
            || !same(&document.library, &history.entries[history.current].state)
        {
            return Err("Saved history is inconsistent; the library has not been changed".into());
        }
    } else {
        document.needs_history = true;
        document.history = Some(History {
            entries: vec![Entry {
                id: 0,
                parent: None,
                timestamp: now(),
                label: "Starting state".into(),
                details: vec!["History begins with this collection and its settings.".into()],
                state: document.library.clone(),
            }],
            current: 0,
            redo: vec![],
        });
    }
    Ok(document)
}
fn write(dir: &Path, document: &Document) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join("library.json");
    let temp = dir.join("library.json.tmp");
    // The active library and every saved state are committed in one atomic rename.
    fs::write(
        &temp,
        serde_json::to_vec(document).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if path.exists() {
        fs::copy(&path, dir.join("library.previous.json")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, path).map_err(|e| e.to_string())
}
fn view(history: &History) -> HistoryView {
    HistoryView {
        entries: history
            .entries
            .iter()
            .map(|entry| HistoryEntry {
                id: entry.id,
                parent: entry.parent,
                timestamp: entry.timestamp,
                label: entry.label.clone(),
                details: entry.details.clone(),
                album_count: entry.state.albums.len(),
            })
            .collect(),
        current: history.current,
        can_undo: history.entries[history.current].parent.is_some(),
        can_redo: !history.redo.is_empty(),
    }
}
pub fn list(dir: &Path) -> Result<HistoryView, String> {
    let document = read(dir)?;
    // Persist the baseline even if the user hasn't made their first change yet.
    if document.needs_history {
        write(dir, &document)?;
    }
    Ok(view(document.history.as_ref().unwrap()))
}
fn display(value: &Value) -> String {
    match value {
        Value::Null => "Automatic".into(),
        Value::String(text) if text.is_empty() => "Empty".into(),
        Value::String(text) => text.clone(),
        Value::Bool(value) => if *value { "On" } else { "Off" }.into(),
        _ => value.to_string(),
    }
}
fn settings_details(before: &Settings, after: &Settings) -> Vec<String> {
    let before_space = crate::spaces::label(before.all_spaces, before.target_space);
    let after_space = crate::spaces::label(after.all_spaces, after.target_space);
    let before = serde_json::to_value(before).unwrap();
    let after = serde_json::to_value(after).unwrap();
    let mut details = vec![];
    if before_space != after_space {
        details.push(format!("Spaces: {before_space} → {after_space}"));
    }
    let names = [
        ("theme", "App appearance"),
        ("logo", "App logo"),
        ("desktopEnabled", "Show desktop"),
        ("sort", "Sort order"),
        ("shuffleSeed", "Shuffle order"),
        ("hoverScale", "Hover size"),
        ("hoverSpeed", "Hover speed"),
        ("hoverEnabled", "Enlarge on hover"),
        ("hoverInBackground", "While another app has focus"),
        ("pushNeighbors", "Push nearby artwork"),
    ];
    for (key, name) in names {
        if before[key] != after[key] {
            let format = |value: &Value| {
                if key == "hoverSpeed" {
                    format!("{:.0} ms", (250. / value.as_f64().unwrap_or(1.)).round())
                } else {
                    display(value)
                }
            };
            details.push(format!(
                "{name}: {} → {}",
                format(&before[key]),
                format(&after[key])
            ));
        }
    }
    for (key, name) in [("layout", "Mac display"), ("wideLayout", "4K monitor")] {
        for (field, label) in [
            ("columns", "Columns"),
            ("gap", "Space between covers"),
            ("rowGap", "Space between rows"),
            ("top", "Top clearance"),
            ("radius", "Rounded corners"),
            ("roundedOnHover", "Rounded corners when hovered"),
            ("shadow", "Shadow"),
        ] {
            if before[key][field] != after[key][field] {
                details.push(format!(
                    "{name} · {label}: {} → {}",
                    display(&before[key][field]),
                    display(&after[key][field])
                ));
            }
        }
    }
    details
}
fn describe(before: &Library, after: &Library) -> (String, Vec<String>) {
    let mut details = vec![];
    let mut added = 0;
    let mut removed = 0;
    let mut edited = 0;
    let mut artwork = 0;
    for album in &after.albums {
        if let Some(old) = before.albums.iter().find(|old| old.id == album.id) {
            let old_json = serde_json::to_value(old).unwrap();
            let new_json = serde_json::to_value(album).unwrap();
            let mut changed = false;
            for (key, label) in [
                ("title", "Title"),
                ("artist", "Artist"),
                ("date", "Release date"),
                ("url", "Album link"),
                ("enabled", "Show on desktop"),
            ] {
                if old_json[key] != new_json[key] {
                    details.push(format!(
                        "{} · {label}: {} → {}",
                        old.title,
                        display(&old_json[key]),
                        display(&new_json[key])
                    ));
                    changed = true;
                }
            }
            if changed {
                edited += 1;
            }
            if old.cover != album.cover || old.original != album.original {
                artwork += 1;
                details.push(format!("{} · Replaced artwork", album.title));
            }
        } else {
            added += 1;
            details.push(format!("Added {} — {}", album.title, album.artist));
        }
    }
    for album in &before.albums {
        if !after.albums.iter().any(|next| next.id == album.id) {
            removed += 1;
            details.push(format!("Removed {} — {}", album.title, album.artist));
        }
    }
    let settings = settings_details(&before.settings, &after.settings);
    let mut labels = vec![];
    if added > 0 {
        labels.push(format!(
            "Added {added} album{}",
            if added == 1 { "" } else { "s" }
        ));
    }
    if removed > 0 {
        labels.push(format!(
            "Removed {removed} album{}",
            if removed == 1 { "" } else { "s" }
        ));
    }
    if edited > 0 {
        labels.push(if edited == 1 {
            "Edited album".into()
        } else {
            format!("Edited {edited} albums")
        });
    }
    if artwork > 0 {
        labels.push("Replaced artwork".into());
    }
    if !settings.is_empty() {
        labels.push("Changed settings".into());
    }
    details.extend(settings);
    (
        if labels.is_empty() {
            "Updated collection".into()
        } else {
            labels.join(" · ")
        },
        details,
    )
}
pub fn record(dir: &Path, library: &Library) -> Result<(), String> {
    let mut document = read(dir)?;
    if same(&document.library, library) {
        return if document.needs_history {
            write(dir, &document)
        } else {
            Ok(())
        };
    }
    let (label, details) = describe(&document.library, library);
    let history = document.history.as_mut().unwrap();
    let id = history.entries.len();
    history.entries.push(Entry {
        id,
        parent: Some(history.current),
        timestamp: now(),
        label,
        details,
        state: library.clone(),
    });
    history.current = id;
    // Keep abandoned states in entries; only the active redo path is cleared.
    history.redo.clear();
    document.library = library.clone();
    write(dir, &document)
}
pub fn navigate(
    dir: &Path,
    action: &str,
    id: Option<usize>,
) -> Result<(Library, HistoryView), String> {
    let mut document = read(dir)?;
    let history = document.history.as_mut().unwrap();
    match action {
        "undo" => {
            let parent = history.entries[history.current]
                .parent
                .ok_or("Nothing to undo")?;
            history.redo.push(history.current);
            history.current = parent;
        }
        "redo" => history.current = history.redo.pop().ok_or("Nothing to redo")?,
        "restore" => {
            let target = id
                .filter(|id| *id < history.entries.len())
                .ok_or("History state not found")?;
            if target == history.current {
                return Ok((document.library.clone(), view(history)));
            }
            // When moving back along this branch, keep the route forward for Redo.
            let mut cursor = history.current;
            let mut route = vec![];
            while cursor != target {
                route.push(cursor);
                if let Some(parent) = history.entries[cursor].parent {
                    cursor = parent;
                } else {
                    break;
                }
            }
            if cursor == target {
                history.redo.extend(route);
            } else if let Some(position) = history.redo.iter().position(|id| *id == target) {
                history.redo.truncate(position);
            } else {
                history.redo.clear();
            }
            history.current = target;
        }
        _ => return Err("Unknown history action".into()),
    }
    let restored = history.entries[history.current].state.clone();
    crate::library::validate_settings(&restored.settings)?;
    for album in &restored.albums {
        if !dir.join("originals").join(&album.original).is_file()
            || !dir.join("covers").join(&album.cover).is_file()
        {
            return Err(format!(
                "Artwork for {} is missing. Restore its files from backup first.",
                album.title
            ));
        }
    }
    let result = view(history);
    document.library = restored.clone();
    write(dir, &document)?;
    Ok((restored, result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library;

    #[test]
    fn hover_speed_details_use_milliseconds() {
        let before = Settings::default();
        let mut after = before.clone();
        after.hover_speed = 0.25;
        assert_eq!(
            settings_details(&before, &after),
            vec!["Hover speed: 250 ms → 1000 ms"]
        );
        after.hover_speed = 3.;
        assert_eq!(
            settings_details(&before, &after),
            vec!["Hover speed: 250 ms → 83 ms"]
        );
    }

    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new(name: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("plinth-history-{name}-{}", std::process::id()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn migrates_existing_library_and_retains_redo_across_restarts() {
        let dir = Fixture::new("migration");
        let initial = Library::default();
        fs::write(
            dir.0.join("library.json"),
            serde_json::to_vec(&initial).unwrap(),
        )
        .unwrap();
        let baseline = list(&dir.0).unwrap();
        assert_eq!(baseline.entries.len(), 1);
        assert!(!baseline.can_undo);
        let mut next = initial.clone();
        next.settings.theme = "light".into();
        library::save(&dir.0, &next).unwrap();
        library::save(&dir.0, &next).unwrap();
        assert_eq!(
            list(&dir.0).unwrap().entries.len(),
            2,
            "No-op saves don't create states"
        );
        let (restored, history) = navigate(&dir.0, "undo", None).unwrap();
        assert_eq!(restored.settings.theme, "dark");
        assert!(history.can_redo);
        assert_eq!(library::load(&dir.0).unwrap().settings.theme, "dark");
        let (redone, _) = navigate(&dir.0, "redo", None).unwrap();
        assert_eq!(redone.settings.theme, "light");
        assert_eq!(
            list(&dir.0).unwrap().entries[0].timestamp,
            baseline.entries[0].timestamp
        );
    }
    #[test]
    fn new_edits_preserve_abandoned_states_and_their_parentage() {
        let dir = Fixture::new("branches");
        let mut library = Library::default();
        library.settings.theme = "light".into();
        record(&dir.0, &library).unwrap();
        library.settings.hover_scale = 2.5;
        record(&dir.0, &library).unwrap();
        let (mut restored, _) = navigate(&dir.0, "undo", None).unwrap();
        restored.settings.sort = "title".into();
        record(&dir.0, &restored).unwrap();
        let history = list(&dir.0).unwrap();
        assert_eq!(history.entries.len(), 4);
        assert_eq!(history.entries[3].parent, Some(1));
        assert!(!history.can_redo);
        let (old_branch, _) = navigate(&dir.0, "restore", Some(2)).unwrap();
        assert_eq!(old_branch.settings.hover_scale, 2.5);
        assert_eq!(old_branch.settings.sort, "artist");
        let (_, history) = navigate(&dir.0, "restore", Some(0)).unwrap();
        assert!(history.can_redo);
        assert_eq!(navigate(&dir.0, "redo", None).unwrap().1.current, 1);
        assert_eq!(navigate(&dir.0, "redo", None).unwrap().1.current, 2);
        assert_eq!(list(&dir.0).unwrap().entries.len(), 4);
    }
    #[test]
    fn restores_imports_metadata_replacements_removals_and_settings() {
        let dir = Fixture::new("artwork");
        let source = dir.0.join("Synthetic Artist - Synthetic Album.png");
        let replacement = dir.0.join("Replacement.png");
        image::RgbImage::new(20, 20).save(&source).unwrap();
        image::RgbImage::new(30, 30).save(&replacement).unwrap();
        let mut library = Library::default();
        library::import(&dir.0, &mut library, vec![source]).unwrap();
        let original = library.albums[0].clone();
        library.albums[0].title = "Edited title".into();
        library.albums[0].artist = "Edited artist".into();
        library.albums[0].date = "2024-01-01".into();
        library.albums[0].url = "https://example.com/album".into();
        library.albums[0].enabled = false;
        library::save(&dir.0, &library).unwrap();
        library::replace_artwork(&dir.0, &mut library, &original.id, &replacement).unwrap();
        let replaced = library.albums[0].clone();
        library.albums.clear();
        library.settings.desktop_enabled = false;
        library.settings.all_spaces = false;
        library.settings.layout.columns = 7;
        library::save(&dir.0, &library).unwrap();
        let (restored, _) = navigate(&dir.0, "undo", None).unwrap();
        assert_eq!(restored.albums[0].original, replaced.original);
        assert_eq!(restored.albums[0].title, "Edited title");
        assert!(restored.settings.desktop_enabled);
        assert!(restored.settings.all_spaces);
        let (restored, _) = navigate(&dir.0, "undo", None).unwrap();
        assert_eq!(restored.albums[0].original, original.original);
        assert!(!restored.albums[0].enabled);
        let (restored, _) = navigate(&dir.0, "undo", None).unwrap();
        assert_eq!(restored.albums[0].title, original.title);
        assert!(restored.albums[0].enabled);
        let (restored, _) = navigate(&dir.0, "undo", None).unwrap();
        assert!(restored.albums.is_empty());
        assert!(dir.0.join("originals").join(original.original).exists());
        assert!(dir.0.join("originals").join(replaced.original).exists());
        assert_eq!(list(&dir.0).unwrap().entries[2].details.len(), 5);
    }
    #[test]
    fn failed_navigation_and_writes_leave_the_saved_state_intact() {
        let dir = Fixture::new("failures");
        list(&dir.0).unwrap();
        let bytes = fs::read(dir.0.join("library.json")).unwrap();
        assert!(navigate(&dir.0, "undo", None).is_err());
        assert!(navigate(&dir.0, "restore", Some(999)).is_err());
        assert_eq!(fs::read(dir.0.join("library.json")).unwrap(), bytes);
        fs::create_dir(dir.0.join("library.json.tmp")).unwrap();
        let mut library = Library::default();
        library.settings.theme = "light".into();
        assert!(record(&dir.0, &library).is_err());
        assert_eq!(fs::read(dir.0.join("library.json")).unwrap(), bytes);
    }
    #[test]
    fn missing_artwork_does_not_partially_restore_history() {
        let dir = Fixture::new("missing");
        let source = dir.0.join("Synthetic.png");
        image::RgbImage::new(20, 20).save(&source).unwrap();
        let mut library = Library::default();
        library::import(&dir.0, &mut library, vec![source]).unwrap();
        let original = library.albums[0].original.clone();
        library.albums.clear();
        record(&dir.0, &library).unwrap();
        fs::remove_file(dir.0.join("originals").join(original)).unwrap();
        let bytes = fs::read(dir.0.join("library.json")).unwrap();
        assert!(navigate(&dir.0, "undo", None)
            .unwrap_err()
            .contains("missing"));
        assert_eq!(fs::read(dir.0.join("library.json")).unwrap(), bytes);
    }
    #[test]
    fn restoring_forward_keeps_remaining_redo_states() {
        let dir = Fixture::new("forward");
        let mut library = Library::default();
        library.settings.theme = "light".into();
        record(&dir.0, &library).unwrap();
        library.settings.hover_scale = 2.5;
        record(&dir.0, &library).unwrap();
        navigate(&dir.0, "restore", Some(0)).unwrap();
        let (_, history) = navigate(&dir.0, "restore", Some(1)).unwrap();
        assert!(history.can_redo);
        assert_eq!(
            navigate(&dir.0, "redo", None)
                .unwrap()
                .0
                .settings
                .hover_scale,
            2.5
        );
    }
    #[test]
    fn corrupt_history_is_not_overwritten_and_failed_import_does_not_change_memory() {
        let dir = Fixture::new("corruption");
        list(&dir.0).unwrap();
        let mut document: Value =
            serde_json::from_slice(&fs::read(dir.0.join("library.json")).unwrap()).unwrap();
        document["history"]["current"] = 999.into();
        let bytes = serde_json::to_vec(&document).unwrap();
        fs::write(dir.0.join("library.json"), &bytes).unwrap();
        assert!(list(&dir.0).is_err());
        let source = dir.0.join("Synthetic.png");
        image::RgbImage::new(20, 20).save(&source).unwrap();
        let mut library = Library::default();
        assert!(library::import(&dir.0, &mut library, vec![source]).is_err());
        assert!(library.albums.is_empty());
        assert_eq!(fs::read(dir.0.join("library.json")).unwrap(), bytes);
    }
}
