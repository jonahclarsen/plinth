#!/bin/zsh
set -eu

label="com.plinth.desktop-dev"
agent_path="$HOME/Library/LaunchAgents/$label.plist"

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
if [[ -f "$agent_path" ]]; then
  destination="$HOME/.Trash/$label-$(date +%Y%m%d-%H%M%S).plist"
  mv "$agent_path" "$destination"
fi
app_path="$HOME/Applications/Plinth.app"
if [[ -d "$app_path" ]]; then
  destination="$HOME/.Trash/Plinth-$(date +%Y%m%d-%H%M%S).app"
  mv "$app_path" "$destination"
fi
echo "Stopped $label and moved its LaunchAgent plist and installed app to the Trash"
