<script lang="ts">
 import { onMount } from 'svelte'
 import { invoke } from '@tauri-apps/api/core'
 import type { DetectedDisplay } from './displays'
 import { desktopCoverSize, desktopSpacing } from './spacing'
 import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
 import { coverUrl, native, openAlbum } from './api'
 import { swingScale } from './motion'
 import { neighborPush, type Cell } from './push'
 import { ordered, shuffleSeed, today, type Layout, type Library } from './types'
 export let library: Library
 export let preview=false
 export let previewScale=1
 export let forcedLayout:Layout|undefined=undefined
 export let viewportHeight:number|undefined=undefined
 export let viewportWidth:number|undefined=undefined
 export let menuBarHeight=0
 let detectedMenuBarHeight=0
 let displayProfile:'layout'|'wideLayout'|undefined
 let width=window.innerWidth
 let height=window.innerHeight
 let hovered=''
 let sample=''
 let foregroundAllowed=false
 $: activeHover=preview&&sample?sample:(settings.hoverEnabled&&(preview||!native||settings.hoverInBackground!==false||foregroundAllowed)?hovered:'')
 let grid:HTMLDivElement
 let error=''
 $: settings=library.settings
 $: layout=forcedLayout??(displayProfile?settings[displayProfile]:width>1900?settings.wideLayout:settings.layout)
 $: albums=ordered(library.albums.filter(a=>a.enabled),settings.sort,shuffleSeed(settings,$today))
 $: spacing=desktopSpacing(layout,viewportWidth??width,viewportHeight??height,albums.length,preview?menuBarHeight:detectedMenuBarHeight)
 let bounds:Cell[]|undefined
 function invalidateBounds(){bounds=undefined}
 const push=neighborPush()
 // Measure resting cells: remove any push offset (renderer pixels) and squeeze in viewport scale.
 function cells(){return bounds??=Array.from(grid?.querySelectorAll<HTMLElement>('.desktop-cell')??[],el=>{const r=el.getBoundingClientRect(),o=push.offset(el),w=r.width/o.k,h=r.height/o.k,s=w/(el.offsetWidth||1),x=r.left+r.width/2-o.x*s,y=r.top+r.height/2-o.y*s;return {id:el.dataset.id??'',el,rect:new DOMRect(x-w/2,y-h/2,w,h)}})}
 // The desktop's edges in viewport pixels: the surface below the menu bar.
 function edges(){const surface=grid.parentElement!,r=surface.getBoundingClientRect(),menu=(preview?menuBarHeight:detectedMenuBarHeight)*r.width/(surface.offsetWidth||1);return {left:r.left,top:r.top+menu,right:r.right,bottom:r.bottom}}
 let pointer:{x:number;y:number}|undefined
 $: coverSize=desktopCoverSize(layout,viewportWidth??width)
 $: if(grid)push.update(cells,activeHover,activeHover===hovered?pointer:undefined,{cover:coverSize,push:settings.pushNeighbors!==false,speed:settings.hoverSpeed??1,edges})
 // Rectangles use viewport coordinates, including the scaled preview and scrolling.
 $: { spacing; albums; width; height; viewportWidth; viewportHeight; previewScale; invalidateBounds() }
 onMount(()=>{
  const observer=new ResizeObserver(invalidateBounds)
  observer.observe(grid)
  window.addEventListener('scroll',invalidateBounds,true)
  return()=>{observer.disconnect();window.removeEventListener('scroll',invalidateBounds,true);push.destroy()}
 })
 function hoverAt(x:number,y:number,visible:boolean) {
  const id=albumAt(x,y)
  if(native&&!preview&&visible) {
   // WKWebView ignores CSS cursor updates in our nonactivating desktop windows.
   // Point over any album's hit area, or the painted overhang of an enlarged cover.
   const pointing=!!id||!!document.elementFromPoint(x,y)?.closest('button.desktop-cover')
   void invoke('set_desktop_cursor',{x,y,pointing}).catch(error=>console.error('Desktop cursor:',error))
  }
  if(!visible || !settings.hoverEnabled) {hovered='';return}
  // Use the unscaled grid cells so enlarged artwork does not shift the hit target.
  hovered=id;pointer={x,y}
 }
 // Inside the artwork's extent every point belongs to the nearest resting cover, so hit
 // areas meet halfway across each gap and leave no dead zone between albums.
 function albumAt(x:number,y:number) {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,nearest='',best=Infinity
  for(const {id,rect:r} of cells()) {
   left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom)
   const d=(x-r.left-r.width/2)**2+(y-r.top-r.height/2)**2
   if(d<best){best=d;nearest=id}
  }
  return x>=left&&x<right&&y>=top&&y<bottom?nearest:''
 }
 function clicked(e:MouseEvent) {
  const target=(e.target as HTMLElement).closest<HTMLElement>('button.desktop-cover')
  // Keyboard activation has no pointer position; use the focused cover.
  const id=e.detail===0?target?.parentElement?.dataset.id:albumAt(e.clientX,e.clientY)||target?.parentElement?.dataset.id
  if(id)void open(id)
 }
 export function startHoverPreview() {
  if(!preview||!grid)return
  const surface=grid.parentElement!.getBoundingClientRect()
  const cells=Array.from(grid.querySelectorAll<HTMLElement>('.desktop-cell'))
  const visible=cells.filter(el=>{const r=el.getBoundingClientRect();return r.left>=surface.left&&r.right<=surface.right&&r.top>=surface.top&&r.bottom<=surface.bottom})
  // Prefer artwork with room for the slider's maximum enlargement.
  const roomy=visible.filter(el=>{const r=el.getBoundingClientRect();return r.left-r.width>=surface.left&&r.right+r.width<=surface.right&&r.top-r.height>=surface.top&&r.bottom+r.height<=surface.bottom})
  const intersecting=cells.filter(el=>{const r=el.getBoundingClientRect();return r.right>surface.left&&r.left<surface.right&&r.bottom>surface.top&&r.top<surface.bottom})
  const candidates=roomy.length?roomy:visible.length?visible:intersecting
  sample=candidates[Math.floor(Math.random()*candidates.length)]?.dataset.id??''
 }
 export function stopHoverPreview() {sample=''}
 async function open(id:string) {try {if(!preview)await openAlbum(id)}catch(e){error=String(e);setTimeout(()=>error='',8000)}}
 onMount(()=>{if(native&&!preview)void invoke<DetectedDisplay[]>('get_displays').then(displays=>{const current=displays.find(display=>display.current);detectedMenuBarHeight=current?.menuBarHeight??0;if(current)displayProfile=current.builtIn?'layout':'wideLayout'}).catch(()=>{});let dispose=()=>{};let alive=true;if(native&&!preview) getCurrentWebviewWindow().listen<{x:number;y:number;visible:boolean;foregroundAllowed:boolean}>('desktop-pointer',e=>{foregroundAllowed=e.payload.foregroundAllowed;hoverAt(e.payload.x,e.payload.y,e.payload.visible)}).then(fn=>{if(alive)dispose=fn;else fn()});return ()=>{alive=false;dispose()}})
</script>
<svelte:window bind:innerWidth={width} bind:innerHeight={height}/>
<div class="desktop-surface" style:height={viewportHeight?`${viewportHeight}px`:undefined} onpointermove={(e)=>{if(!native||preview)hoverAt(e.clientX,e.clientY,true)}} onpointerleave={()=>{if(!native||preview)hovered=''}} onclick={(e)=>{if(!preview)clicked(e)}} role="presentation">
 <div class="desktop-grid" bind:this={grid} style={`--columns:${layout.columns};--cover-size:${desktopCoverSize(layout,viewportWidth??width)}px;--column-gap:${layout.gap}px;--row-gap:${spacing.rowGap}px;--top:${spacing.top}px;--radius:${layout.radius}px;--shadow:${layout.shadow};--scale:${settings.hoverScale}`}>
 {#each albums as album (album.id)}
  <div class="desktop-cell" data-id={album.id}>
   {#if preview}
   <div use:swingScale={{active:activeHover===album.id,factor:settings.hoverScale,speed:settings.hoverSpeed??1,radius:layout.radius,roundedOnHover:layout.roundedOnHover??false}} class:enlarged={activeHover===album.id} class="desktop-cover" role="img" aria-label={`Preview ${album.title} by ${album.artist}`}></div>
   {:else}
   <button use:swingScale={{active:activeHover===album.id,factor:settings.hoverScale,speed:settings.hoverSpeed??1,radius:layout.radius,roundedOnHover:layout.roundedOnHover??false}} class:enlarged={activeHover===album.id} class="desktop-cover" onfocus={()=>hovered=album.id} onblur={()=>hovered=''} aria-label={`Open ${album.title} by ${album.artist}`} title={`${album.artist} — ${album.title}`}><img src={coverUrl(album)} alt={album.title} draggable="false"/></button>
   {/if}
  </div>
 {/each}
 </div>
 {#if error}<div class="desktop-error" role="alert">{error}</div>{/if}
</div>
