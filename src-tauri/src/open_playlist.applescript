use framework "Foundation"
use scripting additions

-- Compare names locally: Music's `whose name is ...` filter does not apply
-- AppleScript's text comparison rules, and top-level lookups can omit sources.
on canonicalPlaylistName(value)
    set textValue to current application's NSString's stringWithString:(value as text)
    set textValue to textValue's precomposedStringWithCanonicalMapping()
    set whitespace to current application's NSCharacterSet's whitespaceAndNewlineCharacterSet()
    set parts to (textValue's componentsSeparatedByCharactersInSet:whitespace) as list
    set nonemptyParts to {}
    repeat with part in parts
        if (part as text) is not "" then set end of nonemptyParts to part as text
    end repeat
    set joined to current application's NSArray's arrayWithArray:nonemptyParts
    return ((joined's componentsJoinedByString:" ")'s lowercaseString()) as text
end canonicalPlaylistName

-- Prefer the exact spelling. A normalized fallback must be unambiguous.
on playlistIndex(playlistName, names)
    considering case
        repeat with i from 1 to count of names
            if (item i of names as text) is playlistName then return i
        end repeat
    end considering
    set requestedName to my canonicalPlaylistName(playlistName)
    set matchIndex to 0
    repeat with i from 1 to count of names
        if my canonicalPlaylistName(item i of names) is requestedName then
            if matchIndex is not 0 then return -1
            set matchIndex to i
        end if
    end repeat
    return matchIndex
end playlistIndex

-- Use Music's writable browser view rather than relying on `reveal`, which
-- can select an item without switching the main window to that playlist.
-- Object references come only from the local library, never from link text.
on showPlaylist(targetPlaylist, browserWindow)
    using terms from application "Music"
        set view of browserWindow to targetPlaylist
        set visible of browserWindow to true
        set collapsed of browserWindow to false
        return (persistent ID of view of browserWindow) is (persistent ID of targetPlaylist)
    end using terms from
end showPlaylist

on run argv
set playlistName to item 1 of argv
tell application "Music"
activate
-- Cold launches can expose an empty library briefly. Retry before reporting a
-- missing item; every lookup remains read-only and scoped to local libraries.
repeat with attempt from 1 to 20
    set librarySources to (every source whose kind is library)
    repeat with librarySource in librarySources
        set candidates to (every user playlist of librarySource)
        set candidateNames to (name of every user playlist of librarySource)
        set matchIndex to my playlistIndex(playlistName, candidateNames)
        if matchIndex is 0 then
            set candidates to (every playlist of librarySource)
            set candidateNames to (name of every playlist of librarySource)
            set matchIndex to my playlistIndex(playlistName, candidateNames)
        end if
        if matchIndex is -1 then
            display alert "Multiple playlists match" message "More than one playlist has this name after ignoring spacing and capitalization. Use the exact playlist name in your link." as warning buttons {"OK"} default button "OK"
            return
        end if
        if matchIndex > 0 then
            set targetPlaylist to contents of item matchIndex of candidates
            set navigationError to "Music did not switch to the requested playlist."
            repeat with navigationAttempt from 1 to 20
                try
                    -- A closed browser may need reveal to create its window.
                    if (count of browser windows) is 0 then reveal targetPlaylist
                    set mainWindow to browser window 1
                    if my showPlaylist(targetPlaylist, mainWindow) then return
                on error errorMessage
                    set navigationError to errorMessage
                end try
                if navigationAttempt < 20 then delay 0.25
            end repeat
            error ("Music found the playlist but could not display it: " & navigationError)
        end if
    end repeat
    if attempt < 20 then delay 0.25
end repeat
display alert "Playlist not found" message ("“" & playlistName & "” wasn’t found in your Apple Music library.") as warning buttons {"OK"} default button "OK"
end tell
end run
