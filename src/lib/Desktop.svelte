<script lang="ts">
 import { onMount } from 'svelte'
 import { listen } from '@tauri-apps/api/event'
 import { coverUrl, native, openAlbum } from './api'
 import { swingScale } from './motion'
 import { ordered, type Layout, type Library } from './types'
 export let library: Library
 export let preview=false
 export let forcedLayout:Layout|undefined=undefined
 export let viewportHeight:number|undefined=undefined
 let width=window.innerWidth
 let hovered=''
 let grid:HTMLDivElement
 let error=''
 let lastPointer={x:0,y:0,visible:false}
 $: settings=library.settings
 $: layout=forcedLayout??(width>1900?settings.wideLayout:settings.layout)
 $: albums=ordered(library.albums.filter(a=>a.enabled),settings.sort,settings.shuffleSeed)
 function hoverAt(x:number,y:number,visible:boolean) {
  lastPointer={x,y,visible}
  if(!visible || !settings.hoverEnabled) {hovered='';return}
  // Use the unscaled grid cells so enlarged artwork does not shift the hit target.
  const items=grid?.querySelectorAll<HTMLElement>('.desktop-cell')??[]
  hovered=''
  for(const el of items) {const r=el.getBoundingClientRect();if(x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom){hovered=el.dataset.id??'';break}}
 }
 async function open(id:string) {try {if(!preview)await openAlbum(id)}catch(e){error=String(e);setTimeout(()=>error='',8000)}}
 onMount(()=>{let dispose=()=>{};let alive=true;if(native&&!preview) listen<{x:number;y:number;visible:boolean}>('desktop-pointer',e=>hoverAt(e.payload.x,e.payload.y,e.payload.visible)).then(fn=>{if(alive)dispose=fn;else fn()});return ()=>{alive=false;dispose()}})
</script>
<svelte:window bind:innerWidth={width}/>
<div class="desktop-surface" style:height={viewportHeight?`${viewportHeight}px`:undefined} onscroll={()=>hoverAt(lastPointer.x,lastPointer.y,lastPointer.visible)} onpointermove={(e)=>{if(!native||preview)hoverAt(e.clientX,e.clientY,true)}} onpointerleave={()=>{if(!native||preview)hovered=''}} role="presentation">
 <div class="desktop-grid" bind:this={grid} style={`--columns:${layout.columns};--gap:${layout.gap}px;--row-gap:${layout.rowGap}px;--top:${layout.top}px;--bottom:${layout.bottom}px;--radius:${layout.radius}px;--shadow:${layout.shadow};--scale:${settings.hoverScale};--opacity:${settings.opacity}`}>
 {#each albums as album (album.id)}
  <div class="desktop-cell" data-id={album.id}>
   <button use:swingScale={{active:hovered===album.id&&settings.hoverEnabled,factor:settings.hoverScale}} class:enlarged={hovered===album.id} class:dimmed={settings.dimOthers&&hovered!==''&&hovered!==album.id} class="desktop-cover" onclick={()=>open(album.id)} onfocus={()=>hovered=album.id} onblur={()=>hovered=''} aria-label={`Open ${album.title} by ${album.artist}`} title={`${album.artist} — ${album.title}`}><img src={coverUrl(album)} alt={album.title} draggable="false"/></button>
  </div>
 {/each}
 </div>
 {#if error}<div class="desktop-error" role="alert">{error}</div>{/if}
</div>
