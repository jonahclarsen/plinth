on run argv
set playlistName to item 1 of argv
tell application "Music"
activate
set matches to (every playlist whose name is playlistName)
if (count of matches) is 0 then
    display alert "Playlist not found" message ("“" & playlistName & "” wasn’t found in your Apple Music library.") as warning buttons {"OK"} default button "OK"
    return
end if
reveal item 1 of matches
end tell
end run
