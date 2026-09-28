# Working on Plinth

- Always commit and push after making a change.
- Always make changes in a separate Git worktree. When finished and verified, merge them into main and push main. Then remove your worktree.
- Whenever changing the UI, update the README screenshot with a freshly rendered WebP. Use synthetic demo artwork and metadata only.
- Prefer pnpm over npm.
- Do not run native GUI probes, switch Spaces, or open/activate apps unless explicitly requested. Compile native examples and use headless checks by default.
- Keep albums, imported images, local library databases, personal paths, credentials, and build artifacts out of Git. Runtime data belongs in the OS app-data directory.
- Preserve third-party license notices. Use SVGs for button icons.

## Implementation notes

- Defer startup restoration/show until Tao’s queued window-creation positioning finishes, then restore size and center synchronously on the macOS main thread. Tao also queues `set_size`, so following it immediately with `center()` can center the old dimensions. Verify startup and visible placement with the isolated `window-placement` example, including the macOS dev app runner.

- macOS development uses `scripts/macos-tauri-cargo.sh` and `run-macos-dev-app.sh` to run from a generated `PlinthDev.app` with its icon. Keep the Cargo executable as a physical hard link, not a symlink.

- The desktop is a transparent Tauri window at the macOS desktop-icon level plus one. Native pointer tracking checks the topmost window; avoid changing focus to implement hover. Desktop windows must be nonfocusable and nonactivating (these are separate AppKit behaviors), and appear via `orderFrontRegardless` on macOS; Tauri `show()` makes a window key. Verify enable/disable focus with the isolated `desktop-focus` example.
- Production has no HTTP server. Native imports and metadata live under the `com.plinth.desktop` OS data directory. Never point test imports at the real library.
- Browser demo mode (`?demo=1`) uses generated SVG artwork and fictional records. Keep README captures in this mode.
- Load sharp with `createRequire` in Playwright tests; Node 24.2 has an ESM/semver loader issue with direct imports under Playwright.

## UI preferences

- Use concise labels instead of promotional taglines, especially in Settings.
- App appearance uses clickable System, Light, and Dark circles.
- Clicking a modal backdrop closes the modal; interacting inside it does not, except the artwork gallery, which closes on any click including the image.
- A missing album in Apple Music shows a native macOS alert, without a duplicate in-app notification.
- An album’s optional `playlist` name takes precedence over its link and album search; open it by name with osascript (argv only, never interpolated) so private playlists work. A missing playlist shows the same native alert.
- Artwork import accepts image files only. Do not add folder-import controls or directory traversal.
- Reuse the desktop renderer in the scaled screen preview. Keep jQuery swing hover timing consistent in both places: 250 ms / 251 ms divided by the stored `hoverSpeed` multiplier. Display Hover speed as milliseconds (`250 / hoverSpeed`, rounded), preserving the saved multiplier for compatibility. Animate rounded corners with scale.
- Album editor uses original artwork with Finder reveal and upload controls; the collection and desktop use compressed copies.
- Keep the whole top strip draggable and free of status copy.
- Show a Dock icon while the main window is visible; hide it when the window closes. Command-W keeps the desktop running. Command-Q opens a Cancel / Hide window / Quit Plinth modal, with Hide window in the middle. Focus the heading initially, not an action; use no default button or purple focus outline.
- Left-click the menu bar icon opens the window; right-click opens its menu. Keep “Hide desktop” / “Show desktop” in the menu. In the app header, place an Enable / Disable button immediately before Add artwork, synchronized to the same saved desktop state.
- Original artwork in the modal is large, with two subtle hover actions across its bottom edge. Disable dragging internal images; accept external image drops.
- Selected top tabs use a soft iridescent lavender/pink/teal fill, a uniform thin accent border, with normal text in both themes. Unselected top tabs have visible outlines and transparent backgrounds, including on hover. Top tabs show compact bordered Alt shortcut badges using the shared Shortcut component: C for Collection, A for Appearance, S for Settings. Use physical key codes for macOS Option compatibility and leave text fields and open dialogs alone. Option-Q / Option-W navigate pages with wraparound. Remember the main window size; keep the collection full-width with modest gutters.

- Collection cards open the album editor on any click (artwork, captions, caption spacing) with no hover overlay or actions over the artwork; the original gallery opens from the editor. Keep the gallery cursor normal and return to the prior view on any click (including the image) or Escape.
- Command-A adds artwork from Collection except inside text fields. Add artwork shows a Cmd + A hint on Collection, with an SVG plus between the keys and no leading icon. Build every keyboard hint with the shared `Shortcut` component, which renders each key with an SVG plus between them. Enter saves anywhere in the album editor; preserve gallery and quit-dialog keyboard behavior. Label the button Save with an Enter hint.

- History opens from Settings → History, with a Back to Settings button. Keep Settings selected while viewing History; page cycling follows the three top tabs. Record every saved library mutation through `library::save`; active data and history must remain in one atomic `library.json` write. Preserve abandoned states and retained artwork, and apply native desktop/branding/menu effects when restoring. Command-Z / Shift-Command-Z navigate saved states outside text fields and modals.
- Row spacing defaults to Auto (`rowGap: null`), balancing clearance below the menu bar with clearance below the last row. Share the geometry between desktop and preview; preserve saved numeric overrides. Do not reintroduce artwork opacity or surrounding-cover dimming.
- Spaces uses a row of All Spaces, This Space, 1, 2, 3 buttons. Numbered desktops follow Mission Control order (excluding full-screen apps), and unavailable options are disabled. Preserve `allSpaces` migration, `targetSpace` history, nonactivating placement, and existing desktop windows on placement failure. Verify native changes with the isolated `space-placement` example.

- Desktop hover behavior is mirrored on the website hero in `../plinth-website/public/hover.js`: nearest-cover hit areas with no dead zone, enlargement laid out at the animation's largest size and scaled down only (never upscaled, never animating layout size), slow breathing, drift away from the pointer, and neighbor push that follows the current size. Keep app and site in sync whenever any of these change.
- Size desktop cells with the same explicit pixel width and height from shared geometry; do not rely on flexbox aspect-ratio sizing. Background hover defaults on; when disabled, only Plinth or Finder foreground permits desktop enlargement. Include foreground changes in pointer tracking even without pointer movement.
