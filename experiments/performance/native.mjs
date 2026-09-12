import {execFileSync} from 'node:child_process'
import {readFileSync,appendFileSync,copyFileSync,mkdirSync,writeFileSync} from 'node:fs'
mkdirSync('.local/performance',{recursive:true})
const variants=['baseline','compact','indexed'],rows=[]
for(const variant of variants){
 execFileSync('node',['experiments/performance/prepare.mjs',variant],{stdio:'inherit'})
 appendFileSync('src-tauri/src/history.rs',readFileSync('experiments/performance/native.rs'))
 const output=execFileSync('cargo',['test','--manifest-path','src-tauri/Cargo.toml','--release','--bin','plinth','--no-run','--message-format=json'],{encoding:'utf8',maxBuffer:50*1024*1024,stdio:['ignore','pipe','inherit']})
 const binary=output.split('\n').filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.reason==='compiler-artifact'&&x.target.name==='plinth'&&x.profile.test&&x.executable)?.executable
 if(!binary)throw Error('Test binary not found')
 copyFileSync(binary,`.local/performance/native-${variant}`)
 // Full native regression suite for each individual candidate, benchmark still ignored.
 execFileSync(`.local/performance/native-${variant}`,[],{stdio:'inherit'})
}
for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2?[...variants].reverse():variants){
 const output=execFileSync(`.local/performance/native-${variant}`,['native_performance::measure','--ignored','--nocapture'],{encoding:'utf8',env:{...process.env,PERF_VARIANT:variant,PERF_REPEAT:String(repeat)}})
 process.stdout.write(output)
 for(const line of output.split('\n'))if(line.startsWith('PERF_JSON '))rows.push(JSON.parse(line.slice(10)))
 writeFileSync('.local/performance/native.json',JSON.stringify(rows,null,2))
}
execFileSync('node',['experiments/performance/prepare.mjs','baseline'],{stdio:'inherit'})
