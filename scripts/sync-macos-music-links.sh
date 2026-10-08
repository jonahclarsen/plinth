#!/bin/sh
set -eu
source_info=${1:?Source Info.plist required}
installed_info=${2:?Installed Info.plist required}
url_types=$(/usr/bin/plutil -extract CFBundleURLTypes json -o - "$source_info")
/usr/bin/plutil -replace CFBundleURLTypes -json "$url_types" "$installed_info"
# plutil cannot export scalar plist values as JSON on macOS; use raw/string.
usage_description=$(/usr/bin/plutil -extract NSAppleEventsUsageDescription raw -o - "$source_info")
/usr/bin/plutil -replace NSAppleEventsUsageDescription -string "$usage_description" "$installed_info"

# Start as an agent before AppKit is initialized, preventing a Dock flash.
background_agent=$(/usr/bin/plutil -extract LSUIElement raw -o - "$source_info")
/usr/bin/plutil -replace LSUIElement -bool "$background_agent" "$installed_info"
