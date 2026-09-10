// Matches jQuery's original swing easing and 250/251 ms hover durations.
export function swingScale(node: HTMLElement, options: {active:boolean;factor:number}) {
 let scale=1,frame=0,target=1
 function update(next:typeof options) {
  const end=next.active?next.factor:1
  if(end===target)return
  target=end;cancelAnimationFrame(frame)
  const start=scale,started=performance.now(),duration=next.active?250:251
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){scale=end;node.style.transform=`scale(${scale})`;return}
  function tick(now:number){const p=Math.min(1,(now-started)/duration);scale=start+(end-start)*(.5-Math.cos(Math.PI*p)/2);node.style.transform=`scale(${scale})`;if(p<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick)
 }
 update(options)
 return {update,destroy(){cancelAnimationFrame(frame)}}
}
