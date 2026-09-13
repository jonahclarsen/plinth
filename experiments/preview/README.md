# Appearance preview investigation

[Results and the table of every test](results/README.md).

User workload: about 150 albums, all on screen, in the macOS development app. CI uses standard `macos-15` runners, Vite's development compiler in WebKit, 150 distinct synthetic 1200×1200 JPEG covers, and actual debug/release Rust persistence code in isolated temporary directories. Never benchmark against the user's live library.

The experiments compare preview-size rendering, compositing layers, saving after release, isolated cover components, and immediate radius changes for resting covers. The shared desktop geometry remains the source of truth. Candidates live in `.local/preview` in disposable CI checkouts; preparing a candidate does not change shipping source.

The native bridge in the browser benchmark propagates library events but adds no simulated native save latency. The separate debug/release benchmark quantifies persistence cost. Neither measures an installed WKWebView or the full native event loop. Rendering trials use five alternating pairs after warmups; paused-drag save counts use three pairs. Hot-path counters record sorting, artwork URL evaluation, motion updates and animation callbacks. Rectangle containment checks ensure every sample starts with all 150 albums mounted and visible. Timed inputs include microtask and layout flushing; frame intervals include subsequent animation/paint scheduling.

Original rendering variants are pinned to `90157b7`, including the explicit horizontal-spacing fix. Focused variants use `ba11d72`, including deferred drag saves and on-demand history loading in both baseline and candidate. Adoption validation compares current source against `90157b7`. Visual-value assertions prevent a frozen preview from counting as a speedup.

CI entry points:

- `preview-performance.yml`: original five-slider rendering sweep plus debug/release persistence.
- `preview-layers.yml`: focused follow-up, with `layers`, `cells`, `radius`, and `cells-check` workflow inputs. The last input is a correctness check of the isolated-component prototype, not a timing result.
- `preview-validation.yml`: development and production behavior, final paired rendering trials, paused-drag bridge counts, and freshly rendered synthetic README WebPs.

`node experiments/preview/summarize.mjs <downloaded-results.json>` analyzes existing CI artifacts without running an experiment locally. Native timings are medians of per-round means; browser input times and frame p95 are medians of per-trial values. Do not compare absolute timing between different CI jobs.
