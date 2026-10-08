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
 const ordered=libraryStats(['2020-11-02','2020','2020-03-09','2020-03'].map((date,i)=>({...demoAlbums[0],id:String(i),date})))
 expect(ordered.yearAlbums.get('2020')!.map(album=>album.date)).toEqual(['2020','2020-03','2020-03-09','2020-11-02'])
})

test('Stats charts switch between years and months and settings returns to the prior page',async({page})=>{
 await page.goto('/?demo=1');await page.keyboard.press('Alt+KeyS')
 await expect(page.locator('.stats-page')).toBeVisible()
 await expect(page.getByRole('group',{name:'Albums by release year',exact:true})).toBeVisible()
 await expect(page.locator('.stats-chart')).toContainText('18 albums')
 await page.getByRole('button',{name:'Month + year',exact:true}).click()
 await expect(page.getByRole('group',{name:'Albums by release month',exact:true})).toBeVisible()
 await page.keyboard.press('Meta+s');await expect(page.getByRole('dialog',{name:'Settings',exact:true})).toBeVisible()
 await page.keyboard.press('Alt+KeyC');await expect(page.locator('.stats-page')).toBeVisible()
 await page.locator('.settings-dialog .appearance-options').click();await expect(page.locator('.settings-dialog')).toBeVisible()
 await page.mouse.click(5,5);await expect(page.locator('.settings-dialog')).not.toBeVisible()
 await expect(page.locator('.stats-page')).toBeVisible()
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

test('dense dates fit the chart and artwork previews follow the cursor and keyboard',async({page})=>{
 const {defaultSettings}=await import('../src/lib/types')
 const albums=[...Array.from({length:9},(_,i)=>({...demoAlbums[i],id:`stack-${i}`,title:`Stack ${i}`,date:`2024-01-0${i+1}`})).reverse(),{...demoAlbums[0],id:'pair-late',title:'Pair Late',date:'1999-12-01'},{...demoAlbums[1],id:'pair-early',title:'Pair Early',date:'1999-02-01'},...Array.from({length:180},(_,i)=>({...demoAlbums[i%18],id:`dense-${i}`,date:`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`}))]
 await page.addInitScript(({albums,settings})=>{
  let next=1
  Object.assign(window,{isTauri:true,__TAURI_INTERNALS__:{metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>next++,unregisterCallback:()=>{},convertFileSrc:(path:string)=>albums.find(album=>path.endsWith(album.cover))?.original??albums[0].original,invoke:async(command:string)=>command==='get_library'?{dataDir:'/synthetic-demo',library:{albums,settings}}:command==='get_displays'?[]:command==='plugin:event|listen'?next++:null},__TAURI_EVENT_PLUGIN_INTERNALS__:{unregisterListener:()=>{}}})
 },{albums:albums.map((album,i)=>({...album,cover:`synthetic-${i}.jpg`,original:album.cover})),settings:defaultSettings})
 await page.setViewportSize({width:640,height:700});await page.goto('/');await page.keyboard.press('Alt+KeyS')
 await expect(page.getByRole('heading',{name:'Stats',exact:true})).toHaveCount(0)
 await expect(page.locator('.stats-chart-heading p')).toHaveText('191 albums')
 // A short group rests against the bottom of the column, earliest above latest.
 await page.locator('.stats-plot').scrollIntoViewIfNeeded()
 const pair=(await page.getByRole('button',{name:'1999: 2 albums',exact:true}).locator('.release-hit').boundingBox())!
 await page.mouse.move(pair.x+pair.width/2,pair.y+pair.height/2)
 const pairPeek=page.getByRole('tooltip',{name:'1999 artwork',exact:true})
 const early=pairPeek.getByRole('img',{name:'Pair Early by Low Season',exact:true}),late=pairPeek.getByRole('img',{name:'Pair Late by Mira Vale',exact:true})
 await expect(late).toHaveClass(/ready/)
 const pairWindow=(await page.locator('.stats-peek-window').boundingBox())!,earlyBox=(await early.boundingBox())!,lateBox=(await late.boundingBox())!
 expect(earlyBox.y).toBeLessThan(lateBox.y);expect(lateBox.y+lateBox.height).toBeGreaterThan(pairWindow.y+pairWindow.height-12)
 await page.mouse.move(5,5);await expect(pairPeek).not.toBeVisible()
 await page.getByRole('button',{name:'Month + year',exact:true}).click()
 await expect(page.locator('.release-bucket')).toHaveCount(183)
 expect(await page.locator('.stats-plot').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const bucket=page.getByRole('button',{name:'Jan 2024: 9 albums',exact:true})
 await page.locator('.stats-plot').scrollIntoViewIfNeeded()
 const bounds=(await bucket.locator('.release-hit').boundingBox())!
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height-50)
 const peek=page.getByRole('tooltip',{name:'Jan 2024 artwork',exact:true})
 // The bottom of the column shows the latest albums; moving up scrolls back to the earliest.
 const earliest=peek.getByRole('img',{name:'Stack 0 by Mira Vale',exact:true}),latest=peek.getByRole('img',{name:'Stack 8 by Luca Grey',exact:true})
 await expect(peek).toBeVisible();await expect(latest).toBeVisible();await expect(earliest).toHaveCount(0)
 const window=(await page.locator('.stats-peek-window').boundingBox())!
 expect((await latest.boundingBox())!.y+54).toBeLessThanOrEqual(window.y+window.height+2)
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+2)
 await expect(earliest).toBeVisible();await expect(latest).toHaveCount(0)
 await expect.poll(async()=>(await earliest.boundingBox())!.y-window.y,{timeout:2000}).toBeLessThan(8)
 // Clicking while browsing leaves the column where the pointer put it.
 const track=page.locator('.stats-peek-track'),settled='translate3d(0px, 0px, 0px)'
 await expect.poll(()=>track.evaluate(el=>el.style.transform)).toBe(settled)
 await page.mouse.down();await page.mouse.up();await page.waitForTimeout(300)
 expect(await track.evaluate(el=>el.style.transform)).toBe(settled);await expect(earliest).toBeVisible()
 expect(await page.evaluate(()=>document.activeElement?.classList.contains('release-bucket'))).toBe(false)
 // Each cover drifts, sways and breathes on loops of its own.
 const timings=await peek.locator('.stats-peek-cover').evaluateAll(covers=>covers.map(cover=>[cover,cover.firstElementChild!,cover.querySelector('img')!].map(node=>Math.round(Number(node.getAnimations()[0].effect!.getTiming().duration)))))
 expect(new Set(timings.map(t=>t.join())).size).toBe(timings.length)
 await bucket.focus();await page.keyboard.press('End')
 await expect(peek.getByRole('img',{name:'Stack 8 by Luca Grey',exact:true})).toBeVisible()
 await page.keyboard.press('Home');await expect(peek.getByRole('img',{name:'Stack 0 by Mira Vale',exact:true})).toBeVisible()
 await page.keyboard.press('Escape');await expect(peek).not.toBeVisible()
 await page.emulateMedia({reducedMotion:'reduce'});await bucket.blur();await bucket.focus()
 await expect(peek.locator('img').first()).toBeVisible()
 expect(await peek.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&(a as CSSAnimation).animationName!=='stats-peek-in').length)).toBe(0)
 await page.getByRole('button',{name:'Year',exact:true}).click();await expect(peek).not.toBeVisible()
})
