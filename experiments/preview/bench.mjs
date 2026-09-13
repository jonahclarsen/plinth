import {webkit} from '@playwright/test'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const {port}=JSON.parse(readFileSync('port.json','utf8')),origin=`http://127.0.0.1:${port}`
const server=spawn('pnpm',['exec','vite','--host','127.0.0.1'],{stdio:'inherit'}),rows=[]
const adoption=!!process.env.PREVIEW_ADOPTION,focused=!!process.env.PREVIEW_FOCUSED
function checkpoint(){mkdirSync('.local/preview-results',{recursive:true});writeFileSync('.local/preview-results/web.json',JSON.stringify({mode:'development',albums:150,rasterSize:1200,rows},null,2))}
let browser
const metrics=()=>({sorts:0,coverUrls:0,motionUpdates:0,frames:0,saves:0,historyReads:0})
try{
 for(let i=0;i<200;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await webkit.launch()
 async function sample(variant,kind,paused=false){
  const page=await browser.newPage({viewport:{width:1550,height:1040}})
  await page.addInitScript(()=>{
   Math.random=()=>.5
   const layout={columns:18,gap:6,rowGap:null,top:42,radius:5,shadow:.4,roundedOnHover:false}
   const library={settings:{layout,wideLayout:{...layout},hoverScale:2.1,hoverSpeed:1,hoverEnabled:true,hoverInBackground:true,sort:'artist',shuffleSeed:0,theme:'dark',logo:'logo-1',desktopEnabled:true,allSpaces:true,targetSpace:null,openMode:'library'},albums:Array.from({length:150},(_,i)=>({id:`record-${i}`,title:`Record ${i}`,artist:`Artist ${i%20}`,date:'2024-01-01',url:'',original:'',cover:`cover-${i}.jpg`,enabled:true}))}
   const callbacks=new Map(),listeners=[];let next=1
   window.__previewMetrics={sorts:0,coverUrls:0,motionUpdates:0,frames:0,saves:0,historyReads:0}
   const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(t=>{window.__previewMetrics.frames++;fn(t)})
   Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:fn=>{const id=next++;callbacks.set(id,fn);return id},unregisterCallback:id=>callbacks.delete(id),convertFileSrc:path=>`${location.origin}/__preview-fixtures__/${path.split('/').at(-1)}`,invoke:async(command,args={})=>{
    if(command==='get_library')return {dataDir:'/synthetic',library}
    if(command==='get_displays')return [{id:1,logicalWidth:1512,logicalHeight:982,width:3024,height:1964,menuBarHeight:37,builtIn:true,current:true,remembered:false}]
    if(command==='get_spaces')return {available:[1,2,3]}
    if(command==='get_history'){window.__previewMetrics.historyReads++;return {entries:[],current:0,canUndo:false,canRedo:false}}
    if(command==='save_settings'){
     window.__previewMetrics.saves++;library.settings=args.settings
     queueMicrotask(()=>{for(const l of listeners.filter(l=>l.event==='library-changed'))callbacks.get(l.handler)?.({event:l.event,id:l.handler,payload:structuredClone(library)})})
     return null
    }
    if(command==='plugin:event|listen'){listeners.push(args);return next++}
    if(command==='plugin:window|scale_factor')return 1
    return null
   }},__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
  })
  await page.goto(`${origin}/.local/preview/${variant}/index.html`)
  await page.getByRole('button',{name:'Appearance',exact:true}).click()
  await page.locator('.desktop-cell').last().waitFor()
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.desktop-cover img')].map(img=>img.decode()))})
  const slider=page.getByRole('slider',{name:kind,exact:true});await slider.scrollIntoViewIfNeeded()
  const box=await slider.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down()
  await page.waitForTimeout(400)
  // Assert all 150 albums are mounted and their unscaled cells fit the screen.
  const geometry=await page.evaluate(()=>{
   const surface=document.querySelector('.desktop-surface').getBoundingClientRect(),cells=[...document.querySelectorAll('.desktop-cell')]
   if(cells.length!==150)throw Error('A cover was omitted')
   return cells.map(cell=>{const r=cell.getBoundingClientRect();if(r.left<surface.left-.2||r.right>surface.right+.2||r.top<surface.top-.2||r.bottom>surface.bottom+.2)throw Error('Offscreen album');return [cell.dataset.id,r.x-surface.x,r.y-surface.y,r.width,r.height]})
  })
  await page.evaluate(value=>{window.__previewMetrics=value},metrics())
  const result=await page.evaluate(async({kind,paused})=>{
   const slider=document.querySelector(`input[aria-label="${kind}"]`),times=[],intervals=[]
   const flush=()=>new Promise(r=>queueMicrotask(()=>queueMicrotask(r)))
   let previous=performance.now()
   for(let i=0;i<(paused?12:60);i++){
    await new Promise(r=>paused?setTimeout(r,160):requestAnimationFrame(r))
    const start=performance.now();intervals.push(start-previous);previous=start
    const low=kind==='Columns'?18:Number(slider.min),high=kind==='Columns'?30:Number(slider.max),step=Number(slider.step)
    slider.value=String(low+Math.round(((i%20)/19)*(high-low)/step)*step);slider.dispatchEvent(new Event('input',{bubbles:true}));await flush()
    document.querySelector('.desktop-grid').getBoundingClientRect();times.push(performance.now()-start)
   }
   const during={...window.__previewMetrics}
   await new Promise(r=>setTimeout(r,350))
   return {times,intervals,during,held:{...window.__previewMetrics},value:slider.value}
  },{kind,paused})
  await page.mouse.up();await page.waitForTimeout(400)
  const after=await page.evaluate(()=>({...window.__previewMetrics}))
  await page.close();return {...result,after,geometry}
 }
 for(const candidate of focused?['active-layer','sample-layers']:adoption?[]:['pixels','layers'])for(const kind of focused?['Hover size','Space between covers']:['Columns','Space between covers','Rounded corners','Shadow','Hover size']){
  for(const variant of ['baseline',candidate])await sample(variant,kind)
  for(let repeat=0;repeat<5;repeat++)for(const variant of repeat%2?[candidate,'baseline']:['baseline',candidate]){
   const result=await sample(variant,kind);rows.push({candidate,variant,kind,repeat,...result});console.log(JSON.stringify({...rows.at(-1),geometry:undefined,times:undefined,intervals:undefined}));checkpoint()
  }
 }
 const candidate=adoption?'adopted':'defer-save'
 for(let repeat=0;repeat<(focused?0:3);repeat++)for(const variant of repeat%2?[candidate,'baseline']:['baseline',candidate]){
  const row={candidate,variant,kind:'Space between covers',repeat,...await sample(variant,'Space between covers',true)}
  rows.push(row)
  if(variant==='adopted'&&(row.held.saves!==0||row.after.saves!==1||row.after.historyReads!==0))throw Error(`Unexpected persistence while dragging: ${JSON.stringify(row)}`)
 }
}finally{
 await browser?.close();server.kill();checkpoint()
}
