// Generate CI-only variants. The shared desktop geometry remains the source of truth.
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
// Pin the original experiment even after a candidate is adopted.
const baseline='.local/preview-source'
mkdirSync(baseline,{recursive:true})
execFileSync('tar',['-x','-C',baseline],{input:execFileSync('git',['archive','90157b7','src','tsconfig.json','package.json','index.html'])})
const focused=!!process.env.PREVIEW_FOCUSED
const variants=focused?['baseline','active-layer','sample-layers']:process.env.PREVIEW_ADOPTION?['baseline','adopted']:['baseline','pixels','layers','defer-save']
function replace(file,a,b){const s=readFileSync(file,'utf8');if(!s.includes(a))throw Error(`Patch missing in ${file}: ${a}`);writeFileSync(file,s.replace(a,b))}
for(const variant of variants){
 const root=`.local/preview/${variant}`;mkdirSync(root,{recursive:true})
 const source=variant==='adopted'||focused?'.':baseline
 cpSync(`${source}/src`,`${root}/src`,{recursive:true})
 for(const file of ['tsconfig.json','package.json'])cpSync(`${source}/${file}`,`${root}/${file}`)
 writeFileSync(`${root}/index.html`,readFileSync(`${source}/index.html`,'utf8').replace('src="/src/main.ts"','src="./src/main.ts"'))
 const app=`${root}/src/App.svelte`,desktop=`${root}/src/lib/Desktop.svelte`,css=`${root}/src/app.css`
 if(variant==='pixels'){
  replace(app,'width:${screen.width}px;height:${screen.height}px;transform:scale(${previewWidth/screen.width})','width:${previewWidth}px;height:${screen.height*previewWidth/screen.width}px')
  replace(desktop,' $: spacing=desktopSpacing', ' $: renderScale=preview?previewScale:1\n $: spacing=desktopSpacing')
  replace(desktop,'`${viewportHeight}px`','`${viewportHeight*renderScale}px`')
  for(const [a,b] of [
   ['${desktopCoverSize(layout,viewportWidth??width)}px','${desktopCoverSize(layout,viewportWidth??width)*renderScale}px'],
   ['${layout.gap}px','${layout.gap*renderScale}px'],
   ['${spacing.rowGap}px','${spacing.rowGap*renderScale}px'],
   ['${spacing.top}px','${spacing.top*renderScale}px'],
   ['${layout.radius}px','${layout.radius*renderScale}px'],
   ['--shadow:${layout.shadow};','--shadow:${layout.shadow};--edge:${Math.max(6,layout.gap/2)*renderScale}px;--shadow-y:${5*renderScale}px;--shadow-blur:${4*renderScale}px;'],
   ['radius:layout.radius,','radius:layout.radius*renderScale,']
  ])replace(desktop,a,b)
  replace(css,'padding:var(--top) max(6px,calc(var(--column-gap) / 2)) 0','padding:var(--top) var(--edge) 0')
  replace(css,'box-shadow:0 5px 4px rgb(0 0 0 / var(--shadow))','box-shadow:0 var(--shadow-y) var(--shadow-blur) rgb(0 0 0 / var(--shadow))')
 }
 if(variant==='layers')writeFileSync(css,readFileSync(css,'utf8')+'\n.preview-render .desktop-cover{will-change:transform}\n')
 if(variant==='active-layer')writeFileSync(css,readFileSync(css,'utf8')+'\n.preview-render .desktop-cover.enlarged{will-change:transform}\n')
 if(variant==='sample-layers')writeFileSync(css,readFileSync(css,'utf8')+'\n.preview-render:has(.desktop-cover.enlarged) .desktop-cover{will-change:transform}\n')
 if(variant==='defer-save'){
  replace(app,' let settingsRevision=0,settingsDirty=false',' let settingsRevision=0,settingsDirty=false\n let draggingAppearance=false\n function finishAppearanceDrag(){if(!draggingAppearance)return;draggingAppearance=false;if(settingsDirty)persist()}')
  replace(app,'  const snapshot=structuredClone(library.settings)','  if(draggingAppearance)return\n  const snapshot=structuredClone(library.settings)')
  replace(app,'function stopHoverPreview(){desktopPreview?.stopHoverPreview()}','function stopHoverPreview(){desktopPreview?.stopHoverPreview();finishAppearanceDrag()}')
  replace(app,"onpointerdown={(e)=>{if(!(e.target instanceof Element)","onpointerdown={(e)=>{if(e.button===0&&e.target instanceof HTMLInputElement&&e.target.type==='range'&&e.target.closest('.controls')){draggingAppearance=true;clearTimeout(saveTimer)};if(!(e.target instanceof Element)")
 }
 // Count actual hot-path executions, identically instrumented in every variant.
 const instrumentation='if((window as any).__previewMetrics)'
 for(const [file,needle,counter] of [
  [`${root}/src/lib/types.ts`,"{ return [...albums].sort(",'sorts'],
  [`${root}/src/lib/api.ts`,'{ return native ? convertFileSrc','coverUrls'],
  [`${root}/src/lib/motion.ts`,'function update(next:typeof options) {','motionUpdates']
 ]){
  const insertion=counter==='sorts'?`{ ${instrumentation}(window as any).__previewMetrics.sorts++; return [...albums].sort(`:counter==='coverUrls'?`{ ${instrumentation}(window as any).__previewMetrics.coverUrls++; return native ? convertFileSrc`:`function update(next:typeof options) {${instrumentation}(window as any).__previewMetrics.motionUpdates++;`
  replace(file,needle,insertion)
 }
}
