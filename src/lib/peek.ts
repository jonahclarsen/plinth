import { coverThumbnail, coverUrl } from './api'
import type { Album } from './types'

// Release-chart artwork peek: a column of small covers that scrolls with the pointer.
export const peekStride=64,peekSlots=4,peekHeight=256
const coverSize=54,overscan=2,thumbSize=128

// Full covers are up to 1200 px; decoding them while the column scrolls freezes it and leaves
// blank covers. Small copies are made natively, a few at a time, and kept for the session.
const thumbs=new Map<string,string>(),pending=new Map<string,Album>(),waiting=new Map<string,Set<(src:string)=>void>>()
let running=0
function pump(){
 while(running<3&&pending.size){
  const [cover,album]=pending.entries().next().value!;pending.delete(cover);running++
  coverThumbnail(album,thumbSize).catch(()=>coverUrl(album)).then(src=>{
   thumbs.set(cover,src);for(const done of waiting.get(cover)??[])done(src);waiting.delete(cover);running--;pump()
  })
 }
}
// Urgent requests jump ahead of background work, in the order given.
export function requestThumbnails(albums:Album[],urgent=false){
 const fresh=albums.filter(album=>album.cover&&!thumbs.has(album.cover))
 if(urgent){const rest=[...pending].filter(([cover])=>!fresh.some(album=>album.cover===cover));pending.clear();for(const album of fresh)pending.set(album.cover,album);for(const [cover,album] of rest)pending.set(cover,album)}
 else for(const album of fresh)if(!pending.has(album.cover))pending.set(album.cover,album)
 pump()
}
export function cancelThumbnails(){pending.clear()}
export function thumbnail(img:HTMLImageElement,album:Album){
 let current=''
 function update(next:Album){
  current=next.cover
  const ready=thumbs.get(next.cover)
  if(ready){img.src=ready;img.classList.add('ready');return}
  img.classList.remove('ready');img.removeAttribute('src')
  const done=(src:string)=>{if(current===next.cover){img.src=src;img.decode().catch(()=>{}).then(()=>img.classList.add('ready'))}}
  waiting.set(next.cover,(waiting.get(next.cover)??new Set()).add(done));requestThumbnails([next],true)
 }
 update(album)
 return {update,destroy(){current=''}}
}

const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
// The track's offset when the pointer is at the bottom of the column (progress 0) or the top
// (progress 1). Albums run first to last from top to bottom and rest against the bottom edge.
export function trackOffset(count:number,progress:number){return (peekSlots-count)*peekStride+progress*Math.max(0,count-peekSlots)*peekStride}
// Eases the track toward the pointer with one compositor transform, and reports which covers
// (with a little overscan) need to exist, so covers mount out of view and never pop.
export function peekScroll(track:HTMLElement,options:{key:string;count:number;progress:number;onrange:(first:number,last:number)=>void}){
 let offset=0,target=0,key='',range='',frame=0,last=0
 function place(){
  track.style.transform=`translate3d(0,${offset}px,0)`
  const first=Math.max(0,Math.floor((-offset-coverSize)/peekStride)-overscan),end=Math.min(options.count-1,Math.ceil((peekHeight-offset)/peekStride)+overscan)
  if(`${options.key}:${first}:${end}`!==range){range=`${options.key}:${first}:${end}`;options.onrange(first,end)}
 }
 function tick(now:number){
  // Frame-rate independent exponential approach (about 70 ms to close two thirds of the gap).
  offset+=(target-offset)*(1-Math.exp(-Math.min(64,now-last)/70));last=now
  if(Math.abs(target-offset)<.05)offset=target
  place();frame=offset===target?0:requestAnimationFrame(tick)
 }
 function update(next:typeof options){
  options=next;target=trackOffset(next.count,next.progress)
  if(next.key!==key||reduced()){key=next.key;offset=target;cancelAnimationFrame(frame);frame=0;place();return}
  if(!frame&&offset!==target){last=performance.now();frame=requestAnimationFrame(tick)}
 }
 update(options)
 return {update,destroy(){cancelAnimationFrame(frame)}}
}

// Each cover drifts, sways and breathes on its own unrelated loops: three layers, each with a
// seeded duration and a smooth closed path made of random harmonics, so no two covers move alike
// and none simply rocks back and forth. Web Animations keep it on the compositor.
function seeded(text:string){
 let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)
 return ()=>{h=Math.imul(h^h>>>15,h|1);h^=h+Math.imul(h^h>>>7,h|61);return((h^h>>>14)>>>0)/4294967296}
}
const samples=36
function wander(random:()=>number){
 const waves=[{k:1,weight:1},{k:2,weight:.25+random()*.35},{k:3,weight:.08+random()*.22}].map(wave=>({...wave,phase:random()*Math.PI*2}))
 const path=Array.from({length:samples+1},(_,i)=>waves.reduce((sum,{k,weight,phase})=>sum+weight*Math.sin(k*Math.PI*2*i/samples+phase),0))
 const peak=Math.max(...path.map(Math.abs));return path.map(value=>value/peak)
}
export function breathe(cover:HTMLElement,id:string){
 if(reduced())return
 const random=seeded(id),sway=cover.firstElementChild as HTMLElement,img=sway.firstElementChild as HTMLElement
 const loop=(node:HTMLElement,seconds:[number,number],frames:(i:number)=>string)=>{
  const duration=(seconds[0]+random()*(seconds[1]-seconds[0]))*1000
  const animation=node.animate(Array.from({length:samples+1},(_,i)=>({transform:frames(i)})),{duration,iterations:Infinity,easing:'linear'})
  animation.currentTime=random()*duration;return animation
 }
 const x=wander(random),y=wander(random),turn=wander(random),size=wander(random)
 const animations=[
  loop(cover,[9,13],i=>`translate(${(x[i]*.6).toFixed(3)}px,${(y[i]*.4).toFixed(3)}px)`),
  loop(sway,[7,10.5],i=>`rotate(${(turn[i]*.64).toFixed(3)}deg)`),
  loop(img,[6.5,9.5],i=>`scale(${(1+size[i]*.015).toFixed(4)})`),
 ]
 return {destroy(){for(const animation of animations)animation.cancel()}}
}
