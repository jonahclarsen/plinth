// CI-only validation against the current application's parent, without replaying old patches.
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,appendFileSync,copyFileSync,mkdirSync} from 'node:fs'
const base=process.env.ADOPTION_BASE??'cb831bc'
const files=['src/App.svelte','src/lib/Desktop.svelte','src-tauri/src/history.rs']
const current=new Map(files.map(file=>[file,readFileSync(file)]))
const run=(cmd,args,options={})=>execFileSync(cmd,args,{stdio:'inherit',...options})
const reset=variant=>{for(const file of files)writeFileSync(file,variant==='baseline'?execFileSync('git',['show',`${base}:${file}`]):current.get(file))}
mkdirSync('.local/performance',{recursive:true})
try{
 for(const variant of ['baseline','pointer']){
  reset(variant)
  run('pnpm',['check'])
  run('pnpm',['exec','vite','build',`--base=/${variant}/`,`--outDir=dist/${variant}`])
 }
 run('node',['experiments/performance/web.mjs'],{env:{...process.env,PERF_FIT:'1',PERF_CASE:'pointer'}})
 reset('candidate');run('pnpm',['build'])
 // Production-build regressions and README captures run only against the shipping candidate.
 run('pnpm',['exec','playwright','test','--config','experiments/performance/adoption.config.ts'])
 const results=[],checks={}
 for(const variant of ['baseline','compact']){
  reset(variant)
  appendFileSync('src-tauri/src/history.rs',readFileSync('experiments/performance/native.rs'))
  const output=run('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--release','--bin','plinth','--no-run','--message-format=json'],{encoding:'utf8',maxBuffer:50*1024*1024,stdio:['ignore','pipe','inherit']})
  const binary=output.split('\n').filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.reason==='compiler-artifact'&&x.target.name==='plinth'&&x.profile.test&&x.executable)?.executable
  if(!binary)throw Error('Missing native test binary')
  copyFileSync(binary,`.local/performance/native-${variant}`)
  checks[variant]=run(`.local/performance/native-${variant}`,[],{encoding:'utf8',stdio:['ignore','pipe','inherit']})
  process.stdout.write(checks[variant])
 }
 writeFileSync('.local/performance/native-checks.json',JSON.stringify(checks,null,2))
 for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2?['compact','baseline']:['baseline','compact']){
  const output=run(`.local/performance/native-${variant}`,['native_performance::measure','--ignored','--nocapture'],{encoding:'utf8',stdio:['ignore','pipe','inherit'],env:{...process.env,PERF_VARIANT:variant,PERF_REPEAT:String(repeat)}})
  process.stdout.write(output)
  for(const line of output.split('\n'))if(line.startsWith('PERF_JSON '))results.push(JSON.parse(line.slice(10)))
  writeFileSync('.local/performance/native.json',JSON.stringify(results,null,2))
 }
}finally{reset('candidate')}
