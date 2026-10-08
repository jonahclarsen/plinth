import { test, expect } from '@playwright/test'
import { libraryStats } from '../src/lib/stats'
import { demoAlbums } from '../src/lib/demo'

test('stats counts release precision, hidden albums, artists and invalid dates accurately',()=>{
 const dates=['2024-02-29','2024-02','2024','2023-02-29','2020-13-01','','0000','1999-12-31']
 const stats=libraryStats(dates.map((date,i)=>({...demoAlbums[0],id:String(i),date,artist:i<4?' Mira Vale ':'',enabled:i!==0})))
 expect(stats.dated).toBe(4);expect(stats.monthly).toBe(3)
 expect(stats.years).toEqual([{label:'1999',count:1},{label:'2024',count:3}])
 expect(stats.monthYears).toEqual([{label:'1999-12',count:1},{label:'2024-02',count:2}])
 expect(stats.topArtists).toEqual([{label:'Mira Vale',count:4}])
})

test('Stats charts switch between years and months and settings returns to the prior page',async({page})=>{
 await page.goto('/?demo=1');await page.keyboard.press('Alt+KeyS')
 await expect(page.getByRole('heading',{name:'Stats',exact:true})).toBeVisible()
 await expect(page.getByRole('img',{name:'Albums by release year',exact:true})).toBeVisible()
 await expect(page.locator('.stats-chart')).toContainText('18 of 18 albums')
 await page.getByRole('button',{name:'Month + year',exact:true}).click()
 await expect(page.getByRole('img',{name:'Albums by release month',exact:true})).toBeVisible()
 await page.keyboard.press('Meta+s');await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible()
 await page.keyboard.press('Alt+KeyC');await expect(page.locator('.stats-page')).toBeVisible()
 await page.locator('.settings-dialog .appearance-options').click();await expect(page.locator('.settings-dialog')).toBeVisible()
 await page.mouse.click(5,5);await expect(page.locator('.settings-dialog')).not.toBeVisible()
 await expect(page.getByRole('heading',{name:'Stats',exact:true})).toBeVisible()
 const picker=page.waitForEvent('filechooser');await page.keyboard.press('Meta+a');await picker
 await expect(page.locator('.album-grid')).toBeVisible()
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const clickPicker=page.waitForEvent('filechooser');await page.locator('.header-actions').getByRole('button',{name:'Add artwork',exact:true}).click();await clickPicker
 await expect(page.locator('.album-grid')).toBeVisible()
})

test('Stats has empty and undated states and fits a narrow light window',async({page})=>{
 await page.setViewportSize({width:640,height:650});await page.goto('/')
 await page.keyboard.press('Alt+KeyS');await expect(page.getByText('Your collection starts here.')).toBeVisible()
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await page.getByLabel('Release date').fill('');await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.keyboard.press('Alt+KeyS');await expect(page.locator('.stats-chart')).toContainText('17 of 18 albums')
 await page.keyboard.press('Meta+s');await page.getByRole('button',{name:'Light',exact:true}).click();await page.keyboard.press('Escape')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
