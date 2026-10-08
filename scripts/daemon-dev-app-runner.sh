#!/bin/zsh
set -eu

script_dir="${0:A:h}"
app_path="$HOME/Applications/Plinth.app"
executable="$app_path/Contents/MacOS/plinth"

if [[ "${1:-}" != "__launch" ]]; then
  rustc_bin="${PLINTH_RUSTC:?PLINTH_RUSTC is not set}"
  cargo_bin="${PLINTH_CARGO:?PLINTH_CARGO is not set}"
  host="$($rustc_bin -vV | sed -n 's/^host: //p')"
  runner_config="target.'$host'.runner = ['$script_dir/daemon-dev-app-runner.sh', '__launch']"
  exec "$cargo_bin" --config "$runner_config" "$@"
fi

shift
built_executable="${1:?Cargo did not provide the built executable path}"
shift

if [[ ! -d "$app_path/Contents/MacOS" ]]; then
  echo "Plinth.app is not installed; run pnpm dev:daemon" >&2
  exit 1
fi

source "$script_dir/dev-signing.sh"
resolve_dev_signing_identity

source "$script_dir/dev-app-update.sh"
update_dev_app "$built_executable" "$app_path"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app_path"

exec "$executable" "$@"
