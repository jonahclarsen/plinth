import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,appendFileSync,copyFileSync,mkdirSync} from 'node:fs'
const file='src-tauri/src/history.rs',original=readFileSync(file),rows=[]
mkdirSync('.local/preview-native',{recursive:true})
try{
 appendFileSync(file,readFileSync('experiments/performance/native.rs','utf8').replace('for count in [96, 480]','for count in [150]'))
 for(const mode of ['release','debug']){
  const args=['test','--manifest-path','src-tauri/Cargo.toml',...(mode==='release'?['--release']:[]),'--bin','plinth','--no-run','--message-format=json']
  const out=execFileSync('cargo',args,{encoding:'utf8',maxBuffer:50*1024*1024,stdio:['ignore','pipe','inherit']})
  const binary=out.split('\n').filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.reason==='compiler-artifact'&&x.target.name==='plinth'&&x.profile.test&&x.executable)?.executable
  if(!binary)throw Error('Missing native benchmark')
  copyFileSync(binary,`.local/preview-native/${mode}`)
 }
 for(let repeat=0;repeat<5;repeat++)for(const mode of repeat%2?['debug','release']:['release','debug']){
  const out=execFileSync(`.local/preview-native/${mode}`,['native_performance::measure','--ignored','--nocapture'],{encoding:'utf8',env:{...process.env,PERF_VARIANT:mode,PERF_REPEAT:String(repeat)}})
  for(const line of out.split('\n'))if(line.startsWith('PERF_JSON ')){const row=JSON.parse(line.slice(10));rows.push(row);console.log(JSON.stringify(row))}
  writeFileSync('.local/preview-native/results.json',JSON.stringify(rows,null,2))
 }
}finally{writeFileSync(file,original)}
