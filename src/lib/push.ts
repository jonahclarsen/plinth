import { scaleOf } from './motion'
// Motion around the hovered cover. Neighbors are pushed away from it in proportion to its
// current (breathing) enlargement, fading with distance from the pointer; the hovered cover
// itself drifts slightly away from the pointer. Pointer moves only recompute per-cell weights;
// one frame loop writes compositor-only transforms to the cells within reach (promoted while
// moving, released at rest).
export type Cell={id:string;el:HTMLElement;rect:DOMRect}
// Offsets are renderer pixels: push = (kx,ky) × current strength, plus fixed drift (fx,fy).
type Offset={x:number;y:number;kx:number;ky:number;fx:number;fy:number}
const reach=2.6 // Cover widths from the pointer at which the push fades out.
const pushShare=.4 // Largest push as a share of the enlargement's overhang.
const drift=.12 // Hovered cover moves this share of the pointer's offset from its center.
export function neighborPush(){
 const moving=new Map<HTMLElement,Offset>()
 let frame=0,last=0,tau=70,cover=0,push=true,home:HTMLElement|undefined
 function strength(){return home&&push?cover*Math.max(0,scaleOf(home.firstElementChild)-1)*pushShare:0}
 function entry(el:HTMLElement){
  let o=moving.get(el)
  if(!o){o={x:0,y:0,kx:0,ky:0,fx:0,fy:0};moving.set(el,o);el.style.willChange='transform'}
  return o
 }
 function tick(now:number){
  const k=tau?1-Math.exp(-Math.min(64,now-last)/tau):1,s=strength()
  // The swing and breathing change the strength every frame; keep running while hovered.
  let busy=!!home&&push&&tau>0
  last=now;frame=0
  for(const [el,o] of moving){
   const tx=o.kx*s+o.fx,ty=o.ky*s+o.fy
   if(o.x!==tx||o.y!==ty){
    o.x+=(tx-o.x)*k;o.y+=(ty-o.y)*k
    if(Math.abs(tx-o.x)<.05&&Math.abs(ty-o.y)<.05){o.x=tx;o.y=ty}else busy=true
    el.style.transform=`translate3d(${o.x}px,${o.y}px,0)`
   }
   if(!o.x&&!o.y&&!tx&&!ty){moving.delete(el);el.style.transform='';el.style.willChange=''}
  }
  if(busy)frame=requestAnimationFrame(tick)
 }
 // `cover` is the resting cover size in renderer pixels; rects are viewport pixels.
 function update(measure:()=>Cell[],hovered:string,point:{x:number;y:number}|undefined,options:{cover:number;push:boolean;speed:number}){
  tau=matchMedia('(prefers-reduced-motion: reduce)').matches?0:70/options.speed
  cover=options.cover;push=options.push;home=undefined
  for(const o of moving.values()){o.kx=o.ky=o.fx=o.fy=0}
  const cells=hovered?measure():[],center=cells.find(c=>c.id===hovered)
  if(center){
   home=center.el
   const r=center.rect,hx=r.left+r.width/2,hy=r.top+r.height/2,px=point?.x??hx,py=point?.y??hy,unit=cover/(r.width||1),half=r.width/2
   const self=entry(center.el),clamp=(v:number)=>Math.max(-half,Math.min(half,v))
   self.fx=-clamp(px-hx)*unit*drift;self.fy=-clamp(py-hy)*unit*drift
   if(push){
    const limit=r.width*reach
    for(const c of cells){
     if(c===center)continue
     const x=c.rect.left+c.rect.width/2,y=c.rect.top+c.rect.height/2
     if(Math.abs(x-px)>=limit||Math.abs(y-py)>=limit)continue
     const f=1-Math.hypot(x-px,y-py)/limit
     if(f<=0)continue
     const dx=x-hx,dy=y-hy,w=f*f*(3-2*f)/(Math.hypot(dx,dy)||1),o=entry(c.el)
     o.kx=dx*w;o.ky=dy*w
    }
   }
  }
  if(!frame&&moving.size){last=performance.now();frame=requestAnimationFrame(tick)}
 }
 function offset(el:HTMLElement){const o=moving.get(el);return o?{x:o.x,y:o.y}:{x:0,y:0}}
 function destroy(){cancelAnimationFrame(frame);for(const [el,o] of moving){moving.delete(el);el.style.transform='';el.style.willChange='';o.x=o.y=0}}
 return {update,offset,destroy}
}
