import { test, expect } from '@playwright/test'
import { desktopSpacing } from '../src/lib/spacing'
import { defaultLayout } from '../src/lib/types'

test('automatic row spacing balances the menu-bar and screen-bottom gaps',()=>{
 for(const [width,height,count,menu] of [[1512,982,60,37],[1920,1080,18,24],[1280,800,1,24],[1512,982,84,0]]){
  const layout={...defaultLayout}
  const {top,rowGap}=desktopSpacing(layout,width,height,count,menu)
  const cover=(width-2*Math.max(6,layout.gap/2)-(layout.columns-1)*layout.gap)/layout.columns
  const rows=Math.ceil(count/layout.columns)
  const bottom=height-top-rows*cover-(rows-1)*rowGap
  expect(top-menu).toBeCloseTo(bottom,6)
  expect(rowGap).toBeGreaterThanOrEqual(0)
 }
 const crowded=desktopSpacing(defaultLayout,640,180,120,24)
 expect(crowded.rowGap).toBe(0)
 expect(Number.isFinite(desktopSpacing(defaultLayout,1280,800,0,24).rowGap)).toBe(true)
 expect(desktopSpacing({...defaultLayout,rowGap:27},1280,800,18,24).rowGap).toBe(27)
})

test('preview shares balanced spacing and manual spacing can be undone or reset',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const auto=page.getByRole('checkbox',{name:'Automatic row spacing',exact:true})
 const assertBalanced=async(screenWidth:number)=>{
  const surface=(await page.locator('.screen-preview').boundingBox())!
  const cells=await page.locator('.preview-render .desktop-cell').evaluateAll(cells=>cells.map(cell=>{const r=cell.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
  const scale=surface.width/screenWidth
  expect(Math.min(...cells.map(cell=>cell.top))-surface.y-24*scale).toBeCloseTo(surface.y+surface.height-Math.max(...cells.map(cell=>cell.bottom)),0)
 }
 await expect(auto).toBeChecked();await assertBalanced(1280)
 const slider=page.getByRole('slider',{name:'Space between rows',exact:true})
 await expect(slider).toBeDisabled()
 await auto.uncheck();await expect(slider).toBeEnabled()
 await slider.fill('27')
 await expect(auto).not.toBeChecked()
 await expect(page.locator('.desktop-grid')).toHaveCSS('--row-gap','27px')
 await page.keyboard.press('Meta+z');await expect(auto).toBeChecked();await expect(slider).toBeDisabled();await assertBalanced(1280)
 await page.keyboard.press('Meta+Shift+z');await expect(auto).not.toBeChecked()
 await auto.click();await assertBalanced(1280)
 await page.getByRole('button',{name:/4K monitor/}).click();await assertBalanced(1920)
 await expect(slider).toBeDisabled();await auto.uncheck()
 await slider.fill('12')
 await page.getByRole('button',{name:'Reset',exact:true}).click();await expect(auto).toBeChecked()
})

test('opacity and surrounding-cover dimming controls and effects are absent',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(page.getByLabel('Artwork opacity',{exact:true})).toHaveCount(0)
 await expect(page.getByLabel('Dim surrounding covers',{exact:true})).toHaveCount(0)
 await page.locator('.preview-render .desktop-cover').first().hover()
 await expect(page.locator('.desktop-grid')).toHaveCSS('opacity','1')
 const covers=page.locator('.preview-render .desktop-cover')
 expect(await covers.evaluateAll(covers=>covers.every(cover=>getComputedStyle(cover).filter==='none'))).toBe(true)
})
