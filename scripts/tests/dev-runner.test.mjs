import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, lstatSync, rmSync} from 'node:fs'
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
  const env={...process.env,CARGO_TARGET_DIR:join(dir,'build output')}
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
  // A new Cargo build must replace the old executable hard link.
  writeFileSync(join(dir,'src/main.rs'),'fn main(){println!("rebuilt");}\n')
  const rebuilt=spawnSync(cargoRunner,['run','--offline','--quiet'],{cwd:dir,env,encoding:'utf8'})
  assert.equal(rebuilt.status,0,rebuilt.stderr);assert.equal(rebuilt.stdout.trim(),'rebuilt')
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
  assert.equal(extract('CFBundleIdentifier'),'com.plinth.fixture')
  assert.equal(extract('CFBundleURLTypes.0.CFBundleURLSchemes.0'),'plinth')
  assert.equal(extract('NSAppleEventsUsageDescription'),'Plinth opens albums, playlists, and artists in your Music library.')
 } finally {rmSync(dir,{recursive:true,force:true})}
})
