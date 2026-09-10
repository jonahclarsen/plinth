#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: run-macos-dev-app.sh <executable> [arguments...]" >&2
  exit 64
fi
source_executable=$1
shift
if [ ! -f "$source_executable" ] || [ ! -x "$source_executable" ]; then
  echo "macOS dev app runner: executable not found: $source_executable" >&2
  exit 66
fi
script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
build_directory=$(CDPATH= cd -- "$(dirname -- "$source_executable")" && pwd)
app_bundle="$build_directory/PlinthDev.app"
app_executable="$app_bundle/Contents/MacOS/plinth"
mkdir -p "$app_bundle/Contents/MacOS" "$app_bundle/Contents/Resources"
cp "$script_directory/../src-tauri/DevInfo.plist" "$app_bundle/Contents/Info.plist"
cp "$script_directory/../src-tauri/icons/icon.icns" "$app_bundle/Contents/Resources/icon.icns"
printf 'APPL????' > "$app_bundle/Contents/PkgInfo"
# A symlink resolves back to Cargo's unbundled executable. Use a physical hard
# link, as Balance's development app shell does; preserve the binary signature.
rm -f "$app_executable"
ln "$source_executable" "$app_executable"
# Keep Cargo's process supervision, arguments, output and Ctrl-C behavior.
exec "$app_executable" "$@"
