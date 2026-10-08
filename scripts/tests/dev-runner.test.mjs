import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
const runner=fileURLToPath(new URL('../run-macos-dev-app.sh',import.meta.url))
const cargoRunner=fileURLToPath(new URL('../macos-tauri-cargo.sh',import.meta.url))
const icon=fileURLToPath(new URL('../../src-tauri/icons/icon.icns',import.meta.url))

test('runner rejects absent executables',()=>{
 assert.equal(spawnSync(runner,[],{encoding:'utf8'}).status,64)
 assert.equal(spawnSync(runner,['/nonexistent/plinth'],{encoding:'utf8'}).status,66)
})

test('Cargo launches a CLI-only probe inside the icon-bearing bundle, preserving arguments and exit status',{skip:process.platform!=='darwin'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'plinth dev runner '))
 try {
  mkdirSync(join(dir,'src'))
  writeFileSync(join(dir,'Cargo.toml'),'[package]\nname="plinth-runner-probe"\nversion="0.1.0"\nedition="2021"\n[workspace]\n')
  // This probe never creates an application or window and does not access Plinth data.
  writeFileSync(join(dir,'src/main.rs'),'fn main(){println!("{}",std::env::current_exe().unwrap().display());for arg in std::env::args().skip(1){println!("{}",arg);}std::process::exit(17);}\n')
  const env={...process.env,CARGO_TARGET_DIR:join(dir,'build output'),CARGO_BUILD_BUILD_DIR:join(dir,'build intermediates')}
  const result=spawnSync(cargoRunner,['run','--offline','--quiet','--','two words','literal $value'],{cwd:dir,env,encoding:'utf8'})
  assert.equal(result.status,17,result.stderr)
  const bundle=join(env.CARGO_TARGET_DIR,'debug','PlinthDev.app')
  const executable=join(bundle,'Contents/MacOS/plinth')
  assert.deepEqual(result.stdout.trim().split('\n'),[executable,'two words','literal $value'])
  assert.equal(lstatSync(executable).isSymbolicLink(),false)
  assert.equal(lstatSync(executable).ino,lstatSync(join(env.CARGO_TARGET_DIR,'debug','plinth-runner-probe')).ino)
  assert.deepEqual(readFileSync(join(bundle,'Contents/Resources/icon.icns')),readFileSync(icon))
  const info=spawnSync('/usr/bin/plutil',['-extract','CFBundleIconFile','raw',join(bundle,'Contents/Info.plist')],{encoding:'utf8'})
  assert.equal(info.status,0,info.stderr);assert.equal(info.stdout.trim(),'icon.icns')
  const scheme=spawnSync('/usr/bin/plutil',['-extract','CFBundleURLTypes.0.CFBundleURLSchemes.0','raw',join(bundle,'Contents/Info.plist')],{encoding:'utf8'})
  assert.equal(scheme.status,0,scheme.stderr);assert.equal(scheme.stdout.trim(),'plinth')
  const agent=spawnSync('/usr/bin/plutil',['-extract','LSUIElement','raw',join(bundle,'Contents/Info.plist')],{encoding:'utf8'})
  assert.equal(agent.status,0,agent.stderr);assert.equal(agent.stdout.trim(),'true')
  // A new Cargo build must replace the old executable hard link.
  writeFileSync(join(dir,'src/main.rs'),'fn main(){println!("rebuilt");}\n')
  const rebuilt=spawnSync(cargoRunner,['run','--offline','--quiet'],{cwd:dir,env,encoding:'utf8'})
  assert.equal(rebuilt.status,0,rebuilt.stderr);assert.equal(rebuilt.stdout.trim(),'rebuilt')
  // The watcher is a distinct, standalone executable. It must never register as
  // another running Plinth.app or change the Cargo/dev bundle's original inode.
  const helper=fileURLToPath(new URL('../install-dev-supervisor.sh',import.meta.url))
  const supervisor=join(dir,'dev-supervisor')
  const installed=spawnSync(helper,[executable,supervisor,'-'],{encoding:'utf8'})
  assert.equal(installed.status,0,installed.stderr)
  assert.notEqual(lstatSync(supervisor).ino,lstatSync(executable).ino)
  const signature=spawnSync('/usr/bin/codesign',['-dv',supervisor],{encoding:'utf8'})
  assert.equal(signature.status,0,signature.stderr)
  assert.match(signature.stderr,/Identifier=com\.plinth\.desktop\.dev-supervisor/)
  const supervised=spawnSync(supervisor,[],{encoding:'utf8'})
  assert.equal(supervised.status,0,supervised.stderr)
  assert.equal(supervised.stdout.trim(),'rebuilt')
 } finally {rmSync(dir,{recursive:true,force:true})}
})


test('installed app protocol metadata refresh preserves its identity and handles scalar strings',{skip:process.platform!=='darwin'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'plinth protocol metadata '))
 try {
  const installed=join(dir,'Info.plist')
  writeFileSync(installed,'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.plinth.fixture</string><key>NSAppleEventsUsageDescription</key><string>Old description</string></dict></plist>')
  const sync=fileURLToPath(new URL('../sync-macos-music-links.sh',import.meta.url))
  const source=fileURLToPath(new URL('../../src-tauri/Info.plist',import.meta.url))
  const result=spawnSync(sync,[source,installed],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
  const extract=(key)=>{
   const result=spawnSync('/usr/bin/plutil',['-extract',key,'raw',installed],{encoding:'utf8'})
   assert.equal(result.status,0,result.stderr);return result.stdout.trim()
  }
  assert.equal(extract('LSUIElement'),'true')
  assert.equal(extract('CFBundleIdentifier'),'com.plinth.fixture')
  assert.equal(extract('CFBundleURLTypes.0.CFBundleURLSchemes.0'),'plinth')
  assert.equal(extract('NSAppleEventsUsageDescription'),'Plinth opens albums, playlists, and artists in your Music library.')
 } finally {rmSync(dir,{recursive:true,force:true})}
})


test('live app updates leave the signed installation intact on staging failure',{skip:process.platform!=='darwin'},()=>{
 const dir=mkdtempSync(join(tmpdir(),'plinth staged update '))
 try {
  const app=join(dir,'Plinth.app')
  mkdirSync(join(app,'Contents/MacOS'),{recursive:true})
  const info=join(app,'Contents/Info.plist')
  writeFileSync(info,'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.plinth.fixture</string></dict></plist>')
  const executable=join(app,'Contents/MacOS/plinth')
  writeFileSync(executable,'previous executable')
  const replacement=join(dir,'replacement')
  writeFileSync(replacement,'new executable')
  const helper=fileURLToPath(new URL('../dev-app-update.sh',import.meta.url))
  const before=readFileSync(info)
  const failed=spawnSync('/bin/zsh',['-c',`
set -eu
script_dir=\${1:h}
source "$1"
sign_dev_app() { return 17; }
update_dev_app "$2" "$3"
`,'fixture',helper,replacement,app],{encoding:'utf8'})
  assert.equal(failed.status,17,failed.stderr)
  assert.equal(readFileSync(executable,'utf8'),'previous executable')
  assert.deepEqual(readFileSync(info),before)
  assert.equal(readdirSync(dir).some(name=>name.startsWith('.plinth-update.')),false)
  const rollback=spawnSync('/bin/zsh',['-c',`
set -eu
script_dir=\${1:h}
source "$1"
sign_dev_app() { /bin/rm -rf "$1"; }
update_dev_app "$2" "$3"
`,'fixture',helper,replacement,app],{encoding:'utf8'})
  assert.notEqual(rollback.status,0)
  assert.equal(readFileSync(executable,'utf8'),'previous executable')
  assert.deepEqual(readFileSync(info),before)
  assert.equal(readdirSync(dir).some(name=>name.startsWith('.plinth-update.')),false)
  const updated=spawnSync('/bin/zsh',['-c',`
set -eu
script_dir=\${1:h}
source "$1"
sign_dev_app() { print -r -- signed > "$1/signature-fixture"; }
update_dev_app "$2" "$3"
`,'fixture',helper,replacement,app],{encoding:'utf8'})
  assert.equal(updated.status,0,updated.stderr)
  assert.equal(readFileSync(executable,'utf8'),'new executable')
  assert.equal(readFileSync(join(app,'signature-fixture'),'utf8').trim(),'signed')
  const agent=spawnSync('/usr/bin/plutil',['-extract','LSUIElement','raw',info],{encoding:'utf8'})
  assert.equal(agent.status,0,agent.stderr);assert.equal(agent.stdout.trim(),'true')
 } finally {rmSync(dir,{recursive:true,force:true})}
})
