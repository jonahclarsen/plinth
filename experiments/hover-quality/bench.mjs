import {webkit} from '@playwright/test'
import {spawn,execFileSync} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync,cpSync} from 'node:fs'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'
const sharp=createRequire(import.meta.url)('sharp')
const base=process.env.HOVER_BASELINE||'a051dd1',out=resolve('.local/hover-results')
mkdirSync(out,{recursive:true})
for(const variant of ['baseline','fixed']){
 const root=resolve(`.local/hover/${variant}`);mkdirSync(root,{recursive:true})
 if(variant==='baseline')execFileSync('tar',['-x','-C',root],{input:execFileSync('git',['archive',base,'src','index.html','package.json','tsconfig.json'])})
 else for(const file of ['src','index.html','package.json','tsconfig.json'])cpSync(file,`${root}/${file}`,{recursive:true})
 execFileSync('pnpm',['exec','vite','build',root,'--config',resolve('vite.config.ts'),'--base',`/${variant}/`,'--outDir',resolve(`.local/hover-dist/${variant}`)],{stdio:'inherit'})
}
// A patterned bitmap, rather than SVG, exercises WebKit's interpolation controller.
const bitmap='data:image/png;base64,'+(await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><pattern id="p" width="11" height="13" patternUnits="userSpaceOnUse"><rect width="11" height="13" fill="#e6a9bc"/><path d="M0 0L11 13M11 0L0 13" stroke="#365d72"/></pattern></defs><rect width="1200" height="1200" fill="url(#p)"/></svg>')).png().toBuffer()).toString('base64')
const {port}=JSON.parse(readFileSync('port.json','utf8')),origin=`http://127.0.0.1:${port}`
const server=spawn('pnpm',['exec','vite','preview','--outDir',resolve('.local/hover-dist'),'--host','127.0.0.1','--port',String(port)],{stdio:'inherit'})
function cpu(){
 const processes=new Map()
 for(const line of execFileSync('ps',['-axo','pid,time,command'],{encoding:'utf8'}).split('\n')){
  if(!/webkit-\d+|com\.apple\.WebKit\.(WebContent|GPU|Networking)/.test(line))continue
  const match=line.trim().match(/^(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/)
  if(match)processes.set(Number(match[1]),Number(match[2]||0)*86400+Number(match[3]||0)*3600+Number(match[4])*60+Number(match[5]))
 }
 return processes
}
const rows=[];let browser
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 async function sample(variant,count,kind){
  // Each sample owns its browser processes, so an old page's teardown cannot subtract CPU.
  const preexisting=cpu()
  browser=await webkit.launch()
  const page=await browser.newPage({viewport:{width:1512,height:982},deviceScaleFactor:2})
  await page.addInitScript(({count,bitmap})=>{
   const layout={columns:count===18?12:18,gap:6,rowGap:null,top:42,radius:5,shadow:.4,roundedOnHover:false}
   const library={settings:{layout,wideLayout:layout,hoverScale:2.1,hoverSpeed:1,hoverEnabled:true,hoverInBackground:true,pushNeighbors:true,sort:'artist',shuffleSeed:0,theme:'dark',logo:'logo-1',desktopEnabled:true,allSpaces:true,targetSpace:null},albums:Array.from({length:count},(_,i)=>({id:`record-${i}`,title:`Record ${i}`,artist:`Artist ${i}`,date:'2024-01-01',cover:bitmap,original:'',url:'',enabled:true}))}
   const callbacks=new Map(),listeners=[];let next=1
   window.isTauri=true
   window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'desktop-ci'},currentWebview:{label:'desktop-ci'}},transformCallback:fn=>{const id=next++;callbacks.set(id,fn);return id},unregisterCallback:id=>callbacks.delete(id),convertFileSrc:()=>bitmap,invoke:async(command,args={})=>{
    if(command==='get_library')return {dataDir:'/synthetic',library}
    if(command==='get_displays')return [{id:1,logicalWidth:1512,logicalHeight:982,menuBarHeight:37,builtIn:true,current:true}]
    if(command==='plugin:event|listen'){listeners.push(args);return next++}
    return null
   }}
   window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}}
   window.__hoverPoint=payload=>{for(const listener of listeners.filter(l=>l.event==='desktop-pointer'))callbacks.get(listener.handler)?.({event:listener.event,id:listener.handler,payload:{...payload,foregroundAllowed:true}})}
  },{count,bitmap})
  await page.goto(`${origin}/${variant}/index.html?desktop=1`)
  await page.waitForFunction(count=>document.querySelectorAll('.desktop-cover img').length===count,count)
  await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())))
  const points=await page.locator('.desktop-cell').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,visible:true}}))
  if(points.some(p=>p.y>=982))throw Error('Fixture artwork clipped')
  await page.waitForTimeout(800)
  // Include first-hover raster setup; omit it for idle. Hold isolates steady breathing.
  if(kind==='hold'){await page.evaluate(p=>window.__hoverPoint(p),points[1]);await page.waitForTimeout(1000)}
  const before=cpu(),started=performance.now()
  const result=await page.evaluate(async({points,kind})=>{
   const frames=[],started=performance.now();let last=started,step=-1,mutations=0
   const observer=new MutationObserver(records=>mutations+=records.length)
   observer.observe(document.querySelector('.desktop-grid'),{subtree:true,attributes:true,attributeFilter:['style']})
   await new Promise(resolve=>{function tick(now){frames.push(now-last);last=now
    if(kind==='sweep'){const next=Math.floor((now-started)/350);if(next!==step){step=next;window.__hoverPoint(points[next%points.length])}}
    if(now-started<5000)requestAnimationFrame(tick);else resolve()
   }requestAnimationFrame(tick)})
   observer.disconnect();frames.shift()
   const sorted=[...frames].sort((a,b)=>a-b),q=p=>sorted[Math.ceil(sorted.length*p)-1]
   return {medianFrameMs:q(.5),p95FrameMs:q(.95),framesOver25ms:frames.filter(t=>t>25).length,frames:frames.length,styleMutations:mutations}
  },{points,kind})
  const elapsedMs=performance.now()-started,after=cpu()
  const retired=[...before.keys()].filter(pid=>!preexisting.has(pid)&&!after.has(pid))
  const cpuSeconds=[...after].reduce((sum,[pid,seconds])=>sum+(preexisting.has(pid)?0:seconds-(before.get(pid)||0)),0)
  await browser.close();browser=undefined
  // Never publish a CPU total if a measured process vanished before its final reading.
  if(retired.length||cpuSeconds<0)throw Error(`Invalid process CPU sample: ${JSON.stringify({retired,cpuSeconds})}`)
  return {...result,cpuSeconds,elapsedMs,cpuPercent:100*cpuSeconds/(elapsedMs/1000),processes:after.size-preexisting.size}
 }
 for(const count of [18,150])for(const kind of ['idle','hold','sweep']){
  for(const variant of ['baseline','fixed'])await sample(variant,count,kind)
  for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2?['fixed','baseline']:['baseline','fixed']){
   const row={variant,count,kind,repeat,...await sample(variant,count,kind)};rows.push(row);console.log(JSON.stringify(row))
   writeFileSync(`${out}/raw.json`,JSON.stringify({base,node:process.version,rows},null,2))
  }
 }
 const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]
 const summary=[]
 for(const count of [18,150])for(const kind of ['idle','hold','sweep']){
  const values=variant=>Object.fromEntries(['cpuPercent','cpuSeconds','p95FrameMs','framesOver25ms','styleMutations'].map(key=>[key,median(rows.filter(r=>r.count===count&&r.kind===kind&&r.variant===variant).map(r=>r[key]))]))
  const baseline=values('baseline'),fixed=values('fixed')
  summary.push({count,kind,baseline,fixed,cpuChangePercent:baseline.cpuSeconds?100*(fixed.cpuSeconds/baseline.cpuSeconds-1):null})
 }
 writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2))
}finally{await browser?.close();server.kill()}
