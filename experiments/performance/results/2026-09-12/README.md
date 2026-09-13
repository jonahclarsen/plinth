# Plinth performance investigation — 12 September 2026

**Subsequent adoption:** Compact JSON and cached desktop hit testing were validated against the newer `cb831bc` baseline and adopted at the user’s request. See the [adoption tests and measurements](../adoption/README.md). The investigation below records the earlier experiments.

**Live slider lag remains unresolved by these experiments.** Compact native JSON and cached desktop hit testing reduced measured work; the tested radius changes did not establish a useful slider improvement with every album on screen. No application optimization has been adopted.

**Measured application revision: `12cc657`.** Concurrent changes through `bf5dd13` landed on `main` during CI, including explicit cover geometry, hover options and window placement. They were preserved and were not part of these measurements. Do not treat these numbers as measurements of the current build. The harness is pinned to the measured revision for reproduction; a current-build comparison would require updating the experiments.

All performance experiments ran on GitHub's standard `macos-15` Apple Silicon runner. This public repository qualifies for free standard hosted runners, so compute cost was $0. [GitHub runner policy](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

The user clarified that **all albums always fit on screen**. Offscreen culling is therefore excluded from recommendations. The first two runs' overflowing 480-album frontend configurations are historical experiments, not evidence for this app's target workload. The corrected run asserts that every album cell is mounted and contained within the screen, including every spacing setting tested.

Every timed configuration and named correctness test is tabulated in the run reports, including unhelpful and inapplicable experiments:

| Run | Purpose | Test tables and measurements | CI |
|---|---|---|---|
| 1 | Initial radius, hit-test caching, compact JSON, indexed history lookup | [All tests](run-1/summary.md), [frontend summaries](run-1/web.json), [native raw samples](run-1/native.json) | [Run 1](https://github.com/jonahclarsen/plinth/actions/runs/34721963321) |
| 2 | Refined CSS radius, offscreen culling (inapplicable), hit-test caching, native confirmation | [All tests](run-2/summary.md), [frontend raw samples](run-2/web.json), [native raw samples](run-2/native.json) | [Run 2](https://github.com/jonahclarsen/plinth/actions/runs/34722872703) |
| 3 | All albums on screen: radius CSS, spacing/held-hover controls, hit-test caching, native confirmation | [All tests](run-3/summary.md), [frontend raw samples](run-3/web.json), [native raw samples](run-3/native.json) | [Run 3](https://github.com/jonahclarsen/plinth/actions/runs/34723717199) |

## Applicable findings (run 3)

All frontend cells are mounted and on screen. Each row below summarizes five paired repetitions. Millisecond values are baseline → candidate. The complete per-configuration tables, named tests and raw samples are linked above.

| Experiment | 96 albums | 480 albums | Assessment |
|---|---|---|---|
| CSS radius: Rounded corners input work | 5.50 → 7.01 ms | 28.59 → 28.46 ms | No useful slider improvement. Frame p95: 60 → 66 ms and 260 → 257 ms. |
| CSS radius: spacing control input work | 10.58 → 13.29 ms | 74.83 → 76.02 ms | No improvement. |
| CSS radius: held Hover size input work | 5.20 → 5.41 ms | 13.38 → 13.40 ms | No improvement. |
| Cached desktop hit testing | 1.08 → 0.37 ms (66% less work) | 1.61 → 0.89 ms (45% less work) | 5/5 paired wins at both sizes. No established overall frame-rate gain: frame p95 20 → 19 ms and 63 → 63 ms. |
| Compact JSON: save, 20 starting history states | 3.39 → 2.47 ms | 15.87 → 12.67 ms | 27% / 20% faster. |
| Compact JSON: save, 100 starting history states | 12.17 → 7.68 ms | 63.54 → 43.78 ms | 37% / 31% faster. |
| Compact JSON: history list, 20 starting states | 1.76 → 1.30 ms | 8.45 → 6.85 ms | 26% / 19% faster. |
| Compact JSON: history list, 100 starting states | 6.65 → 5.12 ms | 34.39 → 24.58 ms | 23% / 29% faster. |
| Indexed history album lookup | Mixed across three runs | Mixed across three runs | No repeatable improvement; do not adopt on this evidence. |
| Offscreen culling | Not applicable | Not applicable | Excluded: albums never live off screen in actual usage. |
| Frontend behavior checks | 18 passed in run 3 | Includes hover, geometry, history and pointer isolation | Prior runs also passed (17 and 18). |
| Native behavior checks | 23 tests passed per native variant | Baseline, compact and indexed, in all three runs | 207 native regression executions passed; benchmark assertions passed separately. |

Compact JSON kept backup, atomic rename, retained states and undo/redo intact while reducing saved document size by approximately 51%. This helps persistence, not necessarily continuous dragging: saves are debounced in the app, and the frontend benchmark intentionally excludes native persistence.

The CSS-radius candidate removed more than 99% of inline style writes/animation callbacks during the radius sweep, but this did not translate into a useful all-visible frame-time improvement. Some work moves from deferred animation into the input's style/layout flush; operation counts alone are not sufficient justification to adopt it.

Cache measurements exclude the one-time geometry fill from warm per-event timing; raw results also include cold timing and read counts. The cache still scans stored rectangles and must be invalidated on geometry changes. Correctness checks cover resizing, column changes, scrolling and display targeting, but not every possible future layout change.

The next investigation worth considering is a style/layout/paint profile of the all-visible workload with distinct synthetic raster covers, followed by an installed WKWebView measurement. Those steps have **not** been run and are not claimed as results.

## Measurement limits

- Five paired repetitions alternate baseline/candidate order within each runner. Each frontend repetition has 90 frame-paced events; each native repetition has ten measured saves and history-list reads per size. Warmup runs precede measurements.
- Frontend tests use a production Svelte build in macOS Playwright WebKit with a synthetic Tauri bridge. Native filesystem persistence is measured separately using release Rust binaries and actual `library::save`, history, backup and atomic-write code.
- “Work per event” includes event handling, microtask flushing and forced layout completion, excluding the frame wait. It is not input-to-photon latency. Frame p95 is the median of five per-run p95 frame intervals. The WebKit clock has millisecond quantization; tiny differences need caution.
- Native fixtures use 96/480 fictional albums and 20/100 starting history entries, growing by ten measured saves. All data is temporary; no real library is opened.
- SVG artwork is intentionally synthetic and shared. These tests do not establish installed WKWebView/WindowServer FPS, idle CPU, power use, realistic image decode/memory cost, multi-monitor performance, focus or Space placement. No native window behavior was changed.
- Run 1's Playwright output cleanup removed its frontend raw artifact. Its per-run summaries were recovered from CI stdout; native raw data survived. Runs 2 and 3 place artifacts outside Playwright's cleanup directory. No run-1 raw samples were fabricated.
- No application optimization has been adopted. Only experiment infrastructure and reports are committed.

Suggested `AGENTS.md` addition: “All albums fit on screen in normal usage. Performance benchmarks must assert that every album fits; do not recommend offscreen culling as an optimization.”
