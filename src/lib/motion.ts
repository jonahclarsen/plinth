// Keep jQuery swing easing; 1× uses the original 250/251 ms timing.
// Once enlarged, the cover breathes slowly around its hover size.
// Lay the box out at the largest size the current animation reaches, then animate with a
// scale() of at most 1. Upscaling lets WebKit stretch an already rasterized or subsampled
// cover (soft artwork); animating layout size snaps to whole pixels (jagged, stepped motion).
const breathPeriod=8000,breathDepth=.03 // Share of the enlargement, e.g. 2.1× ± 0.033.
const scales=new WeakMap<Element,number>()
// The painted scale of a cover, including breathing; 1 at rest.
export function scaleOf(node:Element|null){return node&&scales.get(node)||1}
export function swingScale(node: HTMLElement, options: {active:boolean;factor:number;speed:number;radius:number;roundedOnHover:boolean}) {
 let scale=1,box=1,radius=options.radius,frame=0,target=1,targetRadius=radius,speed=options.speed,laid=0
 function paint(){
  if(box!==laid){laid=box;const size=`${box*100}%`,offset=`${(1-box)*50}%`;Object.assign(node.style,{left:offset,top:offset,width:size,height:size})}
  // Counter the transform so corners keep their painted radius.
  const shrink=scale/box;node.style.transform=shrink<1?`scale(${shrink})`:'';node.style.borderRadius=`${radius/shrink}px`;scales.set(node,scale)
 }
 paint()
 function update(next:typeof options) {
  const end=next.active?next.factor:1,endRadius=next.active&&!next.roundedOnHover?0:next.radius
  if(end===target&&endRadius===targetRadius&&speed===next.speed)return
  target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)
  const start=scale,startRadius=radius,started=performance.now(),duration=(next.active?250:251)/next.speed
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){scale=box=end;radius=endRadius;paint();return}
  box=Math.max(start,end)
  function tick(now:number){const p=Math.min(1,(now-started)/duration),eased=.5-Math.cos(Math.PI*p)/2;scale=start+(end-start)*eased;radius=startRadius+(endRadius-startRadius)*eased;paint();if(p<1)frame=requestAnimationFrame(tick);else if(end>1){since=now;box=end+(end-1)*breathDepth;frame=requestAnimationFrame(breathe)}else{box=end;paint()}}
  // Starts at the swing's end value, so the swing hands over without a jump.
  function breathe(now:number){scale=end+(end-1)*breathDepth*Math.sin(2*Math.PI*(now-since)/breathPeriod);paint();frame=requestAnimationFrame(breathe)}
  let since=0
  frame=requestAnimationFrame(tick)
 }
 update(options)
 return {update,destroy(){cancelAnimationFrame(frame)}}
}
