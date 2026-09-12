import {webkit} from '@playwright/test'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
const {port}=JSON.parse(readFileSync('port.json','utf8'))
const server=spawn('pnpm',['exec','vite','preview','--host','127.0.0.1','--port',String(port)],{stdio:'inherit'})
const origin=`http://127.0.0.1:${port}`
const rows=[]
let browser
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await webkit.launch()
 async function sample(variant,count,kind){
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  await page.addInitScript(({count})=>{
   // Synthetic native bridge: excludes filesystem/IPC, measured separately in Rust.
   const cover='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#768cba"/><circle cx="300" cy="300" r="190" fill="#b7cdb4"/></svg>')
   const layout={columns:12,gap:6,rowGap:null,top:42,radius:5,shadow:.4}
   const settings={layout,wideLayout:{...layout,columns:18},hoverScale:2.1,hoverSpeed:1,hoverEnabled:true,sort:'artist',shuffleSeed:0,theme:'dark',logo:'logo-1',desktopEnabled:true,allSpaces:true,targetSpace:null,openMode:'library'}
   const library={settings,albums:Array.from({length:count},(_,i)=>({id:`album-${i}`,title:`Record ${i}`,artist:`Artist ${i%20}`,date:'2024-01-01',url:'',original:'',cover,enabled:true}))}
   const callbacks=new Map();const listeners=[];let next=1
   window.__metrics={rects:0,frames:0,paints:0,saves:0}
   const rect=Element.prototype.getBoundingClientRect
   Element.prototype.getBoundingClientRect=function(){window.__metrics.rects++;return rect.call(this)}
   const raf=window.requestAnimationFrame.bind(window)
   window.requestAnimationFrame=fn=>raf(t=>{window.__metrics.frames++;fn(t)})
   Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{metadata:{currentWindow:{label:'desktop-test'},currentWebview:{label:'desktop-test'}},transformCallback:fn=>{const id=next++;callbacks.set(id,fn);return id},unregisterCallback:id=>callbacks.delete(id),convertFileSrc:path=>path.slice(path.indexOf('data:image/')),invoke:async(command,args={})=>{
    if(command==='get_library')return {dataDir:'/synthetic',library}
    if(command==='get_displays')return [{id:1,logicalWidth:1440,logicalHeight:1000,width:2880,height:2000,menuBarHeight:24,builtIn:true,current:true,remembered:false}]
    if(command==='get_spaces')return {available:[1,2,3]}
    if(command==='get_history')return {entries:[],current:0,canUndo:false,canRedo:false}
    if(command==='save_settings'){window.__metrics.saves++;library.settings=args.settings;return null}
    if(command==='plugin:event|listen'){listeners.push(args);return next++}
    return null
   }},__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
   window.__pointer=payload=>{for(const l of listeners.filter(l=>l.event==='desktop-pointer'))callbacks.get(l.handler)?.({event:l.event,id:l.handler,payload})}
  },{count})
  await page.goto(`${origin}/${variant}/index.html${kind==='pointer'?'?desktop=1':''}`)
  if(kind!=='pointer')await page.getByRole('button',{name:'Appearance',exact:true}).click()
  await page.locator('.desktop-cell').first().waitFor()
  if(kind==='Hover size'){
   const slider=page.getByRole('slider',{name:kind,exact:true});await slider.scrollIntoViewIfNeeded()
   const box=await slider.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down()
  }
  await page.waitForTimeout(350)
  const result=await page.evaluate(async({kind})=>{
   const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve))
   const flush=()=>new Promise(resolve=>queueMicrotask(()=>queueMicrotask(resolve)))
   const cells=[...document.querySelectorAll('.desktop-cell')]
   const targets=cells.map(el=>{const r=el.getBoundingClientRect();return {id:el.dataset.id,x:r.left+r.width/2,y:r.top+r.height/2,visible:true}}).filter(p=>p.y<innerHeight)
   const surface=document.querySelector('.desktop-surface').getBoundingClientRect()
   const input=document.querySelector(`input[aria-label="${kind}"]`)
   let mutations=0;const observer=new MutationObserver(list=>mutations+=list.filter(x=>x.attributeName==='style').length)
   observer.observe(document.querySelector('.desktop-grid'),{subtree:true,attributes:true,attributeFilter:['style']})
   window.__metrics={rects:0,frames:0,paints:0,saves:0}
   const renderedCells=cells.length;
   const costs=[],intervals=[];let last=performance.now(),correct=0
   // Warm caches once; retain cold measurements separately.
   const coldStart=performance.now()
   if(kind==='pointer'){window.__pointer(targets[targets.length-1]);await flush()}
   const coldMs=performance.now()-coldStart,coldRects=window.__metrics.rects
   window.__metrics.rects=0
   for(let i=0;i<90;i++){
    await raf();const start=performance.now();intervals.push(start-last);last=start
    if(kind==='pointer'){
     const miss=i%4===0;const point=miss?{x:surface.right-1,y:surface.top+1,visible:true}:targets[(i*7)%targets.length]
     window.__pointer(point);await flush()
     const active=document.querySelector('.enlarged')?.parentElement?.dataset.id
     if((miss&&!active)||(!miss&&active===point.id))correct++
    }else{
     const low=Number(input.min),high=Number(input.max),step=Number(input.step)
     input.value=String(low+Math.round(((i%30)/29)*(high-low)/step)*step)
     input.dispatchEvent(new Event('input',{bubbles:true}));await flush()
     // Include forced style/layout completion, excluding frame wait.
     document.querySelector('.desktop-grid').getBoundingClientRect()
    }
    costs.push(performance.now()-start)
   }
   await new Promise(r=>setTimeout(r,350));observer.disconnect()
   const quantile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.ceil(a.length*p)-1]
   if(kind==='pointer'&&correct!==90)throw Error(`Incorrect hit testing: ${correct}/90`)
   return {renderedCells,medianMs:quantile(costs,.5),p95Ms:quantile(costs,.95),frameP95Ms:quantile(intervals.slice(1),.95),framesOver25ms:intervals.slice(1).filter(t=>t>25).length,styleMutations:mutations,...window.__metrics,coldMs,coldRects,correct,costs,intervals}
  },{kind})
  await page.close();return result
 }
 // AB/BA order, five paired repeats. One untimed warmup per variant/case.
 for(const count of [96,480])for(const [kind,candidate] of [['Rounded corners','radius-css'],['Space between covers','cull'],['Hover size','cull'],['pointer','pointer'],['pointer','cull']]){
  for(const variant of ['baseline',candidate])await sample(variant,count,kind)
  for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2? [candidate,'baseline']:['baseline',candidate]){
   const result=await sample(variant,count,kind);rows.push({variant,candidate,count,kind,repeat,...result});console.log(JSON.stringify({...rows.at(-1),costs:undefined,intervals:undefined}))
  }
 }
}finally{await browser?.close();server.kill();mkdirSync('.local/performance',{recursive:true});writeFileSync('.local/performance/web.json',JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,rows},null,2))}
