export type DisplayProfile = 'layout' | 'wideLayout'
export interface DetectedDisplay {
 id:number; width:number; height:number; logicalWidth:number; logicalHeight:number
 menuBarHeight?:number; builtIn:boolean; current:boolean; remembered:boolean
}
export function previewDisplays(displays:DetectedDisplay[]) {
 const current=displays.find(d=>d.current&&!d.remembered)
 const internal=displays.find(d=>d.builtIn)
 const external=(current&&!current.builtIn?current:undefined)??displays.find(d=>!d.builtIn)
 function screen(display:DetectedDisplay|undefined,width:number,height:number) {
  return display?{width:display.logicalWidth,height:display.logicalHeight,menuBarHeight:display.menuBarHeight??0,pixels:`${display.width} × ${display.height}${display.remembered?' (last detected)':''}`}:{width,height,menuBarHeight:0,pixels:'Not detected'}
 }
 return {screens:{layout:screen(internal,1280,800),wideLayout:screen(external,1920,1080)},currentId:current?.id,profile:current?(current.builtIn?'layout':'wideLayout') as DisplayProfile:undefined}
}
