import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
const sharp: typeof import('sharp').default = createRequire(import.meta.url)('sharp')
test('collection search, metadata edits, hiding and removal',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/?demo=1');await expect(page.locator('.album-card')).toHaveCount(18)
 await page.getByRole('searchbox').fill('Soft Focus');await expect(page.locator('.album-card')).toHaveCount(1)
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await page.getByLabel('Album title').fill('New title')
 await page.getByLabel('Show on desktop',{exact:true}).uncheck()
 await page.getByRole('button',{name:'Save changes'}).click()
 await page.getByRole('searchbox').fill('New title');await expect(page.locator('.hidden-label')).toHaveText('Hidden')
 await page.getByRole('button',{name:'Edit New title'}).click();await page.getByRole('button',{name:'Remove album',exact:true}).click();await page.getByRole('button',{name:'Remove this album'}).click()
 await expect(page.getByRole('heading',{name:'No records found.'})).toBeVisible();expect(errors).toEqual([])
})
test('appearance updates preview and theme without errors',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const slider=page.getByRole('slider',{name:'Columns',exact:true});await slider.fill('8');await expect(page.locator('.preview-render .desktop-grid')).toHaveCSS('--columns','8')
 await expect(page.locator('.slider-field').filter({has:slider}).locator('output')).toHaveText('8')
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Light',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})
test('imports image, deduplicates, and reports invalid files',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Start with a record you love.'})).toBeVisible()
 const buffer=await sharp({create:{width:40,height:40,channels:3,background:'#a8b1c0'}}).png().toBuffer()
 const file={name:'Test Artist - Test Album.png',mimeType:'image/png',buffer}
 await page.getByLabel('Artwork files').setInputFiles(file);await expect(page.locator('.album-card')).toHaveCount(1)
 await page.getByLabel('Artwork files').setInputFiles(file);await expect(page.getByRole('status')).toContainText('already in your collection')
 await page.getByLabel('Artwork files').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await expect(page.getByRole('alert')).toContainText('bad.png')
})
test('desktop cover enlarges and returns to normal',async({page})=>{
 await page.goto('/?demo=1&desktop=1');const cover=page.locator('.desktop-cover').first();await cover.hover();await expect(cover).toHaveClass(/enlarged/)
 await page.mouse.move(5,800);await expect(cover).not.toHaveClass(/enlarged/)
})

test('album editor closes on backdrop clicks but not clicks inside',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByLabel('Album title').click();await expect(page.getByRole('dialog')).toBeVisible()
 await page.mouse.click(10,10);await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible()
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('preview preserves Mac and 4K aspect ratios and uses the selected layout',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const preview=page.locator('.screen-preview');let r=await preview.boundingBox();expect(r!.width/r!.height).toBeCloseTo(1.6,1)
 await page.getByRole('button',{name:/4K monitor/}).click();r=await preview.boundingBox();expect(r!.width/r!.height).toBeCloseTo(16/9,1)
 await expect(page.getByRole('slider',{name:'Columns',exact:true})).toHaveValue('18')
})
test('replacing artwork retains album fields and updates both image variants',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 const image=page.locator('.editor-artwork>img'),before=await image.getAttribute('src')
 await page.getByLabel('Replacement image').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:await sharp({create:{width:90,height:70,channels:3,background:'#c8724c'}}).png().toBuffer()})
 await expect(image).not.toHaveAttribute('src',before!);await expect(image).toHaveAttribute('src',/^data:image\/png/)
 await expect(page.getByLabel('Album title')).toHaveValue('Soft Focus');await expect(page.getByRole('button',{name:'Download original artwork'})).toBeVisible()
 await page.getByRole('button',{name:'Close album editor'}).click();await expect(page.getByRole('button',{name:'Edit Soft Focus',exact:true}).locator('img')).toHaveAttribute('src',/^data:image\/jpeg/)
})

test('quit modal supports cancel, backdrop dismissal and hide',async({page})=>{
 await page.goto('/?demo=1');await page.keyboard.press('Control+q');await expect(page.getByRole('dialog',{name:'Quit Plinth?'})).toBeVisible()
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('Control+q');await page.mouse.click(5,5);await expect(page.getByRole('dialog')).not.toBeVisible()
 await page.keyboard.press('Control+q');await page.getByRole('button',{name:'Hide window',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('shuffle can be selected repeatedly and oldest date follows newest date',async({page})=>{
 await page.goto('/?demo=1');const titles=()=>page.locator('.album-caption h2').allTextContents()
 await page.getByRole('button',{name:'Sort collection',exact:true}).click();await page.getByRole('menuitemradio',{name:'Shuffled',exact:true}).click();const first=await titles()
 await page.getByRole('button',{name:'Sort collection',exact:true}).click();await page.getByRole('menuitemradio',{name:'Shuffled',exact:true}).click();expect(await titles()).not.toEqual(first)
 await page.getByRole('button',{name:'Sort collection',exact:true}).click();await expect(page.getByRole('menuitemradio')).toHaveText(['Artist','Title','Newest date','Oldest date','Shuffled'])
 await page.getByRole('menuitemradio',{name:'Oldest date',exact:true}).click();await expect(page.getByRole('button',{name:'Sort collection',exact:true})).toHaveText('Oldest date')
})
test('Option page navigation wraps, desktop toggle uses action labels, internal artwork cannot drag',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Hide desktop',exact:true}).click();await expect(page.getByRole('button',{name:'Show desktop',exact:true})).toBeVisible()
 await page.keyboard.press('Alt+KeyQ');await expect(page.getByRole('group',{name:'App appearance'})).toBeVisible();await page.keyboard.press('Alt+KeyW');await expect(page.locator('.album-grid')).toBeVisible()
 const image=page.locator('.artwork img').first();await expect(image).toHaveAttribute('draggable','false')
 await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click();await expect(page.locator('.editor-artwork>img')).toHaveAttribute('draggable','false');await expect(page.locator('.artwork-actions')).toHaveCSS('opacity','0');await page.locator('.editor-artwork').hover();await expect(page.locator('.artwork-actions')).toHaveCSS('opacity','1')
})

test('quit modal defaults to hide and provides keyboard actions without leaking shortcuts',async({page})=>{
 await page.goto('/?demo=1')
 const dialog=page.getByRole('dialog',{name:'Quit Plinth?'})
 const show=async()=>{await page.keyboard.press('Control+q');await expect(dialog).toBeVisible();await expect(page.getByRole('button',{name:'Hide window',exact:true})).toBeFocused()}
 await show();await page.keyboard.press('Enter');await expect(dialog).not.toBeVisible()
 await show();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible()
 await show();await page.keyboard.press('Control+w');await expect(dialog).not.toBeVisible()
 await show();await page.keyboard.press('Control+q');await expect(dialog).not.toBeVisible()
 await show();await page.keyboard.press('/');await expect(page.getByRole('button',{name:'Hide window',exact:true})).toBeFocused()
 await page.keyboard.press('Escape')
 await page.keyboard.down('Control');await page.keyboard.down('q');await page.keyboard.down('q');await expect(dialog).toBeVisible();await page.keyboard.up('q');await page.keyboard.up('Control')
})

test('desktop rows have equal margins, center incomplete rows, and cannot scroll',async({page})=>{
 for(const width of [1180,1550,2560]) {
  await page.setViewportSize({width,height:180})
  await page.goto('/?demo=1&desktop=1')
  await expect(page.locator('.desktop-cell')).toHaveCount(18)
  const rows=await page.locator('.desktop-cell').evaluateAll(cells=>{
   const rows:Record<string,{left:number;right:number;width:number}[]>={}
   for(const cell of cells){const r=cell.getBoundingClientRect();(rows[r.top]??=[]).push({left:r.left,right:r.right,width:r.width})}
   return Object.values(rows)
  })
  for(const row of rows){expect(Math.abs(row[0].left-(width-row.at(-1)!.right))).toBeLessThan(1);for(const cell of row)expect(cell.width).toBeCloseTo(rows[0][0].width,1)}
  const surface=page.locator('.desktop-surface')
  await expect(surface).toHaveCSS('overflow','clip')
  await page.mouse.move(width/2,100);await page.mouse.wheel(0,600)
  await page.keyboard.press('PageDown');await page.keyboard.press('End')
  await page.locator('.desktop-cover').last().evaluate(el=>el.focus())
  await page.evaluate(()=>window.scrollTo(0,600))
  await surface.evaluate(el=>el.scrollTo(0,600))
  expect(await surface.evaluate(el=>el.scrollTop)).toBe(0)
  expect(await page.evaluate(()=>window.scrollY)).toBe(0)
 }
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(page.getByRole('slider',{name:'Bottom scroll space'})).toHaveCount(0)
 await page.getByRole('slider',{name:'Columns',exact:true}).fill('7')
 const rows=await page.locator('.preview-render .desktop-cell').evaluateAll(cells=>{
  const rows:Record<string,DOMRect[]>={};for(const cell of cells){const r=cell.getBoundingClientRect();(rows[r.top]??=[]).push(r)}
  return Object.values(rows).map(row=>({center:(row[0].left+row.at(-1)!.right)/2,count:row.length}))
 })
 expect(rows.map(row=>row.count)).toEqual([7,7,4])
 for(const row of rows)expect(row.center).toBeCloseTo(rows[0].center,1)
})

test('Collection blocks wheel, keyboard, focus and programmatic scrolling',async({page})=>{
 await page.setViewportSize({width:800,height:500})
 await page.goto('/?demo=1')
 await expect(page.locator('.album-card')).toHaveCount(18)
 const first=page.locator('.album-card').first()
 const top=await first.evaluate(el=>el.getBoundingClientRect().top)
 await first.hover();await page.mouse.wheel(0,1200)
 await page.keyboard.press('PageDown');await page.keyboard.press('End')
 await page.locator('.album-card button').last().evaluate(el=>el.focus())
 await page.evaluate(()=>{window.scrollTo(0,1200);document.querySelector('.app-shell')?.scrollTo(0,1200)})
 expect(await page.evaluate(()=>window.scrollY)).toBe(0)
 expect(await page.locator('.app-shell').evaluate(el=>el.scrollTop)).toBe(0)
 expect(await first.evaluate(el=>el.getBoundingClientRect().top)).toBe(top)
 // Records outside the fixed view can still be found using search.
 await page.getByRole('searchbox').fill('Soft Focus')
 await expect(page.locator('.album-card')).toHaveCount(1)
 await expect(page.getByRole('button',{name:'Edit Soft Focus',exact:true})).toBeInViewport()
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(page.locator('html')).not.toHaveClass(/collection-document/)
 await page.evaluate(()=>window.scrollTo(0,1200))
 expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0)
 await page.getByRole('button',{name:'Collection',exact:true}).click()
 await expect(page.locator('html')).toHaveClass(/collection-document/)
 expect(await page.evaluate(()=>window.scrollY)).toBe(0)
})
