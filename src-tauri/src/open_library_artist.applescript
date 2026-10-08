on run argv
set artistName to item 1 of argv
tell application "Music"
activate
set matches to (every track of library playlist 1 whose album artist is artistName)
if (count of matches) is 0 then set matches to (every track of library playlist 1 whose artist is artistName)
if (count of matches) is 0 then
    display alert "Artist not found" message ("“" & artistName & "” wasn’t found in your Apple Music library.") as warning buttons {"OK"} default button "OK"
    return
end if
reveal item 1 of matches
end tell
-- Fixed navigation only: never type link text, invoke a shortcut, or click a
-- control named by the link. Fail closed if Music's library action is absent.
delay 0.2
tell application "System Events"
tell process "Music"
    click menu bar item "Song" of menu bar 1
    delay 0.1
    repeat with navigationItem in (entire contents of menu 1 of menu bar item "Song" of menu bar 1)
        if class of navigationItem is menu item then
            if name of navigationItem is "Show Artist in Library" and enabled of navigationItem then
                click navigationItem
                return
            end if
        end if
    end repeat
end tell
end tell
error "Music’s Show Artist in Library command is unavailable. Artist links require Accessibility permission and an English Music interface."
end run
