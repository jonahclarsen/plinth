import {test,expect} from '@playwright/test'
import {previewDisplays,type DetectedDisplay} from '../src/lib/displays'
const internal:DetectedDisplay={id:1,width:3024,height:1964,logicalWidth:1512,logicalHeight:982,menuBarHeight:37,builtIn:true,current:false,remembered:false}
const external:DetectedDisplay={id:2,width:3840,height:2160,logicalWidth:1920,logicalHeight:1080,builtIn:false,current:true,remembered:false}
test('external window selects external profile while retaining the actual internal panel size',()=>{
 const result=previewDisplays([external,internal])
 expect(result.profile).toBe('wideLayout')
 expect(result.screens.layout).toEqual({width:1512,height:982,menuBarHeight:37,pixels:'3024 × 1964'})
 expect(result.screens.wideLayout.width).toBe(1920)
})
test('moving to the internal display selects its profile regardless of pixel width',()=>{
 const result=previewDisplays([{...internal,current:true,width:3456},{...external,current:false}])
 expect(result.profile).toBe('layout')
 expect(result.currentId).toBe(1)
})
test('closed-lid panel data is identified as remembered and never takes current selection',()=>{
 const result=previewDisplays([external,{...internal,remembered:true}])
 expect(result.profile).toBe('wideLayout')
 expect(result.screens.layout.pixels).toBe('3024 × 1964 (last detected)')
 expect(previewDisplays([external]).screens.layout.pixels).toBe('Not detected')
})
test('the current external monitor wins over another connected external monitor',()=>{
 const result=previewDisplays([{...external,id:3,current:false,width:5120},external,internal])
 expect(result.screens.wideLayout.pixels).toBe('3840 × 2160')
 expect(previewDisplays([]).profile).toBeUndefined()
})

test('Appearance follows the native window display while manual selection lasts on the same display',async({page})=>{
 await page.addInitScript(({panel,monitor})=>{
  const callbacks=new Map<number,(event:unknown)=>void>(),listeners=new Map<string,number[]>();let next=1
  let displays=[panel,monitor]
  const internals={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
   transformCallback:(fn:(event:unknown)=>void)=>{const id=next++;callbacks.set(id,fn);return id},
   unregisterCallback:(id:number)=>callbacks.delete(id),
   invoke:async(command:string,args:Record<string,any>={})=>{
    if(command==='get_displays')return displays
    if(command==='get_library')return {dataDir:'/synthetic-demo',library:{albums:[],settings:{layout:{columns:12,gap:6,rowGap:14,top:42,radius:5,shadow:.4},wideLayout:{columns:18,gap:6,rowGap:14,top:42,radius:5,shadow:.4},hoverScale:2.1,hoverEnabled:true,dimOthers:false,opacity:1,sort:'artist',shuffleSeed:0,theme:'dark',desktopEnabled:true,openMode:'library'}}}
    if(command==='plugin:event|listen'){listeners.set(args.event,[...(listeners.get(args.event)??[]),args.handler]);return next++}
    if(command==='plugin:window|scale_factor')return 2
    return null
   }
  }
  Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:internals,__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
  window.addEventListener('test-display-move',(event)=>{
   displays=(event as CustomEvent).detail
   for(const id of listeners.get('tauri://move')??[])callbacks.get(id)?.({event:'tauri://move',id,payload:{x:0,y:0}})
  })
 },{panel:internal,monitor:external})
 await page.goto('/')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const mac=page.getByRole('button',{name:/Mac display/}),wide=page.getByRole('button',{name:/4K monitor/})
 await expect(wide).toHaveAttribute('aria-pressed','true')
 await expect(mac).toContainText('3024 × 1964')
 await mac.click()
 await page.evaluate(displays=>window.dispatchEvent(new CustomEvent('test-display-move',{detail:displays})),[internal,external])
 await page.waitForTimeout(250)
 await expect(mac).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Collection',exact:true}).click()
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(wide).toHaveAttribute('aria-pressed','true')
 await page.evaluate(displays=>window.dispatchEvent(new CustomEvent('test-display-move',{detail:displays})),[{...internal,current:true},{...external,current:false}])
 await expect(mac).toHaveAttribute('aria-pressed','true')
})
