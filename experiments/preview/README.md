# Appearance preview investigation

User workload: about 150 albums, all on screen, in the macOS development app. CI uses standard `macos-15` runners, Vite's development compiler in WebKit, 150 distinct synthetic 1200×1200 JPEG covers, and the actual debug/release Rust persistence code in isolated temporary directories.

Untested approaches being compared: render shared desktop geometry at preview pixel size instead of transforming a desktop-sized surface; promote covers to compositing layers; defer saved-state writes while a slider is held. All candidates live only in `.local/preview` in disposable CI checkouts. They are not shipped automatically.

The native bridge in the browser benchmark has real event propagation but no native save latency. The separate debug/release benchmark quantifies that missing persistence cost. It does not measure an installed WKWebView or the full native event loop. Five alternating pairs compare each rendering candidate; paused-drag save counts use three pairs. Hot-path counters record sorting, artwork URL evaluation, motion action updates and callbacks. Rectangle containment checks ensure no artwork is omitted or off screen. Timed inputs include microtask and layout flushing; frame intervals include subsequent animation/paint scheduling.

The known horizontal-spacing fix at `90157b7` is part of this baseline. Benchmarks are run on CI, not against the user's live library.
