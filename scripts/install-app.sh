#!/bin/zsh
set -eu

script_dir="${0:A:h}"
repo_dir="${script_dir:h}"
target_dir="${CARGO_TARGET_DIR:-$repo_dir/src-tauri/target}"
source_app="${1:-$target_dir/release/bundle/macos/Plinth.app}"
app_dir="$HOME/Applications"
app_path="$app_dir/Plinth.app"

if [[ ! -d "$source_app/Contents/MacOS" ]]; then
  echo "Build the standalone app first with pnpm build:app" >&2
  exit 1
fi

source "$script_dir/dev-signing.sh"
resolve_dev_signing_identity
mkdir -p "$app_dir"
staging_directory="$(mktemp -d "$app_dir/.plinth-install.XXXXXX")"
staged_app="$staging_directory/Plinth.app"
previous_app="$staging_directory/previous.app"
trap '/bin/rm -rf "$staging_directory"' EXIT

# Prepare the entire release bundle, including its embedded interface, before
# replacing the installed app. No development watcher or app is launched.
/usr/bin/ditto "$source_app" "$staged_app"
sign_dev_app "$staged_app"

# A previous live-development job would otherwise overwrite this release on
# its next rebuild. Disable that job without removing the normal app.
label="com.plinth.desktop-dev"
launchctl disable "gui/$(id -u)/$label"
launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
stamp="$(date +%Y%m%d-%H%M%S)"
for obsolete in "$HOME/Library/LaunchAgents/$label.plist" \
  "$HOME/Library/Application Support/Plinth/dev-supervisor"; do
  if [[ -f "$obsolete" ]]; then
    mkdir -p "$HOME/.Trash"
    /bin/mv "$obsolete" "$HOME/.Trash/${obsolete:t}-disabled-$stamp"
  fi
done

if [[ -d "$app_path" ]]; then
  /bin/mv "$app_path" "$previous_app"
fi
if ! /bin/mv "$staged_app" "$app_path"; then
  if [[ -d "$previous_app" ]] && ! /bin/mv "$previous_app" "$app_path"; then
    trap - EXIT
    echo "The previous signed app remains at $previous_app" >&2
  fi
  exit 1
fi
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app_path"
echo "Installed standalone Plinth; no development supervisor or server started."
