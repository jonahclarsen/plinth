# Appearance preview: 150 albums in development

This investigation matches the reported workload: 150 visible albums in the development app. All timed experiments ran on standard `macos-15` GitHub Actions runners (ARM64, macOS 15.7.9), with Node 22. No larger runner or local benchmark was used. Artwork and metadata are synthetic; native files use isolated temporary directories.

[Initial rendering and native experiment](https://github.com/jonahclarsen/plinth/actions/runs/34735932308) (`febba7d`, application baseline `90157b7`). [Saving validation](https://github.com/jonahclarsen/plinth/actions/runs/34736564618) (`ba11d72`).

## Verified shipping result

[Final CI run](https://github.com/jonahclarsen/plinth/actions/runs/34737391258), application candidate `1d6fd12` against `90157b7`. The adopted changes defer saves until slider release, load history only when needed, and apply a compositing hint only to the enlarged preview cover. All 150 albums remain rendered. Native persistence and hover animation algorithms are unchanged.

| Final paired rendering test | Input ms before → after | Frame p95 ms before → after | Result |
|---|---:|---:|---|
| Hover size | 7.07 → 4.62 | 94 → 19 | 79.8% lower frame p95; improved in all five pairs |
| Space between covers | 10.68 → 11.28 | 90 → 88 | No clear rendering gain |
| Rounded corners | 14.58 → 14.92 | 118 → 115 | No clear rendering gain |
| Requested visual values | 3× / 40 px / 40 px | Correct in baseline and candidate | All 30 timed rendering samples passed |
| Paused drag, three pairs | 12 saves → 1; 12 history reads → 0 | No save while held | Confirmed again in final build |

The final run also passed all five development checks and all 29 production checks listed below, with no failed, skipped or retried production tests. Type checking had zero errors/warnings and the production build passed. README WebPs were freshly rendered from synthetic demo data; the Appearance capture was visually reviewed (its bytes match the earlier reviewed capture).

## Saving during a drag

The 100 ms debounce could expire between range inputs even while the pointer remained held. Each native save synchronously writes retained history. The application now keeps the preview live, defers the save until release/cancellation/blur, and loads history when the History page or undo/redo needs it. The desktop receives the final saved setting after release. Keyboard edits retain their debounce; undo, hide and quit still flush pending settings.

Each paused-drag trial sends 12 changes, 160 ms apart, and holds the pointer for another 350 ms. Counts exclude setup. Three alternating pairs produced the same counts in every repetition.

| Test | Before | After | Result |
|---|---:|---:|---|
| Saves while the pointer remains held | 12 | 0 | Removed |
| Total saves, including release | 12 | 1 | 91.7% fewer |
| History reads while using Appearance | 12 | 0 | Removed |
| Initial defer-save prototype: total saves | 12 | 1 | Same improvement before on-demand history loading |
| Initial defer-save prototype: history reads | 12 | 1 | Remaining read removed in adopted implementation |

The following timings characterize the existing native code; they are **not before/after speedups of the save itself**. Values are medians of five per-round means; each round measures ten saves and ten history reads. History starts at the stated size and grows during the round. The history command runs on a worker but holds the library lock; the save command is synchronous.

| Native operation, 150 albums | Starting history states | Release ms | Debug ms |
|---|---:|---:|---:|
| Save | 20 | 3.82 | 43.13 |
| Read history | 20 | 2.08 | 16.99 |
| Save | 100 | 13.80 | 169.83 |
| Read history | 100 | 8.36 | 68.66 |

All 200 timed saves, 200 history reads, saved-value reload assertions and 20 undo/redo pairs passed. Both debug and release binaries compiled. The ordinary native unit suite was not rerun in this investigation; native production code was unchanged.

## Rendering experiments

WebKit uses Vite development compilation and 150 distinct 1200 × 1200 JPEG covers, decoded before timing. Each rendering case has a warmup per variant and five alternating pairs of 60 frame-paced input events. Input time includes Svelte microtasks and a layout flush. Frame p95 is the median of each trial’s 95th-percentile interval. These are browser benchmark measurements, not installed-app FPS. The mocked native bridge propagates actual library events but adds no simulated save delay; native persistence is measured separately above.

| Candidate | Slider | Input ms before → after | Frame p95 ms before → after | Decision |
|---|---|---:|---:|---|
| Render at preview pixel size | Columns | 7.38 → 7.45 | 83 → 81 | No consistent benefit |
| Render at preview pixel size | Space between covers | 9.22 → 9.58 | 85 → 85 | No consistent benefit |
| Render at preview pixel size | Rounded corners | 7.50 → 10.70 | 87 → 98 | No consistent benefit |
| Render at preview pixel size | Shadow | 9.38 → 8.58 | 88 → 88 | No consistent benefit |
| Render at preview pixel size | Hover size | 5.70 → 5.88 | 82 → 83 | No consistent benefit |
| Permanent layer per cover | Columns | 7.05 → 6.82 | 81 → 150 | Rejected: worse frame intervals |
| Permanent layer per cover | Space between covers | 8.93 → 10.25 | 80 → 152 | Rejected: worse frame intervals |
| Permanent layer per cover | Rounded corners | 7.50 → 6.77 | 84 → 267 | Rejected: worse frame intervals |
| Permanent layer per cover | Shadow | 8.47 → 7.27 | 85 → 266 | Rejected: worse frame intervals |
| Permanent layer per cover | Hover size | 5.78 → 4.83 | 83 → 19 | Promising; test selective layers |

Every sample mounted all 150 cells and verified that their bounds fit inside the preview before timing. Column sweeps use 18–30 columns so the complete collection fits; no culling is involved. The pixel-size variant deviated by at most 0.155 CSS pixels from initial baseline cell geometry; layer variants matched exactly.

## Focused rendering follow-ups

[Selective layers](https://github.com/jonahclarsen/plinth/actions/runs/34736754203) and [isolated cover components](https://github.com/jonahclarsen/plinth/actions/runs/34736925294) compare against the same saving implementation (`ba11d72`). Each case has five alternating pairs and a warmup per variant.

| Candidate | Slider | Input ms before → after | Frame p95 ms before → after | Assessment |
|---|---|---:|---:|---|
| Layer only enlarged cover | Hover size | 7.88 → 4.62 | 100 → 19 | Adopted; confirmed again in final validation |
| Layer only enlarged cover | Space between covers | 12.00 → 13.67 | 100 → 103 | No demonstrated benefit in this control |
| Layer all covers only during enlargement | Hover size | 10.23 → 5.15 | 118 → 19 | No benefit over isolating just the enlarged cover |
| Layer all covers only during enlargement | Space between covers | 17.48 → 18.18 | 128 → 123 | No demonstrated benefit in this control |
| Isolate immutable cover components | Space between covers | 19.33 → 19.67 | 135 → 130 | No demonstrated benefit |
| Isolate immutable cover components | Hover size | 12.63 → 8.22 | 163 → 19 | Rejected: preview freezes at 2.1× instead of requested 3×; timing invalid |
| Isolate immutable cover components | Rounded corners | 16.62 → 16.63 | 144 → 150 | No demonstrated benefit |

The isolated-cover prototype removes all 9,000 artwork URL evaluations and motion updates from a 60-event spacing sweep, but does not establish a responsiveness improvement. A [dedicated correctness run](https://github.com/jonahclarsen/plinth/actions/runs/34737282645) confirmed the regression: the baseline reaches the requested 3×, but the component prototype remains at 2.1×. The job failed its visual-value assertion. Its apparent hover timing improvement is invalid and the prototype is not shipped. This revealed a Svelte update dependency that would have to be addressed in any future component split.

## Resting-cover radius updates

[Radius experiment](https://github.com/jonahclarsen/plinth/actions/runs/34737203844), five alternating pairs against `ba11d72`.

| Candidate | Slider | Input ms before → after | Frame p95 ms before → after | Decision |
|---|---|---:|---:|---|
| Apply radius immediately to resting covers | Rounded corners | 16.62 → 15.90 | 196 → 161 | Timing inconclusive; not adopted |

The aggregate medians look better, but only three of five paired frame comparisons improved; the median paired change was just 0.7% faster. This removes approximately 9,300 animation callbacks per 60-event sweep, yet does not establish a repeatable responsiveness gain. Hover scale/radius animation would remain unchanged in this prototype. No shipping motion code is changed.

## Behavior checks

Both the saving-only validation and final shipping validation passed five development-build checks and 29 production-build checks in WebKit. The table lists every test; results apply to both runs.

| Test | Development | Production |
|---|---|---|
| pauses during a held appearance slider create one saved history state | Passed | Passed |
| blur commits the final appearance value | Passed | Passed |
| pointercancel commits the final appearance value | Passed | Passed |
| undo flushes the held slider value before navigating history | Passed | Passed |
| keyboard range edits still save without a pointer drag | Passed | Passed |
| holding Hover size previews one album, follows dragging, and ends on release outside | — | Passed |
| right-click does not preview; cancellation and blur clear the sample | — | Passed |
| hover-size sample works with hover disabled and an empty library is harmless | — | Passed |
| hover speed is saved in history and corners animate with scale | — | Passed |
| background hover option sits beneath enlarge and restores through history | — | Passed |
| rounded corners on hover default off and restore independently for each display | — | Passed |
| native pointer events stay on their display (4K, background=false) | — | Passed |
| native pointer events stay on their display (4K, background=true) | — | Passed |
| native pointer events stay on their display (Mac, background=false) | — | Passed |
| native pointer events stay on their display (Mac, background=true) | — | Passed |
| automatic row spacing balances the menu-bar and screen-bottom gaps | — | Passed |
| preview shares balanced spacing and manual spacing can be undone or reset | — | Passed |
| opacity and surrounding-cover dimming controls and effects are absent | — | Passed |
| covers stay square across cover spacing and column settings | — | Passed |
| horizontal and manual row spacing are independent and cells remain square | — | Passed |
| History sits between Appearance and Settings and saves full metadata states | — | Passed |
| undo flushes pending appearance changes and restores the preview and desktop toggle | — | Passed |
| new changes after undo retain abandoned states and Restore returns to either branch | — | Passed |
| undo restores removed albums and both artwork variants | — | Passed |
| imports are one state per batch and duplicates and no-op saves do not add history | — | Passed |
| text undo and modal shortcuts do not navigate saved history | — | Passed |
| all history entries remain reachable in a narrow window | — | Passed |
| cached hover geometry follows resize, columns, and scrolling | — | Passed |
| README screenshots use only synthetic demo artwork | — | Passed |

| Other check | Result |
|---|---|
| Isolated-component hover correctness | Baseline passed (3×); prototype failed (2.1×). Rejected. |
| Type checks: original baseline and all three initial candidates | Passed |
| Type checks: isolated-cover, resting-radius and corresponding baseline variants | Passed |
| Type checks: saving implementation | Passed, zero warnings |
| Production build: saving implementation | Passed |
| Synthetic README WebP capture | Passed; Appearance image visually reviewed |

## Limits and raw data

Native timings exclude the full Tauri/WKWebView event loop and desktop broadcast/rendering cost. They identify costly work removed from dragging; they do not prove a particular improvement on the user’s Mac. CI frame timing varies between jobs, so comparisons use paired trials within one job. The paused-drag intervals intentionally include 160 ms waits and must not be interpreted as frame rate.

Raw data: [initial rendering](initial-web.json), [debug/release persistence](native.json), [saving bridge counts](saving-validation.json), [saving behavior checks](saving-checks.json), [selective layers](selective-layers.json), [isolated components](isolated-cells.json), [component correctness failure](isolated-cells-correctness.json), [resting radius](rest-radius.json), [final rendering and bridge counts](final-web.json), [final production checks](final-checks.json). Historical desktop experiments and already-shipped changes are documented [separately](../../performance/results/adoption/README.md).
