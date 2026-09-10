import type { Layout } from './types'
export function desktopSpacing(layout:Layout,width:number,height:number,count:number,menuBarHeight=0){
 const top=Math.max(menuBarHeight,layout.top)
 if(layout.rowGap!==null)return {top:layout.top,rowGap:layout.rowGap}
 const rows=Math.ceil(count/layout.columns)
 if(!rows)return {top,rowGap:0}
 const cover=Math.max(0,(width-2*Math.max(6,layout.gap/2)-(layout.columns-1)*layout.gap)/layout.columns)
 if(rows===1)return {top:Math.max(menuBarHeight,(height+menuBarHeight-cover)/2),rowGap:0}
 // Match the clearance below the menu bar at the bottom of the screen.
 const rowGap=Math.max(0,(height-2*top+menuBarHeight-rows*cover)/(rows-1))
 return {top,rowGap}
}
