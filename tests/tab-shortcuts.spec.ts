import { test, expect } from '@playwright/test'

test('tab shortcuts use physical letters and respect text fields, modifiers and dialogs',async({page})=>{
 await page.goto('/?demo=1')
 const nav=page.getByRole('navigation',{name:'Main navigation'})
 const active=(name:string)=>expect(nav.getByRole('button',{name,exact:true})).toHaveClass('active')
 for(const [name,key] of [['Appearance','A'],['Settings','S'],['Collection','C']]){
  const button=nav.getByRole('button',{name,exact:true})
  await expect(button).toHaveAttribute('aria-keyshortcuts','Alt+'+key)
  await expect(button.locator('kbd')).toHaveText('⌥ '+key)
  await expect(button.locator('kbd')).toBeVisible()
  // macOS Option can change event.key into a symbol; event.code stays the letter.
  await page.evaluate(key=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'å',code:'Key'+key,altKey:true,bubbles:true})),key)
  await active(name)
 }
 const search=page.getByRole('searchbox')
 await search.focus();await page.keyboard.press('Alt+KeyA');await active('Collection')
 await search.blur()
 for(const shortcut of ['Alt+Shift+KeyA','Control+Alt+KeyA','Meta+Alt+KeyA']){
  await page.keyboard.press(shortcut);await active('Collection')
 }
 await page.getByRole('button',{name:'View Soft Focus artwork',exact:true}).click()
 await page.keyboard.press('Alt+KeyA');await active('Collection')
 await expect(page.locator('.artwork-gallery')).toBeVisible()
 await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await page.getByRole('button',{name:'Close album editor'}).focus()
 await page.keyboard.press('Alt+KeyH');await active('Collection')
 await page.keyboard.press('Escape')
 await page.keyboard.press('Control+q');await page.keyboard.press('Alt+KeyS');await active('Collection')
 await page.keyboard.press('Escape')
 await page.keyboard.press('Alt+KeyS');await active('Settings')
 await page.keyboard.press('Alt+KeyW');await active('Collection')
 await page.keyboard.press('Alt+KeyQ');await active('Settings')
})
