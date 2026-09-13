# macOS CI performance results

**Historical configuration — not the target workload.** The 480-album frontend case used 12 columns and overflowed the screen. The user subsequently clarified that all albums always fit on screen. Do not use those timings or any offscreen-culling gains to recommend app optimizations. Native persistence results remain applicable. Run 3 supersedes the frontend configuration.

All timings below are milliseconds. Frontend work uses the median of five per-run means when raw samples are available (run 2), or five per-run medians for recovered stdout summaries (run 1); native timings are the median of five per-run means of ten operations. Paired wins count repetitions where the candidate used less time. These are experimental comparisons, not shipped optimizations.

## Frontend

| Test | Albums | Baseline work | Candidate work | Reduction | Paired wins | Frame p95 baseline → candidate | Style writes baseline → candidate | Geometry reads baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rounded corners (radius-css) | 96 | 6.167 | 6.767 | -9.7% | 1/5 | 57.000 → 57.000 | 9402 → 90 | 90 → 90 |
| Space between covers (cull) | 96 | 11.811 | 12.911 | -9.3% | 2/5 | 70.000 → 75.000 | 90 → 90 | 90 → 90 |
| Hover size (cull) | 96 | 5.378 | 5.778 | -7.4% | 1/5 | 61.000 → 72.000 | 167 → 166 | 90 → 90 |
| pointer (pointer) | 96 | 0.944 | 0.389 | 58.8% | 5/5 | 20.000 → 19.000 | 2146 → 2222 | 5370 → 0 |
| pointer (cull) | 96 | 1.278 | 1.267 | 0.9% | 3/5 | 19.000 → 19.000 | 2144 → 2160 | 5370 → 5370 |
| Rounded corners (radius-css) | 480 | 25.300 | 20.389 | 19.4% | 4/5 | 104.000 → 82.000 | 45265 → 90 | 90 → 90 |
| Space between covers (cull) | 480 | 76.600 | 16.933 | 77.9% | 5/5 | 128.000 → 77.000 | 90 → 306 | 90 → 90 |
| Hover size (cull) | 480 | 12.700 | 5.744 | 54.8% | 5/5 | 77.000 → 60.000 | 167 → 167 | 90 → 90 |
| pointer (pointer) | 480 | 1.767 | 0.956 | 45.9% | 5/5 | 69.000 → 67.000 | 888 → 902 | 14202 → 0 |
| pointer (cull) | 480 | 1.567 | 1.011 | 35.5% | 5/5 | 63.000 → 18.000 | 934 → 2248 | 14202 → 6198 |

## Native persistence

| Candidate / test | Albums | Initial retained states | Baseline | Candidate | Reduction | Paired wins | Final JSON bytes baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|
| compact / save | 96 | 20 | 3.930 | 2.770 | 29.5% | 5/5 | 911848 → 444525 |
| compact / history list | 96 | 20 | 1.703 | 1.398 | 18.0% | 5/5 | 911848 → 444525 |
| compact / save | 96 | 100 | 12.842 | 8.503 | 33.8% | 5/5 | 3284828 → 1590865 |
| compact / history list | 96 | 100 | 6.355 | 5.574 | 12.3% | 5/5 | 3284828 → 1590865 |
| compact / save | 480 | 20 | 17.073 | 12.544 | 26.5% | 5/5 | 4481654 → 2211835 |
| compact / history list | 480 | 20 | 8.337 | 6.990 | 16.2% | 5/5 | 4481654 → 2211835 |
| compact / save | 480 | 100 | 60.629 | 42.682 | 29.6% | 5/5 | 16146314 → 7918975 |
| compact / history list | 480 | 100 | 34.117 | 27.385 | 19.7% | 5/5 | 16146314 → 7918975 |
| indexed / save | 96 | 20 | 3.930 | 3.696 | 5.9% | 4/5 | 911848 → 911848 |
| indexed / history list | 96 | 20 | 1.703 | 1.708 | -0.3% | 3/5 | 911848 → 911848 |
| indexed / save | 96 | 100 | 12.842 | 13.221 | -2.9% | 3/5 | 3284828 → 3284828 |
| indexed / history list | 96 | 100 | 6.355 | 7.272 | -14.4% | 1/5 | 3284828 → 3284828 |
| indexed / save | 480 | 20 | 17.073 | 17.307 | -1.4% | 2/5 | 4481654 → 4481654 |
| indexed / history list | 480 | 20 | 8.337 | 9.024 | -8.2% | 1/5 | 4481654 → 4481654 |
| indexed / save | 480 | 100 | 60.629 | 60.714 | -0.1% | 3/5 | 16146314 → 16146314 |
| indexed / history list | 480 | 100 | 34.117 | 34.731 | -1.8% | 2/5 | 16146314 → 16146314 |

## Frontend behavior checks

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
| cached hover geometry follows resize, columns, and scrolling | Passed |

## Native behavior and build checks

| Test | Result |
|---|---|
| branding::tests::every_logo_survives_library_reload_and_has_valid_native_assets | Passed in baseline, compact, indexed |
| branding::tests::legacy_settings_default_to_first_logo_and_unknown_logos_are_rejected | Passed in baseline, compact, indexed |
| branding::tests::record_logo_has_transparent_background_and_grooves_with_black_centers | Passed in baseline, compact, indexed |
| displays::tests::remembers_internal_panel_without_marking_it_as_current | Passed in baseline, compact, indexed |
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
| Svelte type checks | Baseline, radius-css, pointer, cull and combined passed |
| Production Vite builds | Baseline, radius-css, pointer, cull and combined passed |
| Native release test builds | Baseline, compact and indexed passed |
| Native benchmark assertions | All 600 measured saves and 600 history reads; 60 undo/redo pairs passed |
| Pointer benchmark correctness | 3,600 timed events across baseline/candidate comparisons passed; warmups also checked |
| Frontend artifact retention | Passed; full event timings and regression JSON retained |

[CI run 2](https://github.com/jonahclarsen/plinth/actions/runs/34722872703), commit `6896fe3`. Standard macOS runner: Apple M1 virtual machine, 3 cores, 7 GB, macOS 15.7.9.
