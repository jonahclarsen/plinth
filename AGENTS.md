# Working on Plinth

- Always commit and push after making a change.
- Always make changes in a separate Git worktree on a task branch. When finished and verified, merge them into main and push main. Coordinate merges and do not overwrite other agents’ work.
- Whenever changing the UI, update the README screenshot with a freshly rendered WebP. Use synthetic demo artwork and metadata only.
- Prefer pnpm over npm. The permanent development port is recorded in port.json; never choose a new port casually.
- Keep albums, imported images, local library databases, personal paths, credentials, and build artifacts out of Git. Runtime data belongs in the OS app-data directory.
- Native desktop behavior is macOS-specific. Test the installed app as well as the browser UI when changing window behavior.
- Preserve third-party license notices. Use SVGs for button icons.

## Implementation notes

- The desktop is a transparent Tauri window at the macOS desktop-icon level plus one. Native pointer tracking checks the topmost window; avoid changing focus to implement hover.
- Production has no HTTP server. Native imports and metadata live under the `com.plinth.desktop` OS data directory. Never point test imports at the real library.
- Browser demo mode (`?demo=1`) uses generated SVG artwork and fictional records. Keep README captures in this mode.
- Load sharp with `createRequire` in Playwright tests; Node 24.2 has an ESM/semver loader issue with direct imports under Playwright.

## UI preferences

- Use concise labels instead of promotional taglines, especially in Settings.
- App appearance uses clickable System, Light, and Dark circles.
- Clicking a modal backdrop closes the modal; interacting inside it does not.
- A missing album in Apple Music shows a native macOS alert, without a duplicate in-app notification.
- Artwork import accepts image files only. Do not add folder-import controls or directory traversal.
- Reuse the desktop renderer in the scaled screen preview. Keep the 250 ms / 251 ms jQuery swing hover timing consistent in both places.
- Album editor uses original artwork with download and replacement controls; the collection and desktop use compressed copies.
- Keep the whole top strip draggable and free of status copy.
- Show a Dock icon while the main window is visible; hide it when the window closes. Command-W keeps the desktop running. Command-Q opens a Hide window / Quit Plinth / Cancel modal.
