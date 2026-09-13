# macOS CI performance results

**Historical configuration — not the target workload.** The 480-album frontend case used 12 columns and overflowed the screen. The user subsequently clarified that all albums always fit on screen. Do not use those timings or any offscreen-culling gains to recommend app optimizations. Native persistence results remain applicable. Run 3 supersedes the frontend configuration.

Run 1 frontend rows use medians of per-run medians recovered from CI stdout; raw per-event samples were deleted by Playwright output cleanup. The native JSON artifact is complete. Hover size in this run is an unheld control.

All timings below are milliseconds. Frontend work uses five per-run medians in this recovered run; native timings are the median of five per-run means of ten operations. Paired wins count repetitions where the candidate used less time. These are experimental comparisons, not shipped optimizations.

## Frontend

| Test | Albums | Baseline work | Candidate work | Reduction | Paired wins | Frame p95 baseline → candidate | Style writes baseline → candidate | Geometry reads baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rounded corners (radius) | 96 | 8.000 | 8.000 | 0.0% | 1/5 | 124.000 → 117.000 | 9114 → 8730 | 90 → 90 |
| Space between covers (radius) | 96 | 11.000 | 10.000 | 9.1% | 3/5 | 66.000 → 67.000 | 90 → 90 | 90 → 90 |
| Hover size (radius) | 96 | 4.000 | 4.000 | 0.0% | 1/5 | 18.000 → 18.000 | 63 → 63 | 90 → 90 |
| pointer (pointer) | 96 | 1.000 | 0.000 | 100.0% | 5/5 | 20.000 → 19.000 | 2216 → 2238 | 5370 → 0 |
| Rounded corners (radius) | 480 | 19.000 | 18.000 | 5.3% | 3/5 | 80.000 → 79.000 | 45690 → 43290 | 90 → 90 |
| Space between covers (radius) | 480 | 81.000 | 83.000 | -2.5% | 1/5 | 146.000 → 141.000 | 90 → 90 | 90 → 90 |
| Hover size (radius) | 480 | 14.000 | 15.000 | -7.1% | 1/5 | 26.000 → 24.000 | 63 → 63 | 90 → 90 |
| pointer (pointer) | 480 | 1.000 | 1.000 | 0.0% | 2/5 | 65.000 → 65.000 | 910 → 888 | 14202 → 0 |

## Native persistence

| Candidate / test | Albums | Initial retained states | Baseline | Candidate | Reduction | Paired wins | Final JSON bytes baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|
| compact / save | 96 | 20 | 3.164 | 2.488 | 21.4% | 5/5 | 911848 → 444525 |
| compact / history list | 96 | 20 | 1.502 | 1.255 | 16.4% | 4/5 | 911848 → 444525 |
| compact / save | 96 | 100 | 11.408 | 7.620 | 33.2% | 5/5 | 3284828 → 1590865 |
| compact / history list | 96 | 100 | 5.905 | 5.093 | 13.7% | 4/5 | 3284828 → 1590865 |
| compact / save | 480 | 20 | 15.883 | 11.407 | 28.2% | 5/5 | 4481654 → 2211835 |
| compact / history list | 480 | 20 | 8.329 | 6.906 | 17.1% | 5/5 | 4481654 → 2211835 |
| compact / save | 480 | 100 | 60.169 | 43.861 | 27.1% | 5/5 | 16146314 → 7918975 |
| compact / history list | 480 | 100 | 29.500 | 23.841 | 19.2% | 5/5 | 16146314 → 7918975 |
| indexed / save | 96 | 20 | 3.164 | 3.305 | -4.4% | 1/5 | 911848 → 911848 |
| indexed / history list | 96 | 20 | 1.502 | 1.700 | -13.2% | 0/5 | 911848 → 911848 |
| indexed / save | 96 | 100 | 11.408 | 12.651 | -10.9% | 2/5 | 3284828 → 3284828 |
| indexed / history list | 96 | 100 | 5.905 | 6.631 | -12.3% | 2/5 | 3284828 → 3284828 |
| indexed / save | 480 | 20 | 15.883 | 16.357 | -3.0% | 3/5 | 4481654 → 4481654 |
| indexed / history list | 480 | 20 | 8.329 | 8.549 | -2.6% | 3/5 | 4481654 → 4481654 |
| indexed / save | 480 | 100 | 60.169 | 57.481 | 4.5% | 4/5 | 16146314 → 16146314 |
| indexed / history list | 480 | 100 | 29.500 | 30.949 | -4.9% | 4/5 | 16146314 → 16146314 |

[CI run 1](https://github.com/jonahclarsen/plinth/actions/runs/34721963321), commit `b6ef4d5`. Standard `macos-15-arm64`, macOS 15.7.9, image 20260907.0337.1.

## Behavior and build checks

| Test | Result |
|---|---|
| holding Hover size previews one album, follows dragging, and ends on release outside | Passed |
| right-click does not preview; cancellation and blur clear the sample | Passed |
| hover-size sample works with hover disabled and an empty library is harmless | Passed |
| hover speed is saved in history and corners animate with scale | Passed |
| native pointer events stay on their display (4K) | Passed |
| native pointer events stay on their display (Mac) | Passed |
| automatic row spacing balances the menu-bar and screen-bottom gaps | Passed |
| preview shares balanced spacing and manual spacing can be undone or reset | Passed |
| opacity and surrounding-cover dimming controls and effects are absent | Passed |
| covers stay square across cover spacing and column settings | Passed |
| History sits between Appearance and Settings and saves full metadata states | Passed |
| undo flushes pending appearance changes and restores the preview and desktop toggle | Passed |
| new changes after undo retain abandoned states and Restore returns to either branch | Passed |
| undo restores removed albums and both artwork variants | Passed |
| imports are one state per batch and duplicates and no-op saves do not add history | Passed |
| text undo and modal shortcuts do not navigate saved history | Passed |
| all history entries remain reachable in a narrow window | Passed |
| branding::tests::every_logo_survives_library_reload_and_has_valid_native_assets | Passed in baseline, compact, indexed |
| branding::tests::legacy_settings_default_to_first_logo_and_unknown_logos_are_rejected | Passed in baseline, compact, indexed |
| branding::tests::record_logo_has_transparent_background_and_grooves_with_black_centers | Passed in baseline, compact, indexed |
| displays::tests::remembers_internal_panel_without_marking_it_as_current | Passed in baseline, compact, indexed |
| history::native_performance::measure | Passed in baseline, compact, indexed |
| history::tests::corrupt_history_is_not_overwritten_and_failed_import_does_not_change_memory | Passed in baseline, compact, indexed |
| history::tests::failed_navigation_and_writes_leave_the_saved_state_intact | Passed in baseline, compact, indexed |
| history::tests::migrates_existing_library_and_retains_redo_across_restarts | Passed in baseline, compact, indexed |
| history::tests::missing_artwork_does_not_partially_restore_history | Passed in baseline, compact, indexed |
| history::tests::new_edits_preserve_abandoned_states_and_their_parentage | Passed in baseline, compact, indexed |
| history::tests::restores_imports_metadata_replacements_removals_and_settings | Passed in baseline, compact, indexed |
| history::tests::restoring_forward_keeps_remaining_redo_states | Passed in baseline, compact, indexed |
| library::tests::automatic_spacing_is_default_and_old_opacity_settings_are_ignored | Passed in baseline, compact, indexed |
| library::tests::hover_speed_defaults_and_validates | Passed in baseline, compact, indexed |
| library::tests::import_preserves_original_deduplicates_and_survives_reload | Passed in baseline, compact, indexed |
| library::tests::imports_legacy_metadata | Passed in baseline, compact, indexed |
| library::tests::invalid_settings_rejected | Passed in baseline, compact, indexed |
| library::tests::legacy_bottom_spacing_is_ignored_on_load_and_removed_on_save | Passed in baseline, compact, indexed |
| library::tests::legacy_names_with_suffix_or_no_link_spacing | Passed in baseline, compact, indexed |
| library::tests::numbered_spaces_validate_migrate_and_round_trip_through_history | Passed in baseline, compact, indexed |
| library::tests::plain_filename_works | Passed in baseline, compact, indexed |
| library::tests::replacement_preserves_metadata_and_originals | Passed in baseline, compact, indexed |
| library::tests::spaces_setting_defaults_for_existing_libraries_and_round_trips | Passed in baseline, compact, indexed |
| spaces::tests::resolves_only_existing_desktops_one_through_three | Passed in baseline, compact, indexed |
| Svelte type checks | Baseline, radius, pointer and combined passed |
| Production Vite builds | Baseline, radius, pointer and combined passed |
| Native release test builds | Baseline, compact and indexed passed |
| Native benchmark assertions | All 600 saves and 600 history reads; 60 undo/redo pairs passed |
| Frontend artifact retention | Incomplete: Playwright cleared raw timings; stdout summaries recovered. Fixed for run 2. |
