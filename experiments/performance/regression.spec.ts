// Reuse behavior checks against the combined experiment's production build in WebKit.
import '../../tests/hover-size.spec'
import '../../tests/desktop-pointer.spec'
import '../../tests/spacing.spec'
import '../../tests/square-spacing.spec'
import '../../tests/history.spec'

import {test,expect} from '@playwright/test'
test('cached hover geometry follows resize, columns, and scrolling',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const check=async()=>{
  const cells=page.locator('.desktop-cell');const first=cells.first();await first.scrollIntoViewIfNeeded()
  const r=(await first.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2)
  await expect(first.locator('button')).toHaveClass(/enlarged/)
  await page.mouse.move(0,0);await expect(page.locator('.enlarged')).toHaveCount(0)
 }
 await check();await page.setViewportSize({width:1000,height:900});await check()
 await page.getByRole('slider',{name:'Columns',exact:true}).fill('3');await check()
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await check()
})
