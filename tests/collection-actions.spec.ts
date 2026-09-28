import { test, expect } from '@playwright/test'
import { defaultSettings } from '../src/lib/types'
import { demoAlbums } from '../src/lib/demo'

test('clicking anywhere on a collection card opens the editor without a hover overlay',async({page})=>{
 await page.goto('/?demo=1')
 const card=page.locator('.album-card').filter({has:page.getByRole('button',{name:'Edit Soft Focus',exact:true})})
 await expect(card.getByRole('button')).toHaveCount(1)
 await expect(card.locator('.album-edit')).toHaveCSS('cursor','pointer')
 await card.hover()
 await expect(card.locator('.artwork')).toHaveText('')
 await expect.poll(()=>card.locator('.artwork').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none')
 await card.locator('.artwork').click()
 await expect(page.locator('.album-dialog')).toBeVisible()
 await expect(page.locator('.artwork-gallery')).not.toBeVisible()
 await page.keyboard.press('Escape')
 await card.locator('.album-title').click()
 await expect(page.locator('.album-dialog')).toBeVisible()
 await page.keyboard.press('Escape')
 const caption=(await card.locator('.album-caption').boundingBox())!
 await page.mouse.click(caption.x+caption.width-3,caption.y+caption.height-3)
 await expect(page.getByLabel('Album title')).toHaveValue('Soft Focus')
 await page.getByRole('button',{name:'View original artwork',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'Original artwork',exact:true})).toBeVisible()
 await page.locator('.artwork-gallery img').click()
 await expect(page.locator('.artwork-gallery')).not.toBeVisible()
})

test('Command-A adds artwork from Collection and keeps Select All in text fields',async({page})=>{
 await page.goto('/?demo=1')
 const add=page.locator('.header-actions').getByRole('button',{name:'Add artwork',exact:true})
 await expect(add.locator('kbd')).toHaveText('Cmd A')
 await expect(add).toHaveAttribute('aria-keyshortcuts','Meta+A Control+A')
 await expect(add.locator('kbd svg')).toHaveCount(1)
 let pickers=0;page.on('filechooser',()=>pickers++)
 const picker=page.waitForEvent('filechooser')
 await page.keyboard.press('Meta+a');await picker
 expect(pickers).toBe(1)
 const search=page.getByRole('searchbox')
 await search.fill('Soft Focus');await page.keyboard.press('Meta+a')
 await expect.poll(()=>search.evaluate((input:HTMLInputElement)=>input.selectionEnd!-input.selectionStart!)).toBe(10)
 expect(pickers).toBe(1)
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 const title=page.getByLabel('Album title')
 await title.focus();await page.keyboard.press('Meta+a')
 await expect.poll(()=>title.evaluate((input:HTMLInputElement)=>input.selectionEnd!-input.selectionStart!)).toBe(10)
 expect(pickers).toBe(1)
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await page.getByRole('button',{name:'View original artwork',exact:true}).click()
 await page.keyboard.press('Meta+a');expect(pickers).toBe(1)
 await page.keyboard.press('Escape');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await page.keyboard.press('Meta+a');expect(pickers).toBe(1)
})

test('Enter saves from outside fields and respects form validation and the top dialog',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 const save=page.getByRole('button',{name:'Save',exact:true})
 await expect(save).toHaveAttribute('aria-keyshortcuts','Enter');await expect(save.locator('kbd')).toHaveText('Enter')
 await expect(page.locator('.album-dialog')).not.toContainText('IN YOUR COLLECTION')
 await page.getByLabel('Album title').fill('')
 await page.getByRole('button',{name:'Close album editor'}).focus();await page.keyboard.press('Enter')
 await expect(page.locator('.album-dialog')).toBeVisible();await expect(page.getByLabel('Album title')).toBeFocused()
 await page.getByLabel('Album title').fill('Saved with Enter')
 await page.getByRole('button',{name:'View original artwork',exact:true}).click()
 await page.keyboard.press('Enter');await expect(page.locator('.artwork-gallery')).toBeVisible()
 await page.keyboard.press('Escape')
 await page.keyboard.press('Control+q');await page.keyboard.press('Enter')
 await expect(page.getByRole('dialog',{name:'Quit Plinth?'})).toBeVisible()
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Close album editor'}).focus();await page.keyboard.press('Enter')
 await expect(page.locator('.album-dialog')).not.toBeVisible()
 await expect(page.getByRole('button',{name:'Edit Saved with Enter',exact:true})).toBeVisible()
})

test('Finder reveals the original album and Music responds throughout its padded button',async({page})=>{
 await page.addInitScript(({settings,album})=>{
  let next=1
  Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{
   metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
   transformCallback:()=>next++,unregisterCallback:()=>{},convertFileSrc:()=>album.cover,
   invoke:async(command:string,args:Record<string,any>={})=>{
    if(command==='get_library')return {dataDir:'/synthetic-demo',library:{albums:[album],settings}}
    if(command==='get_displays')return []
    if(command==='plugin:event|listen')return next++
    if(command==='reveal_artwork'||command==='open_album')localStorage.setItem(command,args.id)
    return null
   },
  },__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
 },{settings:defaultSettings,album:demoAlbums[0]})
 await page.goto('/');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await page.locator('.editor-artwork').hover()
 await page.getByRole('button',{name:'Show original artwork in Finder',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('reveal_artwork'))).toBe('demo-000')
 await expect(page.locator('.artwork-gallery')).not.toBeVisible()
 const music=page.getByRole('button',{name:'Open in Music',exact:true})
 const bounds=(await music.boundingBox())!
 await page.mouse.click(bounds.x+3,bounds.y+3)
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('open_album'))).toBe('demo-000')
})
