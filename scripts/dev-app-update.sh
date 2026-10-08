#!/bin/zsh

# The caller supplies the pinned sign_dev_app function. Prepare and verify the
# replacement before touching the registered bundle, retaining a rollback copy.
update_dev_app() {
  local built_executable=$1
  local app_path=$2
  local staging_directory
  staging_directory="$(mktemp -d "${app_path:h}/.plinth-update.XXXXXX")"
  local staged_app="$staging_directory/Plinth.app"
  local previous_app="$staging_directory/previous.app"
  local update_result
  # Handle failures explicitly: zsh's errexit can bypass a function's EXIT trap
  # when a nested signing function fails.
  if /usr/bin/ditto "$app_path" "$staged_app" &&
     /bin/cp "$built_executable" "$staged_app/Contents/MacOS/plinth" &&
     /bin/chmod +x "$staged_app/Contents/MacOS/plinth" &&
     "$script_dir/sync-macos-music-links.sh" "$script_dir/../src-tauri/Info.plist" "$staged_app/Contents/Info.plist" &&
     sign_dev_app "$staged_app"; then
    if /bin/mv "$app_path" "$previous_app" && /bin/mv "$staged_app" "$app_path"; then
      /bin/rm -rf "$staging_directory"
      return 0
    else
      update_result=$?
    fi
    if [[ -d "$previous_app" && ! -d "$app_path" ]]; then
      if ! /bin/mv "$previous_app" "$app_path"; then
        echo "Could not restore Plinth; the signed backup remains at $previous_app" >&2
        return 1
      fi
    fi
  else
    update_result=$?
  fi
  /bin/rm -rf "$staging_directory"
  return "$update_result"
}
