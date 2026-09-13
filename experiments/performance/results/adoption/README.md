# Adopted performance improvements

Validated candidate `fb7a2a6` against current baseline `cb831bc` on standard `macos-15`, Node 22, release native binaries and production WebKit builds. [CI run](https://github.com/jonahclarsen/plinth/actions/runs/34734638508). All album cells were mounted and on screen. No culling or radius-animation change is adopted.

The application caches unscaled cell hit-test rectangles and invalidates them on layout, album order, viewport, preview scale, resize-observer and scrolling changes. Compact JSON retains the same schema, backup, atomic rename and history behavior.

Five paired repetitions alternate order. Millisecond values are medians of per-run means. Frame p95 is the median of per-run p95 values. Native samples contain ten saves/list reads each. These measurements isolate frontend event work from native persistence; they do not establish installed-app FPS or resolve the earlier live-slider lag.

| Test | Albums | Starting history states | Baseline ms | Adopted ms | Reduction |
|---|---:|---:|---:|---:|---:|
| Desktop hit testing | 96 | — | 1.156 | 0.444 | 61.5% |
| Desktop frame p95 (control) | 96 | — | 21.0 | 21.0 | No demonstrated gain |
| Desktop hit testing | 480 | — | 1.367 | 0.711 | 48.0% |
| Desktop frame p95 (control) | 480 | — | 20.0 | 21.0 | No demonstrated gain |
| Native save | 96 | 20 | 3.542 | 2.793 | 21.1% |
| History list | 96 | 20 | 1.708 | 1.349 | 21.1% |
| Native save | 96 | 100 | 12.832 | 7.917 | 38.3% |
| History list | 96 | 100 | 6.873 | 4.650 | 32.3% |
| Native save | 480 | 20 | 18.016 | 12.051 | 33.1% |
| History list | 480 | 20 | 8.752 | 6.612 | 24.5% |
| Native save | 480 | 100 | 61.473 | 40.147 | 34.7% |
| History list | 480 | 100 | 32.752 | 26.629 | 18.7% |

Warm pointer sweeps reduced geometry reads from 5,370 / 24,378 to zero per 90 events. Initial cache construction is recorded separately in the raw data.

| Behavior test | Result |
|---|---|
| holding Hover size previews one album, follows dragging, and ends on release outside | Passed |
| right-click does not preview; cancellation and blur clear the sample | Passed |
| hover-size sample works with hover disabled and an empty library is harmless | Passed |
| hover speed is saved in history and corners animate with scale | Passed |
| background hover option sits beneath enlarge and restores through history | Passed |
| rounded corners on hover default off and restore independently for each display | Passed |
| native pointer events stay on their display (4K, background=false) | Passed |
| native pointer events stay on their display (4K, background=true) | Passed |
| native pointer events stay on their display (Mac, background=false) | Passed |
| native pointer events stay on their display (Mac, background=true) | Passed |
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
| README screenshots use only synthetic demo artwork | Passed |
| branding::tests::every_logo_survives_library_reload_and_has_valid_native_assets | Passed in baseline and compact variants |
| branding::tests::legacy_settings_default_to_first_logo_and_unknown_logos_are_rejected | Passed in baseline and compact variants |
| branding::tests::record_logo_has_transparent_background_and_grooves_with_black_centers | Passed in baseline and compact variants |
| displays::tests::remembers_internal_panel_without_marking_it_as_current | Passed in baseline and compact variants |
| history::tests::corrupt_history_is_not_overwritten_and_failed_import_does_not_change_memory | Passed in baseline and compact variants |
| history::tests::failed_navigation_and_writes_leave_the_saved_state_intact | Passed in baseline and compact variants |
| history::tests::migrates_existing_library_and_retains_redo_across_restarts | Passed in baseline and compact variants |
| history::tests::missing_artwork_does_not_partially_restore_history | Passed in baseline and compact variants |
| history::tests::new_edits_preserve_abandoned_states_and_their_parentage | Passed in baseline and compact variants |
| history::tests::restores_imports_metadata_replacements_removals_and_settings | Passed in baseline and compact variants |
| history::tests::restoring_forward_keeps_remaining_redo_states | Passed in baseline and compact variants |
| library::tests::automatic_spacing_is_default_and_old_opacity_settings_are_ignored | Passed in baseline and compact variants |
| library::tests::hover_speed_defaults_and_validates | Passed in baseline and compact variants |
| library::tests::import_preserves_original_deduplicates_and_survives_reload | Passed in baseline and compact variants |
| library::tests::imports_legacy_metadata | Passed in baseline and compact variants |
| library::tests::invalid_settings_rejected | Passed in baseline and compact variants |
| library::tests::legacy_bottom_spacing_is_ignored_on_load_and_removed_on_save | Passed in baseline and compact variants |
| library::tests::legacy_names_with_suffix_or_no_link_spacing | Passed in baseline and compact variants |
| library::tests::numbered_spaces_validate_migrate_and_round_trip_through_history | Passed in baseline and compact variants |
| library::tests::plain_filename_works | Passed in baseline and compact variants |
| library::tests::replacement_preserves_metadata_and_originals | Passed in baseline and compact variants |
| library::tests::rounded_hover_defaults_and_round_trips | Passed in baseline and compact variants |
| library::tests::spaces_setting_defaults_for_existing_libraries_and_round_trips | Passed in baseline and compact variants |
| spaces::tests::resolves_only_existing_desktops_one_through_three | Passed in baseline and compact variants |
| Type checks and production builds | Baseline and adopted versions passed |
| Native release builds | Baseline and compact versions passed |
| All-visible preflight | Passed at both album counts |
| README screenshot capture | Passed, synthetic demo only |
| Native measured operations | 400 saves, 400 history reads and 40 undo/redo pairs passed |
| Pointer correctness | 1,800 timed events passed, plus warmups |

Raw results: [frontend](web.json), [native](native.json), [frontend tests](regression.json), [native tests](native-checks.json).
