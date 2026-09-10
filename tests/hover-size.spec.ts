import {test,expect} from '@playwright/test'
test('holding Hover size previews one album, follows dragging, and ends on release outside',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const slider=page.getByRole('slider',{name:'Hover size',exact:true})
 await slider.scrollIntoViewIfNeeded()
 const r=(await slider.boundingBox())!
 await page.mouse.move(r.x+r.width*.6,r.y+r.height/2);await page.mouse.down()
 const sample=page.locator('.preview-render .desktop-cover.enlarged')
 await expect(sample).toHaveCount(1)
 const name=await sample.getAttribute('aria-label')
 await page.mouse.move(r.x+r.width*.9,r.y+r.height/2,{steps:5})
 await expect(sample).toHaveAttribute('aria-label',name!)
 const value=Number(await slider.inputValue())
 await expect.poll(()=>sample.evaluate(el=>Number(getComputedStyle(el).transform.split('(')[1].split(',')[0]))).toBeCloseTo(value,1)
 await page.mouse.move(5,5);await page.mouse.up()
 await expect(page.locator('.preview-render .desktop-cover.enlarged')).toHaveCount(0)
})
test('right-click does not preview; cancellation and blur clear the sample',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const slider=page.getByRole('slider',{name:'Hover size',exact:true})
 await slider.scrollIntoViewIfNeeded();const r=(await slider.boundingBox())!
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down({button:'right'})
 await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(0)
 await page.mouse.up({button:'right'});await page.keyboard.press('Escape')
 await page.mouse.down();await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(1)
 await slider.dispatchEvent('pointercancel');await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(0)
 await page.mouse.up();await page.mouse.down();await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(1)
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
 await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(0);await page.mouse.up()
})
test('hover-size sample works with hover disabled and an empty library is harmless',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await page.getByRole('checkbox',{name:/Enlarge on hover/}).uncheck()
 const slider=page.getByRole('slider',{name:'Hover size',exact:true})
 await slider.scrollIntoViewIfNeeded();let r=(await slider.boundingBox())!
 await page.mouse.move(r.x+r.width*.75,r.y+r.height/2);await page.mouse.down()
 await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(1);await page.mouse.up()
 await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(0)
 await page.goto('/');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await slider.scrollIntoViewIfNeeded();r=(await slider.boundingBox())!
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down()
 await expect(page.locator('.desktop-cover.enlarged')).toHaveCount(0);await page.mouse.up()
})
