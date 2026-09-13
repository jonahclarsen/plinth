import {test,expect} from '@playwright/test'

async function start(page:import('@playwright/test').Page){
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const slider=page.getByRole('slider',{name:'Space between covers',exact:true});await slider.scrollIntoViewIfNeeded()
 const rect=(await slider.boundingBox())!;await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down()
 return slider
}

test('pauses during a held appearance slider create one saved history state',async({page})=>{
 const slider=await start(page)
 for(const value of ['10','20','30']){
  await slider.fill(value)
  await expect(page.locator('.desktop-grid')).toHaveCSS('--column-gap',`${value}px`)
  await page.waitForTimeout(180)
 }
 await page.mouse.up();await page.waitForTimeout(180)
 await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list>li')).toHaveCount(2)
 await expect(page.locator('.history-list')).toContainText('Space between covers: 6 → 30')
})

for(const event of ['blur','pointercancel'])test(`${event} commits the final appearance value`,async({page})=>{
 const slider=await start(page);await slider.fill('17');await page.waitForTimeout(180)
 await page.evaluate(type=>window.dispatchEvent(new Event(type)),event)
 await page.waitForTimeout(180);await page.mouse.up()
 await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list>li')).toHaveCount(2)
 await expect(page.locator('.history-list')).toContainText('Space between covers: 6 → 17')
})

test('undo flushes the held slider value before navigating history',async({page})=>{
 const slider=await start(page);await slider.fill('25');await page.waitForTimeout(180)
 await page.keyboard.press('Meta+z');await expect(slider).toHaveValue('6');await page.mouse.up()
 await page.keyboard.press('Meta+Shift+z');await expect(slider).toHaveValue('25')
})

test('keyboard range edits still save without a pointer drag',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const slider=page.getByRole('slider',{name:'Space between covers',exact:true})
 await slider.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(180)
 await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list>li')).toHaveCount(2)
 await expect(page.locator('.history-list')).toContainText('Space between covers: 6 → 7')
})
