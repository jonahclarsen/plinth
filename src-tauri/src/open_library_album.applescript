on run argv
set albumTitle to item 1 of argv
set artistName to item 2 of argv
tell application "Music"
activate
set matches to (every track of library playlist 1 whose album is albumTitle)
repeat with candidate in matches
    if artistName is "" or artist of candidate is artistName or album artist of candidate is artistName then
        reveal candidate
        return
    end if
end repeat
display alert "Album not found" message ("“" & albumTitle & "” wasn’t found in your Apple Music library.") as warning buttons {"OK"} default button "OK"
end tell
end run
