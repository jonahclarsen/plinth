import {test,expect,webkit} from '@playwright/test'
import {createRequire} from 'node:module'
const sharp:typeof import('sharp').default=createRequire(import.meta.url)('sharp')

test('WebKit keeps stationary bitmap artwork unchanged across hover and its delayed repaint',async({baseURL})=>{
 const browser=await webkit.launch()
 try{
  const page=await browser.newPage({viewport:{width:1512,height:982},deviceScaleFactor:2})
  // Real bitmap input is essential: SVG demo covers bypass WebKit's quality controller.
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><defs><pattern id="p" width="7" height="9" patternUnits="userSpaceOnUse"><rect width="7" height="9" fill="#ea97b1"/><path d="M0 0L7 9M7 0L0 9" stroke="#254961" stroke-width="1"/></pattern></defs><rect width="900" height="900" fill="url(#p)"/></svg>'
  const bitmap='data:image/png;base64,'+(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64')
  await page.goto(`${baseURL}/?desktop=1&demo=1`)
  const cells=page.locator('.desktop-cell')
  await expect(cells).toHaveCount(18)
  await page.locator('.desktop-cover img').evaluateAll(async(els,url)=>{await Promise.all(els.map(async el=>{const image=el as HTMLImageElement;image.src=url;await image.decode()}))},bitmap)
  await page.waitForTimeout(700)
  const distant=cells.nth(17).locator('img')
  const before=await distant.screenshot()
  const cover=cells.nth(1).locator('.desktop-cover')
  await cells.nth(1).hover()
  await page.waitForTimeout(100)
  const box=await cover.evaluate(el=>el.style.width)
  expect((await distant.screenshot()).equals(before),'stationary artwork pixels').toBe(true)
  await page.waitForTimeout(1100)
  expect((await distant.screenshot()).equals(before),'stationary artwork pixels').toBe(true)
  expect(await cover.evaluate(el=>el.style.width)).toBe(box)
  await page.waitForTimeout(2100)
  expect((await distant.screenshot()).equals(before),'stationary artwork pixels').toBe(true)
  // Breathing still runs on its existing GPU layer, without resizing its backing box.
  expect(await cover.evaluate(el=>el.style.width)).toBe(box)
  await expect(cover).toHaveCSS('will-change','transform')
  expect(await cover.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThanOrEqual(1)
  await page.mouse.move(1510,980)
  await page.waitForTimeout(1000)
  expect((await distant.screenshot()).equals(before),'stationary artwork pixels').toBe(true)
 }finally{await browser.close()}
})

test('render a synthetic desktop README capture',async({page})=>{
 const {mkdir}=await import('node:fs/promises')
 await page.setViewportSize({width:1550,height:840})
 await page.goto('/?desktop=1&demo=1')
 await expect(page.locator('.desktop-cell')).toHaveCount(18)
 await page.evaluate(async()=>Promise.all([...document.images].map(image=>image.decode())))
 await page.locator('.desktop-cell').nth(7).hover()
 await page.waitForTimeout(300)
 await mkdir('test-results/hover-readme',{recursive:true})
 await sharp(await page.screenshot({animations:'disabled'})).webp({quality:88}).toFile('test-results/hover-readme/hero.webp')
})
