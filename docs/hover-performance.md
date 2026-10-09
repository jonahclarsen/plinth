# Hover image quality and performance

WebKit's default image interpolation controller can temporarily change filtering for
other scaled bitmaps when one image is resized, then repaint after a 500 ms timer.
Desktop artwork uses `image-rendering: optimizeQuality` to keep normal high-quality
filtering consistent. The hover box reserves the breathing maximum at entry, so the
swing-to-breathing handoff no longer resizes its raster. Existing compositor layers,
transform animation, easing, and pointer tracking remain in place.

Source: [WebKit ImageQualityController](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/rendering/ImageQualityController.cpp).

## CI measurements

[Corrected benchmark run](https://github.com/jonahclarsen/plinth/actions/runs/37895741078)
compares revision `a051dd1` against the fix on a macOS 15 ARM runner using headless
WebKit and synthetic 1200 px bitmap covers. Each case has one warmup and five paired
five-second samples, alternating old/new order. Each sample gets a fresh browser;
CPU accounting follows process IDs and rejects disappearing processes. All 60
measured samples were valid. Values below are medians.

| Covers | Activity | Old CPU (% of one core) | New CPU | CPU change | Old/new frame p95 |
| --- | --- | ---: | ---: | ---: | --- |
| 18 | Idle | 4.0% | 3.8% | −5% | 20 / 19 ms |
| 18 | Hold hover | 7.8% | 7.2% | −7.7% | 19 / 18 ms |
| 18 | Move between covers | 24.7% | 18.3% | −25.8% | 19 / 18 ms |
| 150 | Idle | 5.2% | 5.1% | Unchanged | 18 / 18 ms |
| 150 | Hold hover | 9.9% | 9.4% | −6% | 18 / 18 ms |
| 150 | Move between covers | 26.1% | 26.1% | Unchanged | 19 / 19 ms |

CPU includes WebKit browser/helper processes, excluding Node, Tauri, and native
pointer tracking. Idle includes the benchmark's frame observer, so these are not
measurements of the installed app's idle CPU. Small differences may be measurement
noise; headless CI does not establish the same percentages on a user's Mac. The
results show no slowdown in these cases, with a larger improvement during repeated
small-library hover transitions.

The bitmap regression test compares a stationary distant cover before hover,
during entry, after the delayed repaint window, during breathing, and after exit.
It reproduces changed pixels on the old implementation and unchanged pixels with
the fix. It also verifies that breathing retains its GPU layer and backing size.
