import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
const sharp: typeof import('sharp').default = createRequire(import.meta.url)('sharp')
import { mkdir } from 'node:fs/promises'
test('README screenshots use only synthetic demo artwork',async({page})=>{
 await page.goto('/?demo=1');await expect(page.locator('.album-card')).toHaveCount(18)
 await page.evaluate(async()=>{await Promise.all(Array.from(document.images).map(i=>i.decode()))})
 await mkdir('docs/screenshots',{recursive:true})
 await page.mouse.move(0,0)
 await sharp(await page.screenshot({fullPage:true,animations:'disabled'})).webp({quality:86}).toFile('docs/screenshots/collection.webp')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await page.mouse.move(0,0)
 await sharp(await page.screenshot({fullPage:true,animations:'disabled'})).webp({quality:86}).toFile('docs/screenshots/appearance.webp')
 await page.getByRole('button',{name:'Settings',exact:true}).click()
 await page.mouse.move(0,0)
 await sharp(await page.screenshot({fullPage:true,animations:'disabled'})).webp({quality:86}).toFile('docs/screenshots/settings.webp')
 await page.keyboard.press('Control+q')
 await sharp(await page.getByRole('dialog',{name:'Quit Plinth?'}).screenshot()).webp({quality:86}).toFile('docs/screenshots/quit.webp')
})
