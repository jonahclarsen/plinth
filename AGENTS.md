# Working on Plinth

- Always commit and push after making a change.
- Always make changes in a separate Git worktree on a task branch. When finished and verified, merge them into main and push main. Coordinate merges and do not overwrite other agents’ work.
- Whenever changing the UI, update the README screenshot with a freshly rendered WebP. Use synthetic demo artwork and metadata only.
- Prefer pnpm over npm. The permanent development port is recorded in port.json; never choose a new port casually.
- Keep albums, imported images, local library databases, personal paths, credentials, and build artifacts out of Git. Runtime data belongs in the OS app-data directory.
- Native desktop behavior is macOS-specific. Test the installed app as well as the browser UI when changing window behavior.
- Preserve third-party license notices. Use SVGs for button icons.
