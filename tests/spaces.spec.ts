import {test,expect} from '@playwright/test'
import {defaultSettings} from '../src/lib/types'

test('Spaces buttons include 1–3, remember the selection, and support undo and redo',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const group=page.getByRole('group',{name:'Spaces',exact:true})
 await expect(group.getByRole('button')).toHaveText(['All Spaces','This Space','1','2','3'])
 await expect(page.getByRole('combobox',{name:'Spaces',exact:true})).toHaveCount(0)
 for(const number of [1,2,3]){
  await group.getByRole('button',{name:`Space ${number}`,exact:true}).click()
  await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName(`Space ${number}`)
 }
 await page.getByRole('button',{name:'Collection',exact:true}).click()
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 3')
 await page.keyboard.press('Meta+z');await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 2')
 await page.keyboard.press('Meta+Shift+z');await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 3')
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list')).toContainText('Spaces: Space 2 → Space 3')
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await group.getByRole('button',{name:'All Spaces',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveText('All Spaces')
 await group.getByRole('button',{name:'This Space',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveText('This Space')
 const bounds=await group.getByRole('button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
 expect(new Set(bounds.map(bounds=>bounds.top)).size).toBe(1)
})

test('native Space availability refreshes, selections survive reload, and rejected changes keep the previous choice',async({page})=>{
 await page.addInitScript(settings=>{
  let next=1
  Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{
   metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
   transformCallback:()=>next++,unregisterCallback:()=>{},
   invoke:async(command:string,args:Record<string,any>={})=>{
    if(command==='get_library')return {dataDir:'/synthetic-demo',library:{albums:[],settings:JSON.parse(localStorage.getItem('test-settings')||JSON.stringify(settings))}}
    if(command==='get_spaces')return {available:JSON.parse(localStorage.getItem('test-spaces')||'[1,2]')}
    if(command==='save_settings'){
     if(args.settings.targetSpace===2&&localStorage.getItem('test-reject')==='true')throw new Error('Space 2 is unavailable. Choose another Space.')
     localStorage.setItem('test-settings',JSON.stringify(args.settings))
    }
    if(command==='get_displays')return []
    if(command==='plugin:event|listen')return next++
    return null
   },
  },__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
 },defaultSettings)
 await page.goto('/');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const group=page.getByRole('group',{name:'Spaces',exact:true})
 await expect(group.getByRole('button',{name:'Space 3',exact:true})).toBeDisabled()
 await group.getByRole('button',{name:'Space 1',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 1')
 await page.evaluate(()=>localStorage.setItem('test-reject','true'))
 await group.getByRole('button',{name:'Space 2',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('Space 2 is unavailable')
 await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 1')
 await page.evaluate(()=>{localStorage.setItem('test-reject','false');localStorage.setItem('test-spaces','[1,2,3]')})
 await page.mouse.move(0,0);await group.hover()
 await expect(group.getByRole('button',{name:'Space 3',exact:true})).toBeEnabled()
 await group.getByRole('button',{name:'Space 3',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 3')
 await page.reload();await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(group.getByRole('button',{pressed:true})).toHaveAccessibleName('Space 3')
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-settings')!))).toMatchObject({allSpaces:false,targetSpace:3})
})
