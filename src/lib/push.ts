// Nudge covers near the hovered one away from it, less the farther they sit from the pointer.
// Pointer moves only recompute targets; DOM writes happen once per frame, touch only covers
// within reach, and use compositor-only transforms (promoted while moving, released at rest).
export type Cell={id:string;el:HTMLElement;rect:DOMRect}
type Offset={x:number;y:number;tx:number;ty:number}
const reach=2.6 // Cover widths from the pointer at which the push fades out.
export function neighborPush(){
 const moving=new Map<HTMLElement,Offset>()
 let frame=0,last=0,tau=70
 function paint(el:HTMLElement,o:Offset){
  if(o.x||o.y){el.style.transform=`translate3d(${o.x}px,${o.y}px,0)`;return}
  moving.delete(el);el.style.transform='';el.style.willChange=''
 }
 function tick(now:number){
  const k=tau?1-Math.exp(-Math.min(64,now-last)/tau):1
  last=now;frame=0
  for(const [el,o] of moving){
   if(o.x===o.tx&&o.y===o.ty){if(!o.x&&!o.y)paint(el,o);continue}
   o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k
   if(Math.abs(o.tx-o.x)<.05&&Math.abs(o.ty-o.y)<.05){o.x=o.tx;o.y=o.ty}
   paint(el,o)
   if(o.x!==o.tx||o.y!==o.ty)frame||=requestAnimationFrame(tick)
  }
 }
 // `strength` is the largest offset in the renderer's own pixels; rects are viewport pixels.
 function update(measure:()=>Cell[],hovered:string,point:{x:number;y:number}|undefined,strength:number,speed:number){
  tau=matchMedia('(prefers-reduced-motion: reduce)').matches?0:70/speed
  for(const o of moving.values()){o.tx=0;o.ty=0}
  const cells=hovered&&strength>0?measure():[],home=cells.find(c=>c.id===hovered)
  if(home){
   const r=home.rect,hx=r.left+r.width/2,hy=r.top+r.height/2,px=point?.x??hx,py=point?.y??hy,limit=r.width*reach
   for(const c of cells){
    if(c===home)continue
    const x=c.rect.left+c.rect.width/2,y=c.rect.top+c.rect.height/2
    if(Math.abs(x-px)>=limit||Math.abs(y-py)>=limit)continue
    const f=1-Math.hypot(x-px,y-py)/limit
    if(f<=0)continue
    const dx=x-hx,dy=y-hy,m=strength*f*f*(3-2*f)/(Math.hypot(dx,dy)||1)
    let o=moving.get(c.el)
    if(!o){o={x:0,y:0,tx:0,ty:0};moving.set(c.el,o);c.el.style.willChange='transform'}
    o.tx=dx*m;o.ty=dy*m
   }
  }
  if(!frame&&moving.size){last=performance.now();frame=requestAnimationFrame(tick)}
 }
 function offset(el:HTMLElement){const o=moving.get(el);return o?{x:o.x,y:o.y}:{x:0,y:0}}
 function destroy(){cancelAnimationFrame(frame);for(const [el,o] of moving){o.x=o.y=0;paint(el,o)}}
 return {update,offset,destroy}
}
