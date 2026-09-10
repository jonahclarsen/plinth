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
 const spaces=page.getByRole('combobox',{name:'Spaces',exact:true});await expect(spaces.locator('option:checked')).toHaveText('All Spaces')
 await spaces.selectOption({label:'This Space'})
 await page.getByRole('button',{name:'Collection',exact:true}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await expect(spaces.locator('option:checked')).toHaveText('This Space')
 await spaces.selectOption({label:'All Spaces'})
 const slider=page.getByRole('slider',{name:'Columns',exact:true});await slider.fill('8');await expect(page.locator('.preview-render .desktop-grid')).toHaveCSS('grid-template-columns',/.* /)
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
