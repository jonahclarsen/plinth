// Analyze downloaded CI artifacts; does not run a benchmark locally.
import {readFileSync} from 'node:fs'
const input=JSON.parse(readFileSync(process.argv[2],'utf8'))
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length
const median=a=>{a=[...a].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2}
const p95=a=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*.95)-1]
const round=n=>Number(n.toFixed(3))
if(Array.isArray(input)){
 for(const retained of [20,100])for(const variant of ['release','debug']){
  const rows=input.filter(r=>r.retained===retained&&r.variant===variant)
  console.log(JSON.stringify({retained,variant,saveMs:round(median(rows.map(r=>mean(r.saveMs)))),historyMs:round(median(rows.map(r=>mean(r.listMs))))}))
 }
}else{
 for(const candidate of [...new Set(input.rows.map(r=>r.candidate))])for(const kind of [...new Set(input.rows.filter(r=>r.candidate===candidate).map(r=>r.kind))])for(const inputs of [...new Set(input.rows.filter(r=>r.candidate===candidate&&r.kind===kind).map(r=>r.times.length))]){
  const rows=input.rows.filter(r=>r.candidate===candidate&&r.kind===kind&&r.times.length===inputs)
  const summary={candidate,kind,inputs,pacing:inputs===12?'paused':'frame-paced'}
  for(const variant of ['baseline',candidate]){
   const samples=rows.filter(r=>r.variant===variant)
   summary[variant]={inputMs:round(median(samples.map(r=>mean(r.times)))),frameP95Ms:round(median(samples.map(r=>p95(r.intervals)))),heldSaves:samples.map(r=>r.held.saves),totalSaves:samples.map(r=>r.after.saves),historyReads:samples.map(r=>r.after.historyReads),sorts:median(samples.map(r=>r.during.sorts)),coverUrls:median(samples.map(r=>r.during.coverUrls)),motionUpdates:median(samples.map(r=>r.during.motionUpdates))}
  }
  console.log(JSON.stringify(summary))
 }
}
