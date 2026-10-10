import { scaleOf, scaled } from './motion'
// Motion around the hovered cover. Neighbors are pushed away from it in proportion to its
// current (breathing) enlargement, fading with distance from the pointer; the hovered cover
// itself drifts slightly away from the pointer. Pointer moves only recompute per-cell weights;
// one frame loop writes compositor-only transforms to the cells within reach (promoted while
// moving, released at rest). Nothing crosses the desktop's edges: covers there, enlargement
// included, stop against them.
export type Cell={id:string;el:HTMLElement;rect:DOMRect}
export type Edges={left:number;top:number;right:number;bottom:number}
// Offsets are renderer pixels: push = (kx,ky) × current strength, plus fixed drift (fx,fy).
// (l,t,r,b) is the room between the resting cell and the edges; (px,py) is the painted,
// edge-bound offset.
type Offset={x:number;y:number;kx:number;ky:number;fx:number;fy:number;px:number;py:number;l:number;t:number;r:number;b:number}
const reach=2.6 // Cover widths from the pointer at which the push fades out.
const pushShare=.4 // Largest push as a share of the enlargement's overhang.
const drift=.12 // Hovered cover moves this share of the pointer's offset from its center.
const within=(v:number,lo:number,hi:number)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v))
export function neighborPush(){
 const moving=new Map<HTMLElement,Offset>()
 let frame=0,last=0,tau=70,cover=0,push=true,home:HTMLElement|undefined
 function strength(){return home&&push?cover*Math.max(0,scaleOf(home.firstElementChild)-1)*pushShare:0}
 function entry(el:HTMLElement){
  let o=moving.get(el)
  if(!o){o={x:0,y:0,kx:0,ky:0,fx:0,fy:0,px:0,py:0,l:0,t:0,r:0,b:0};moving.set(el,o);el.style.willChange='transform'}
  return o
 }
 // Paint the offset with the cover, enlargement included, held inside the edges. Covers place
 // themselves as they scale, so the edge never lags the enlargement by a frame.
 function place(el:HTMLElement,o:Offset){
  let g=cover*(scaleOf(el.firstElementChild)-1)/2
  if(g<.05)g=0
  const x=within(o.x,o.l+g,o.r-g),y=within(o.y,o.t+g,o.b-g)
  if(o.px!==x||o.py!==y){o.px=x;o.py=y;el.style.transform=`translate3d(${x}px,${y}px,0)`}
  return g
 }
 const follow=(node:Element)=>{const el=node.parentElement,o=el&&moving.get(el);if(o)place(el,o)}
 scaled.add(follow)
 // Room to the edges in renderer pixels; a cell already past an edge may stay where it rests.
 function room(o:Offset,r:DOMRect,edges:Edges,unit:number){
  o.l=Math.min(0,(edges.left-r.left)*unit);o.t=Math.min(0,(edges.top-r.top)*unit)
  o.r=Math.max(0,(edges.right-r.right)*unit);o.b=Math.max(0,(edges.bottom-r.bottom)*unit)
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
   }
   // A cover still shrinking keeps the loop until it can be released.
   if(place(el,o)&&tau)busy=true
   if(!o.px&&!o.py&&!o.x&&!o.y&&!tx&&!ty){moving.delete(el);el.style.transform='';el.style.willChange=''}
  }
  if(busy)frame=requestAnimationFrame(tick)
 }
 // `cover` is the resting cover size in renderer pixels; rects and edges are viewport pixels.
 function update(measure:()=>Cell[],hovered:string,point:{x:number;y:number}|undefined,options:{cover:number;push:boolean;speed:number;edges:()=>Edges}){
  tau=matchMedia('(prefers-reduced-motion: reduce)').matches?0:70/options.speed
  cover=options.cover;push=options.push;home=undefined
  for(const o of moving.values()){o.kx=o.ky=o.fx=o.fy=0}
  const cells=hovered?measure():[],center=cells.find(c=>c.id===hovered)
  if(center){
   home=center.el
   const r=center.rect,hx=r.left+r.width/2,hy=r.top+r.height/2,px=point?.x??hx,py=point?.y??hy,unit=cover/(r.width||1),half=r.width/2
   const edges=options.edges(),self=entry(center.el),clamp=(v:number)=>Math.max(-half,Math.min(half,v))
   room(self,r,edges,unit)
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
     o.kx=dx*w;o.ky=dy*w;room(o,c.rect,edges,unit)
    }
   }
  }
  if(!frame&&moving.size){last=performance.now();frame=requestAnimationFrame(tick)}
 }
 function offset(el:HTMLElement){const o=moving.get(el);return o?{x:o.px,y:o.py}:{x:0,y:0}}
 function destroy(){scaled.delete(follow);cancelAnimationFrame(frame);for(const [el,o] of moving){moving.delete(el);el.style.transform='';el.style.willChange='';o.x=o.y=o.px=o.py=0}}
 return {update,offset,destroy}
}
