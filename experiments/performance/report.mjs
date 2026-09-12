// Summarize downloaded CI artifacts without executing benchmarks locally.
import {readFileSync,writeFileSync} from 'node:fs'
const folder=process.argv[2]??'.local/performance'
const web=JSON.parse(readFileSync(`${folder}/web.json`,'utf8'))
const native=JSON.parse(readFileSync(`${folder}/native.json`,'utf8'))
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length
const f=x=>x.toFixed(3)
const improvement=(a,b)=>a?`${((a-b)/a*100).toFixed(1)}%`:'—'
const lines=['# macOS CI performance results','','All timings below are milliseconds. Frontend work is the median of five per-run mean input-handler/flush/layout times; native timings are the median of five per-run means of ten operations. Paired wins count repetitions where the candidate used less time. These are experimental comparisons, not shipped optimizations.','','## Frontend','','| Test | Albums | Baseline work | Candidate work | Reduction | Paired wins | Frame p95 baseline → candidate | Style writes baseline → candidate | Geometry reads baseline → candidate |','|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for(const count of [96,480])for(const [kind,candidate] of [['Rounded corners','radius-css'],['Space between covers','cull'],['Hover size','cull'],['pointer','pointer'],['pointer','cull']]){
 const get=v=>web.rows.filter(r=>r.variant===v&&r.count===count&&r.kind===kind&&r.candidate===candidate).sort((a,b)=>a.repeat-b.repeat)
 const a=get('baseline'),b=get(candidate),cost=rs=>median(rs.map(r=>mean(r.costs)))
 const metric=(rs,k)=>median(rs.map(r=>r[k]))
 lines.push(`| ${kind} (${candidate}) | ${count} | ${f(cost(a))} | ${f(cost(b))} | ${improvement(cost(a),cost(b))} | ${b.filter((r,i)=>mean(r.costs)<mean(a[i].costs)).length}/5 | ${f(metric(a,'frameP95Ms'))} → ${f(metric(b,'frameP95Ms'))} | ${metric(a,'styleMutations')} → ${metric(b,'styleMutations')} | ${metric(a,'rects')} → ${metric(b,'rects')} |`)
}
lines.push('','## Native persistence','','| Candidate / test | Albums | Initial retained states | Baseline | Candidate | Reduction | Paired wins | Final JSON bytes baseline → candidate |','|---|---:|---:|---:|---:|---:|---:|---:|')
for(const candidate of ['compact','indexed'])for(const count of [96,480])for(const retained of [20,100])for(const [key,label] of [['saveMs','save'],['listMs','history list']]){
 const get=v=>native.filter(r=>r.variant===v&&r.count===count&&r.retained===retained).sort((a,b)=>a.repeat-b.repeat)
 const a=get('baseline'),b=get(candidate),cost=rs=>median(rs.map(r=>mean(r[key])))
 lines.push(`| ${candidate} / ${label} | ${count} | ${retained} | ${f(cost(a))} | ${f(cost(b))} | ${improvement(cost(a),cost(b))} | ${b.filter((r,i)=>mean(r[key])<mean(a[i][key])).length}/5 | ${median(a.map(r=>r.bytes))} → ${median(b.map(r=>r.bytes))} |`)
}
try{
 const regression=JSON.parse(readFileSync(`${folder}/regression.json`,'utf8'))
 lines.push('','## Frontend behavior checks','','| Test | Result |','|---|---|')
 function visit(suite){for(const spec of suite.specs??[])lines.push(`| ${spec.title} | ${spec.tests.map(t=>t.status).join(', ')} |`);for(const child of suite.suites??[])visit(child)}
 for(const suite of regression.suites)visit(suite)
}catch{}
writeFileSync(`${folder}/summary.md`,lines.join('\n')+'\n')
console.log(lines.join('\n'))
