<script lang="ts">
 import { onMount } from 'svelte'
 import { invoke } from '@tauri-apps/api/core'
 import type { DetectedDisplay } from './displays'
 import { desktopCoverSize, desktopSpacing } from './spacing'
 import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
 import { coverUrl, native, openAlbum } from './api'
 import { swingScale } from './motion'
 import { ordered, type Layout, type Library } from './types'
 export let library: Library
 export let preview=false
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
 $: albums=ordered(library.albums.filter(a=>a.enabled),settings.sort,settings.shuffleSeed)
 $: spacing=desktopSpacing(layout,viewportWidth??width,viewportHeight??height,albums.length,preview?menuBarHeight:detectedMenuBarHeight)
 function hoverAt(x:number,y:number,visible:boolean) {
  if(!visible || !settings.hoverEnabled) {hovered='';return}
  // Use the unscaled grid cells so enlarged artwork does not shift the hit target.
  const items=grid?.querySelectorAll<HTMLElement>('.desktop-cell')??[]
  hovered=''
  for(const el of items) {const r=el.getBoundingClientRect();if(x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom){hovered=el.dataset.id??'';break}}
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
<div class="desktop-surface" style:height={viewportHeight?`${viewportHeight}px`:undefined} onpointermove={(e)=>{if(!native||preview)hoverAt(e.clientX,e.clientY,true)}} onpointerleave={()=>{if(!native||preview)hovered=''}} role="presentation">
 <div class="desktop-grid" bind:this={grid} style={`--columns:${layout.columns};--cover-size:${desktopCoverSize(layout,viewportWidth??width)}px;--gap:${layout.gap}px;--row-gap:${spacing.rowGap}px;--top:${spacing.top}px;--radius:${layout.radius}px;--shadow:${layout.shadow};--scale:${settings.hoverScale}`}>
 {#each albums as album (album.id)}
  <div class="desktop-cell" data-id={album.id}>
   <button use:swingScale={{active:activeHover===album.id,factor:settings.hoverScale,speed:settings.hoverSpeed??1,radius:layout.radius,roundedOnHover:layout.roundedOnHover??false}} class:enlarged={activeHover===album.id} class="desktop-cover" onclick={()=>open(album.id)} onfocus={()=>hovered=album.id} onblur={()=>hovered=''} aria-label={`Open ${album.title} by ${album.artist}`} title={`${album.artist} — ${album.title}`}><img src={coverUrl(album)} alt={album.title} draggable="false"/></button>
  </div>
 {/each}
 </div>
 {#if error}<div class="desktop-error" role="alert">{error}</div>{/if}
</div>
