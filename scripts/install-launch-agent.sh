#!/bin/zsh
set -eu

label="com.plinth.desktop-dev"
script_dir="${0:A:h}"
repo_dir="${script_dir:h}"
pnpm_bin="$(command -v pnpm)"
node_bin="$(command -v node)"
cargo_bin="$(command -v cargo)"
rustc_bin="$(command -v rustc)"
app_source="$repo_dir/src-tauri/target/debug/bundle/macos/Plinth.app"
app_dir="$HOME/Applications"
app_path="$app_dir/Plinth.app"
supervisor_dir="$HOME/Library/Application Support/Plinth"
executable="$supervisor_dir/dev-supervisor"
agent_dir="$HOME/Library/LaunchAgents"
log_dir="$HOME/Library/Logs/Plinth"
agent_path="$agent_dir/$label.plist"
template="$script_dir/$label.plist.template"
temporary="$(mktemp)"
trap '/bin/rm -f "$temporary"' EXIT

source "$script_dir/dev-signing.sh"
resolve_dev_signing_identity

echo "Building the branded debug app bundle…"
cd "$repo_dir"
pnpm tauri build --debug --bundles app

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
mkdir -p "$app_dir" "$agent_dir" "$log_dir"
/usr/bin/ditto "$app_source" "$app_path"
sign_dev_app "$app_path"
# launchd must never run the app bundle as its watcher: Launch Services can
# otherwise send URL events to that process instead of the actual Tauri app.
mkdir -p "$supervisor_dir"
"$script_dir/install-dev-supervisor.sh" "$app_path/Contents/MacOS/plinth" "$executable" "$signing_identity"

sed \
  -e "s|__SUPERVISOR_EXECUTABLE__|$executable|g" \
  -e "s|__REPO__|$repo_dir|g" \
  -e "s|__PNPM__|$pnpm_bin|g" \
  -e "s|__CARGO__|$cargo_bin|g" \
  -e "s|__RUSTC__|$rustc_bin|g" \
  -e "s|__PATH__|${cargo_bin:h}:${node_bin:h}:${pnpm_bin:h}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin|g" \
  -e "s|__LOG_DIR__|$log_dir|g" \
  "$template" > "$temporary"
plutil -lint "$temporary"

cp "$temporary" "$agent_path"
chmod 600 "$agent_path"
launchctl bootstrap "gui/$(id -u)" "$agent_path"
launchctl enable "gui/$(id -u)/$label"
launchctl kickstart -k "gui/$(id -u)/$label"

echo "Installed and started Plinth in live development mode"
