# macOS CI performance results

All timings below are milliseconds. Frontend work uses the median of five per-run means when raw samples are available (runs 2 and 3), or five per-run medians for recovered stdout summaries (run 1); native timings are the median of five per-run means of ten operations. Paired wins count repetitions where the candidate used less time. These are experimental comparisons, not shipped optimizations.

## Frontend

| Test | Albums | Baseline work | Candidate work | Reduction | Paired wins | Frame p95 baseline → candidate | Style writes baseline → candidate | Geometry reads baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rounded corners (radius-css) | 96 | 5.500 | 7.011 | -27.5% | 0/5 | 60.000 → 66.000 | 9498 → 90 | 90 → 90 |
| Space between covers (radius-css) | 96 | 10.578 | 13.289 | -25.6% | 1/5 | 72.000 → 101.000 | 90 → 90 | 90 → 90 |
| Hover size (radius-css) | 96 | 5.200 | 5.411 | -4.1% | 3/5 | 81.000 → 78.000 | 167 → 167 | 90 → 90 |
| pointer (pointer) | 96 | 1.078 | 0.367 | 66.0% | 5/5 | 20.000 → 19.000 | 2176 → 2166 | 5370 → 0 |
| Rounded corners (radius-css) | 480 | 28.589 | 28.456 | 0.5% | 4/5 | 260.000 → 257.000 | 43770 → 90 | 90 → 90 |
| Space between covers (radius-css) | 480 | 74.833 | 76.022 | -1.6% | 3/5 | 259.000 → 262.000 | 90 → 90 | 90 → 90 |
| Hover size (radius-css) | 480 | 13.378 | 13.400 | -0.2% | 2/5 | 164.000 → 163.000 | 160 → 161 | 90 → 90 |
| pointer (pointer) | 480 | 1.611 | 0.889 | 44.8% | 5/5 | 63.000 → 63.000 | 970 → 964 | 24378 → 0 |

## Native persistence

| Candidate / test | Albums | Initial retained states | Baseline | Candidate | Reduction | Paired wins | Final JSON bytes baseline → candidate |
|---|---:|---:|---:|---:|---:|---:|---:|
| compact / save | 96 | 20 | 3.392 | 2.469 | 27.2% | 5/5 | 911848 → 444525 |
| compact / history list | 96 | 20 | 1.762 | 1.303 | 26.1% | 5/5 | 911848 → 444525 |
| compact / save | 96 | 100 | 12.166 | 7.678 | 36.9% | 5/5 | 3284828 → 1590865 |
| compact / history list | 96 | 100 | 6.647 | 5.115 | 23.1% | 5/5 | 3284828 → 1590865 |
| compact / save | 480 | 20 | 15.873 | 12.667 | 20.2% | 4/5 | 4481654 → 2211835 |
| compact / history list | 480 | 20 | 8.445 | 6.851 | 18.9% | 5/5 | 4481654 → 2211835 |
| compact / save | 480 | 100 | 63.536 | 43.784 | 31.1% | 5/5 | 16146314 → 7918975 |
| compact / history list | 480 | 100 | 34.390 | 24.579 | 28.5% | 5/5 | 16146314 → 7918975 |
| indexed / save | 96 | 20 | 3.392 | 3.842 | -13.3% | 3/5 | 911848 → 911848 |
| indexed / history list | 96 | 20 | 1.762 | 1.831 | -3.9% | 1/5 | 911848 → 911848 |
| indexed / save | 96 | 100 | 12.166 | 15.797 | -29.8% | 2/5 | 3284828 → 3284828 |
| indexed / history list | 96 | 100 | 6.647 | 7.151 | -7.6% | 3/5 | 3284828 → 3284828 |
| indexed / save | 480 | 20 | 15.873 | 18.445 | -16.2% | 2/5 | 4481654 → 4481654 |
| indexed / history list | 480 | 20 | 8.445 | 9.109 | -7.9% | 3/5 | 4481654 → 4481654 |
| indexed / save | 480 | 100 | 63.536 | 58.323 | 8.2% | 3/5 | 16146314 → 16146314 |
| indexed / history list | 480 | 100 | 34.390 | 31.035 | 9.8% | 3/5 | 16146314 → 16146314 |

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
| Svelte type checks | Baseline, radius-css, pointer and combined-fit passed |
| Production Vite builds | Baseline, radius-css, pointer and combined-fit passed |
| Native release test builds | Baseline, compact and indexed passed |
| Native benchmark assertions | All 600 measured saves and 600 history reads; 60 undo/redo pairs passed |
| Pointer benchmark correctness | 1,800 timed events passed; warmups also checked |
| Every album mounted and on screen | All 96 sample setups passed, including 41 spacing values in each spacing-case setup |
| Frontend artifact retention | Full event timings and regression JSON retained |

[CI run 3](https://github.com/jonahclarsen/plinth/actions/runs/34723717199), commit `dd5ced0`. Standard macOS runner, 1440×1080 logical display, 12 columns for 96 albums and 30 columns for 480. Hover samples use deterministic selection. **This is the applicable frontend workload.**
