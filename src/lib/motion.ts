// Keep jQuery swing easing; 1× uses the original 250/251 ms timing.
export function swingScale(node: HTMLElement, options: {active:boolean;factor:number;speed:number;radius:number}) {
 let scale=1,radius=options.radius,frame=0,target=1,targetRadius=radius,speed=options.speed
 function paint(){node.style.transform=`scale(${scale})`;node.style.borderRadius=`${radius}px`}
 paint()
 function update(next:typeof options) {
  const end=next.active?next.factor:1,endRadius=next.active?0:next.radius
  if(end===target&&endRadius===targetRadius&&speed===next.speed)return
  target=end;targetRadius=endRadius;speed=next.speed;cancelAnimationFrame(frame)
  const start=scale,startRadius=radius,started=performance.now(),duration=(next.active?250:251)/next.speed
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){scale=end;radius=endRadius;paint();return}
  function tick(now:number){const p=Math.min(1,(now-started)/duration),eased=.5-Math.cos(Math.PI*p)/2;scale=start+(end-start)*eased;radius=startRadius+(endRadius-startRadius)*eased;paint();if(p<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick)
 }
 update(options)
 return {update,destroy(){cancelAnimationFrame(frame)}}
}
