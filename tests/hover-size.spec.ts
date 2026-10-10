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
 await expect.poll(()=>sample.evaluate(el=>el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width).then(ratio=>Math.abs(ratio-value))).toBeLessThanOrEqual((value-1)*.031+.01)
 await page.mouse.move(5,5);await page.mouse.up()
 await expect(page.locator('.preview-render .desktop-cover.enlarged')).toHaveCount(0)
})
test('hover sliders retain native pointer dragging',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 for(const name of ['Hover size','Hover speed']){
  const slider=page.getByRole('slider',{name,exact:true})
  await slider.scrollIntoViewIfNeeded()
  const r=(await slider.boundingBox())!
  await page.mouse.move(r.x+r.width*.25,r.y+r.height/2);await page.mouse.down()
  await page.mouse.move(r.x+r.width*.75,r.y+r.height/2,{steps:5});await page.mouse.up()
  expect(Number(await slider.inputValue())).toBeGreaterThan(Number(await slider.getAttribute('min'))+(Number(await slider.getAttribute('max'))-Number(await slider.getAttribute('min')))*.6)
 }
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

test('hover speed is saved in history and corners animate with scale',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const speed=page.getByRole('slider',{name:'Hover speed',exact:true})
 await expect(speed).toHaveValue('250')
 await expect(speed).toHaveAttribute('aria-valuetext','250 milliseconds')
 await speed.fill('1000')
 await expect(speed.locator('..').locator('output')).toHaveText('1000 ms')
 await page.getByRole('slider',{name:'Rounded corners',exact:true}).fill('20')
 await page.mouse.move(0,0)
 await page.waitForTimeout(1100)
 await page.clock.install()
 const cover=page.locator('.preview-render .desktop-cover').first()
 await cover.hover()
 await page.clock.runFor(500)
 const middle=await cover.evaluate(el=>({radius:parseFloat(getComputedStyle(el).borderRadius),scale:el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width}))
 expect(middle.radius).toBeGreaterThan(3);expect(middle.radius).toBeLessThan(17)
 expect(middle.scale).toBeGreaterThan(1.2);expect(middle.scale).toBeLessThan(1.9)
 await page.clock.runFor(600);await expect(cover).toHaveCSS('border-radius','0px')
 await page.mouse.move(0,0);await page.clock.runFor(500)
 const returning=await cover.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))
 expect(returning).toBeGreaterThan(3);expect(returning).toBeLessThan(17)
 await page.clock.runFor(600);await expect(cover).toHaveCSS('border-radius','20px')
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list')).toContainText('Hover speed: 250 ms → 1000 ms')
})


test('background hover option sits beneath enlarge and restores through history',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const enlarge=page.getByRole('checkbox',{name:'Enlarge on hover',exact:true})
 const background=page.getByRole('checkbox',{name:'While another app has focus',exact:true})
 await expect(background).toBeChecked()
 await expect(page.locator('.toggle-row').filter({has:enlarge}).locator('+ .toggle-row')).toContainText('While another app has focus')
 await background.uncheck()
 await page.keyboard.press('Meta+z');await expect(background).toBeChecked()
 await page.keyboard.press('Meta+Shift+z');await expect(background).not.toBeChecked()
 await enlarge.uncheck();await expect(background).toBeDisabled()
 await enlarge.check();await expect(background).toBeEnabled();await expect(background).not.toBeChecked()
})

test('rounded corners on hover default off and restore independently for each display',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 const toggle=page.getByRole('checkbox',{name:'When hovered',exact:true})
 await expect(toggle).not.toBeChecked()
 await page.getByRole('slider',{name:'Rounded corners',exact:true}).fill('20')
 await toggle.check()
 const cover=page.locator('.preview-render .desktop-cover').first()
 // Painted radius: the CSS radius is compensated for the downscaling transform.
 const painted=()=>cover.evaluate(el=>{const style=getComputedStyle(el),t=style.transform==='none'?1:new DOMMatrix(style.transform).a;return parseFloat(style.borderRadius)*t})
 await cover.hover()
 await expect(cover).toHaveClass(/enlarged/)
 await expect.poll(painted).toBeCloseTo(20,1)
 await page.mouse.move(0,0)
 await page.keyboard.press('Meta+z');await expect(toggle).not.toBeChecked()
 await cover.hover();await expect(cover).toHaveCSS('border-radius','0px')
 await page.mouse.move(0,0)
 await page.keyboard.press('Meta+Shift+z');await expect(toggle).toBeChecked()
 await cover.hover();await expect.poll(painted).toBeCloseTo(20,1)
 await page.getByRole('button',{name:/4K monitor/}).click()
 await expect(toggle).not.toBeChecked()
 await page.getByRole('button',{name:/Mac display/}).click()
 await expect(toggle).toBeChecked()
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list')).toContainText('Rounded corners when hovered: Off → On')
})

test('hovering pushes nearby artwork away, less with distance, and the toggle restores through history',async({page})=>{
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Appearance',exact:true}).click()
 await page.getByRole('button',{name:/Mac display/}).click();await page.getByRole('slider',{name:'Columns',exact:true}).fill('6')
 const cells=page.locator('.preview-render .desktop-cell')
 const offset=(i:number)=>cells.nth(i).evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {x:m.m41,y:m.m42}})
 await cells.nth(3).scrollIntoViewIfNeeded();await cells.nth(3).hover()
 await expect.poll(async()=>(await offset(4)).x).toBeGreaterThan(5)
 await page.waitForTimeout(400)
 const [left,right,farther,below,far]=await Promise.all([2,4,5,9,17].map(offset))
 expect(left.x).toBeLessThan(-5);expect(right.x).toBeGreaterThan(farther.x);expect(farther.x).toBeGreaterThan(0)
 expect(below.y).toBeGreaterThan(5);expect(far).toEqual({x:0,y:0})
 // Hovered at its center, the enlarged cover does not drift sideways (the top edge moves it down).
 const self=await offset(3);expect(Math.abs(self.x)).toBeLessThan(.5)
 await page.mouse.move(0,0)
 await expect.poll(()=>cells.nth(4).evaluate(el=>el.style.transform+el.style.willChange)).toBe('')
 const toggle=page.getByRole('checkbox',{name:'Push nearby artwork',exact:true})
 await expect(toggle).toBeChecked();await toggle.uncheck()
 await cells.nth(3).hover();await page.waitForTimeout(400)
 expect(await offset(4)).toEqual({x:0,y:0})
 await page.getByRole('checkbox',{name:'Enlarge on hover',exact:true}).uncheck();await expect(toggle).toBeDisabled()
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).click()
 await expect(page.locator('.history-list')).toContainText('Push nearby artwork: On → Off')
})

test('desktop hit areas meet across gaps so one album is always enlarged, and enlargement stays unscaled',async({page})=>{
 await page.setViewportSize({width:1512,height:982})
 await page.goto('/?desktop=1&demo=1')
 const cells=page.locator('.desktop-cell');await expect(cells).toHaveCount(18)
 const rects=await cells.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.getAttribute('data-id'),left:r.left,top:r.top,right:r.right,bottom:r.bottom}}))
 const [a,b]=rects;const lastRow=rects.filter(r=>r.top>a.top)
 expect(lastRow.length).toBeGreaterThan(0)
 const enlarged=page.locator('.desktop-cover.enlarged')
 // Column gap: each side of its midpoint belongs to the closer cover.
 for(const [x,id] of [[a.right+(b.left-a.right)*.25,a.id],[a.right+(b.left-a.right)*.75,b.id]] as const){
  await page.mouse.move(x,a.top+20);await expect(enlarged).toHaveCount(1);await expect(enlarged.locator('..')).toHaveAttribute('data-id',id!)
 }
 // Row gap and the empty space beside a centered last row still enlarge the nearest album.
 const gapY=(a.bottom+lastRow[0].top)/2
 for(const [x,y] of [[a.left+5,gapY],[rects.at(-1)!.right+30,lastRow[0].top+10],[a.left+5,lastRow[0].bottom-5]]){
  await page.mouse.move(x,y);await expect(enlarged).toHaveCount(1)
 }
 await page.mouse.move(a.left+5,a.bottom+5);await expect(enlarged.locator('..')).toHaveAttribute('data-id',a.id!)
 await page.mouse.move(a.left+5,lastRow[0].top-5);await expect(enlarged.locator('..')).not.toHaveAttribute('data-id',a.id!)
 // Outside the artwork's extent nothing is hovered.
 await page.mouse.move(1510,980);await expect(enlarged).toHaveCount(0)
 await page.mouse.move((b.left+b.right)/2,(b.top+b.bottom)/2)
 const cover=cells.nth(1).locator('.desktop-cover')
 await expect.poll(()=>cover.evaluate(el=>el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width).then(ratio=>Math.abs(ratio-2.1))).toBeLessThanOrEqual(1.1*.031)
 // The box is laid out at its largest size and only ever scaled down, never upscaled.
 await expect.poll(()=>cover.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(1)
 expect(await cover.evaluate(el=>parseFloat(el.style.width)/100)).toBeCloseTo(2.1+1.1*.03,6)
})

test('the enlarged cover drifts slightly away from the pointer and breathes, pushing neighbors with its size',async({page})=>{
 await page.setViewportSize({width:1512,height:982})
 await page.clock.install()
 await page.goto('/?desktop=1&demo=1')
 const cells=page.locator('.desktop-cell');await expect(cells).toHaveCount(18)
 const offset=(i:number)=>cells.nth(i).evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el).transform);return {x:m.m41,y:m.m42}})
 const ratio=()=>cells.nth(1).locator('.desktop-cover').evaluate(el=>el.getBoundingClientRect().width/el.parentElement!.getBoundingClientRect().width)
 const r=(await cells.nth(1).boundingBox())!
 await page.mouse.move(r.x+r.width*.9,r.y+r.height*.9);await page.clock.runFor(1000)
 // 40% of half a cover, times the 12% drift share: to the left, and only a little. Every row
 // here meets the top or bottom edge, so the vertical offset belongs to the edge.
 const drifted=await offset(1)
 expect(drifted.x).toBeLessThan(-r.width*.03);expect(drifted.x).toBeGreaterThan(-r.width*.07)
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.clock.runFor(1000)
 const centered=await offset(1);expect(Math.abs(centered.x)).toBeLessThan(.5)
 const samples:{size:number;push:number}[]=[]
 for(let i=0;i<8;i++){await page.clock.runFor(1000);samples.push({size:await ratio(),push:(await offset(2)).x})}
 const sizes=samples.map(s=>s.size),largest=samples[sizes.indexOf(Math.max(...sizes))],smallest=samples[sizes.indexOf(Math.min(...sizes))]
 expect(largest.size-smallest.size).toBeGreaterThan(.05);expect(largest.size-smallest.size).toBeLessThan(.07)
 expect(largest.push).toBeGreaterThan(smallest.push+.3)
})

test('covers near the edges stay on screen while enlarged, breathing, and pushed',async({page})=>{
 await page.setViewportSize({width:1512,height:982})
 await page.clock.install()
 await page.goto('/?desktop=1&demo=1')
 const cells=page.locator('.desktop-cell');await expect(cells).toHaveCount(18)
 const overhang=()=>page.locator('.desktop-cover').evaluateAll(els=>Math.max(...els.map(el=>{const r=el.getBoundingClientRect();return Math.max(-r.left,-r.top,r.right-innerWidth,r.bottom-innerHeight)})))
 // Top left corner, right edge, and the bottom row; pointers toward the edge drift away from it.
 for(const [i,fx,fy] of [[0,.1,.1],[11,.9,.5],[15,.5,.9]]){
  const r=(await cells.nth(i).boundingBox())!
  await page.mouse.move(r.x+r.width*fx,r.y+r.height*fy)
  for(let t=0;t<12;t++){await page.clock.runFor(t<6?50:1000);expect(await overhang()).toBeLessThanOrEqual(.01)}
  const cover=(await cells.nth(i).locator('.desktop-cover').boundingBox())!
  // Resting against the edge, drifting only a little away from it with the pointer.
  expect(Math.min(cover.x,cover.y,1512-cover.x-cover.width,982-cover.y-cover.height)).toBeLessThan(r.width*.06)
  await page.mouse.move(r.x+r.width*fx,r.y+r.height*fy+(fy>.5?-1:1)*r.height*1.4);await page.clock.runFor(100)
  expect(await overhang()).toBeLessThanOrEqual(.01)
 }
 await page.mouse.move(1510,980);await page.clock.runFor(1500)
 await expect.poll(()=>cells.evaluateAll(els=>els.filter(el=>el.style.transform||el.style.willChange).length)).toBe(0)
})

test('covers pressed into an edge squeeze against it instead of stopping dead',async({page})=>{
 await page.setViewportSize({width:1512,height:982})
 await page.clock.install()
 await page.goto('/?desktop=1&demo=1')
 const cells=page.locator('.desktop-cell');await expect(cells).toHaveCount(18)
 const rects=await cells.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}))
 const squeeze=(i:number)=>cells.nth(i).evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)
 const box=async(i:number)=>(await cells.nth(i).locator('.desktop-cover').boundingBox())!
 // A neighbor pushed into the left edge shrinks against it, so its inner side still moves left.
 const r=rects[1]
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.clock.runFor(500)
 await page.mouse.move(r.x+r.width*.15,r.y+r.height/2);await page.clock.runFor(1500)
 expect(await squeeze(0)).toBeLessThan(.99);expect(await squeeze(0)).toBeGreaterThan(.83)
 const pressed=await box(0)
 expect(pressed.x+pressed.width).toBeLessThan(rects[0].x+rects[0].width-1)
 expect(pressed.x).toBeGreaterThanOrEqual(-.01)
 // An enlarged cover drifting into an edge squeezes too; drifting away from it, it moves freely.
 const corner=rects[0]
 await page.mouse.move(corner.x+corner.width*.9,corner.y+corner.height*.9);await page.clock.runFor(1500)
 expect(await squeeze(0)).toBeLessThan(1)
 const into=await box(0);expect(Math.min(into.x,into.y)).toBeGreaterThanOrEqual(-.01)
 await page.mouse.move(corner.x+corner.width*.1,corner.y+corner.height*.1);await page.clock.runFor(1500)
 expect(await squeeze(0)).toBe(1)
 const away=await box(0);expect(away.x).toBeGreaterThan(into.x+2);expect(away.y).toBeGreaterThan(into.y+2)
 await page.mouse.move(1510,980);await page.clock.runFor(1500)
 await expect.poll(()=>cells.evaluateAll(els=>els.filter(el=>el.style.transform||el.style.willChange).length)).toBe(0)
})
