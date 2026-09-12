// Only run in a disposable CI checkout: never changes the shipping application.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const variant=process.argv[2]
const files=['src/lib/motion.ts','src/lib/Desktop.svelte','src-tauri/src/history.rs']
for(const file of files)writeFileSync(file,execFileSync('git',['show',`HEAD:${file}`]))
function replace(file,before,after){const text=readFileSync(file,'utf8');if(!text.includes(before))throw Error(`Patch no longer applies: ${file}`);writeFileSync(file,text.replace(before,after))}
if(variant==='radius')replace(files[0],
 'target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)',
 `target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)
  // Layout radius updates need no animation on resting covers; actual hover still swings.
  if(!next.active&&scale===1){radius=endRadius;paint();return}`)
if(['radius-css','combined','combined-fit'].includes(variant)){
 replace(files[0],'node.style.borderRadius=`${radius}px`',"node.style.borderRadius=scale===1&&target===1?'':`${radius}px`")
 replace(files[0],
 'target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)',
 `target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)
  // Resting covers inherit the one grid CSS variable; only hover writes inline radius.
  if(!next.active&&scale===1){radius=endRadius;if(node.style.borderRadius)node.style.borderRadius='';return}`)
}
if(['cull','combined'].includes(variant)){
 replace(files[1],' function hoverAt(x:number,y:number,visible:boolean) {',` // Keep full album count for Auto spacing; render visible rows plus two rows for hover/shadow overflow.
 $: coverSize=Math.max(0,((viewportWidth??width)-2*Math.max(6,layout.gap/2)-(layout.columns-1)*layout.gap)/layout.columns)
 $: visibleCount=Math.max(0,Math.ceil(((viewportHeight??height)-spacing.top)/Math.max(1,coverSize+spacing.rowGap))+2)*layout.columns
 $: renderedAlbums=albums.slice(0,visibleCount)
 function hoverAt(x:number,y:number,visible:boolean) {`)
 replace(files[1],'{#each albums as album (album.id)}','{#each renderedAlbums as album (album.id)}')
}
if(['pointer','combined','combined-fit'].includes(variant)){
 replace(files[1],"import { onMount } from 'svelte'","import { onMount } from 'svelte'")
 replace(files[1]," function hoverAt(x:number,y:number,visible:boolean) {",` let bounds:{id:string;rect:DOMRect}[]|undefined
 function invalidateBounds(){bounds=undefined}
 $: { spacing; albums; width; height; viewportWidth; viewportHeight; invalidateBounds() }
 onMount(()=>{const observer=new ResizeObserver(invalidateBounds);observer.observe(grid);window.addEventListener('scroll',invalidateBounds,true);return()=>{observer.disconnect();window.removeEventListener('scroll',invalidateBounds,true)}})
 function hoverAt(x:number,y:number,visible:boolean) {`)
 replace(files[1],`const items=grid?.querySelectorAll<HTMLElement>('.desktop-cell')??[]
  hovered=''
  for(const el of items) {const r=el.getBoundingClientRect();if(x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom){hovered=el.dataset.id??'';break}}`,
 `bounds??=Array.from(grid?.querySelectorAll<HTMLElement>('.desktop-cell')??[],el=>({id:el.dataset.id??'',rect:el.getBoundingClientRect()}))
  hovered=''
  for(const {id,rect:r} of bounds) {if(x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom){hovered=id;break}}`)
}
if(variant==='compact')replace(files[2],'serde_json::to_vec_pretty(document)','serde_json::to_vec(document)')
if(variant==='indexed'){
 replace(files[2],'    for album in &after.albums {',`    let old_by_id: std::collections::HashMap<_, _> = before.albums.iter().map(|a| (&a.id, a)).collect();
    let new_ids: std::collections::HashSet<_> = after.albums.iter().map(|a| &a.id).collect();
    for album in &after.albums {`)
 replace(files[2],'before.albums.iter().find(|old| old.id == album.id)','old_by_id.get(&album.id)')
 replace(files[2],'!after.albums.iter().any(|next| next.id == album.id)','!new_ids.contains(&album.id)')
}
