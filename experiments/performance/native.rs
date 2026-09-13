// Appended to history.rs only in disposable CI checkouts. Uses actual save/read/write paths.
#[cfg(test)]
mod native_performance {
    use super::*;
    use crate::library::{self, Album};
    use std::time::Instant;
    #[test]
    #[ignore]
    fn measure() {
        let variant = std::env::var("PERF_VARIANT").unwrap();
        let repeat: usize = std::env::var("PERF_REPEAT").unwrap().parse().unwrap();
        for count in [96, 480] {
            for retained in [20, 100] {
                let dir = std::env::temp_dir().join(format!("plinth-perf-{}-{count}-{retained}", std::process::id()));
                fs::create_dir_all(&dir).unwrap();
                let mut library = Library::default();
                library.albums = (0..count).map(|i| Album {
                    id:format!("synthetic-{i}"),title:format!("Record {i}"),artist:format!("Artist {}",i%20),date:"2024-01-01".into(),url:String::new(),cover:format!("{i}.webp"),original:format!("{i}.png"),enabled:true
                }).collect();
                fs::create_dir_all(dir.join("covers")).unwrap();
                fs::create_dir_all(dir.join("originals")).unwrap();
                for album in &library.albums {
                    fs::write(dir.join("covers").join(&album.cover), b"synthetic").unwrap();
                    fs::write(dir.join("originals").join(&album.original), b"synthetic").unwrap();
                }
                let entries = (0..retained).map(|id| Entry {id,parent:id.checked_sub(1),timestamp:0,label:"Changed settings".into(),details:vec!["Synthetic setting".into()],state:library.clone()}).collect();
                let doc=Document{library:library.clone(),history:Some(History{entries,current:retained-1,redo:vec![]}),needs_history:false};
                write(&dir,&doc).unwrap();
                // Warm filesystem and code; reset to identical history length before timing.
                library.settings.layout.radius=6.;library::save(&dir,&library).unwrap();
                library.settings.layout.radius=5.;write(&dir,&doc).unwrap();
                let mut saves=vec![];let mut reads=vec![];
                for i in 0..10 {
                    library.settings.layout.radius=7.+i as f64;
                    let t=Instant::now();library::save(&dir,&library).unwrap();saves.push(t.elapsed().as_secs_f64()*1000.);
                    let t=Instant::now();let view=list(&dir).unwrap();reads.push(t.elapsed().as_secs_f64()*1000.);
                    assert_eq!(view.entries.len(),retained+i+1);
                    assert_eq!(library::load(&dir).unwrap().settings.layout.radius,7.+i as f64);
                }
                let bytes=fs::metadata(dir.join("library.json")).unwrap().len();
                let (undo, _) = navigate(&dir,"undo",None).unwrap();assert_eq!(undo.settings.layout.radius,15.);
                let (redo, _) = navigate(&dir,"redo",None).unwrap();assert_eq!(redo.settings.layout.radius,16.);
                println!("PERF_JSON {}",serde_json::json!({"variant":variant,"repeat":repeat,"count":count,"retained":retained,"saveMs":saves,"listMs":reads,"bytes":bytes}));
                fs::remove_dir_all(dir).unwrap();
            }
        }
    }
}
