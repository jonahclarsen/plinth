on run argv
set albumTitle to item 1 of argv
set artistName to item 2 of argv
tell application "Music"
activate
set matches to (every track of library playlist 1 whose album is albumTitle)
if (count of matches) is 0 then set matches to (every track of library playlist 1 whose album contains albumTitle)
if (count of matches) is 0 then
    display alert "Album not found" message ("“" & albumTitle & "” wasn’t found in your Apple Music library.") as warning buttons {"OK"} default button "OK"
    return
end if
set selectedTrack to item 1 of matches
repeat with candidate in matches
if artist of candidate is artistName or album artist of candidate is artistName then
set selectedTrack to candidate
exit repeat
end if
end repeat
reveal selectedTrack
end tell
end run
