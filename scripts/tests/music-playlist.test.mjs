import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const script = readFileSync(new URL('../../src-tauri/src/open_playlist.applescript', import.meta.url), 'utf8')
// Exercise the real name resolver without executing its Music/GUI entrypoint.
const entrypoint = script.indexOf('\non run argv')
assert.ok(entrypoint > 0, 'Music entrypoint must be separated from the pure name resolver')
const helpers = script.slice(0, entrypoint)
assert.doesNotMatch(helpers, /tell application \"Music\"/, 'Headless tests must exclude Music automation')
const harness = `${helpers}\non run argv\nreturn my playlistIndex(item 1 of argv, rest of argv)\nend run\n`
const resolve = (requested, names) => {
  const result = spawnSync('/usr/bin/osascript', ['-e', harness, '--', requested, ...names], {encoding: 'utf8'})
  assert.equal(result.status, 0, result.stderr)
  return Number(result.stdout.trim())
}

test('playlist matching prefers exact spelling and does not match partial names', {skip: process.platform !== 'darwin'}, () => {
  assert.equal(resolve('Evening Records', ['Evening Records ', 'Evening Records']), 2)
  assert.equal(resolve('Evening', ['Evening Records']), 0)
  assert.equal(resolve('Evening Records', []), 0)
})

test('playlist matching tolerates invisible spacing, case, and Unicode composition', {skip: process.platform !== 'darwin'}, () => {
  assert.equal(resolve('Evening Records', [' Evening\u00a0\u00a0Records ']), 1)
  assert.equal(resolve('Evening Records', ['evening records']), 1)
  assert.equal(resolve('Café', ['Cafe\u0301']), 1)
})

test('playlist matching rejects ambiguous normalized names and preserves executable text as data', {skip: process.platform !== 'darwin'}, () => {
  assert.equal(resolve('evening records', ['Evening Records ', 'Evening  Records']), -1)
  const literal = '" & do shell script "touch /tmp/unwanted" & " $(curl evil) `id`'
  assert.equal(resolve(literal, ['Another playlist', literal]), 2)
})

test('playlist navigation changes the browser view and shows its window without playing tracks', {skip: process.platform !== 'darwin'}, () => {
  const fixture = `${helpers}
using terms from application "Music"
    script requestedPlaylist
        property persistent ID : "SYNTHETIC-PLAYLIST"
    end script
    script previousPlaylist
        property persistent ID : "PREVIOUS-PLAYLIST"
    end script
    script syntheticWindow
        property view : previousPlaylist
        property visible : false
        property collapsed : true
    end script
    if not my showPlaylist(requestedPlaylist, syntheticWindow) then error "Wrong playlist displayed"
    if not visible of syntheticWindow then error "Window remained hidden"
    if collapsed of syntheticWindow then error "Window remained minimized"
    return persistent ID of view of syntheticWindow
end using terms from
`
  const result = spawnSync('/usr/bin/osascript', ['-e', fixture], {encoding: 'utf8'})
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'SYNTHETIC-PLAYLIST')
})
