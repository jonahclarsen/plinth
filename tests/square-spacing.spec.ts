import { test, expect } from '@playwright/test'

test('covers stay square across cover spacing and column settings',async({page})=>{
 await page.goto('/?demo=1')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 for(const profile of [/Mac display/,/4K monitor/]){
  await page.getByRole('button',{name:profile}).click()
  await expect(page.locator('.preview-render img')).toHaveCount(0)
  await expect(page.locator('.preview-render .desktop-cover')).toHaveCount(18)
  await expect(page.locator('.preview-render .desktop-cover').first()).toHaveCSS('background-color','rgb(255, 255, 255)')
  for(const columns of ['3','12','30']){
   await page.getByRole('slider',{name:'Columns',exact:true}).fill(columns)
   let previous=Infinity
   for(const gap of ['0','6','20','40']){
    await page.getByRole('slider',{name:'Space between covers',exact:true}).fill(gap)
    const sizes=await page.locator('.preview-render .desktop-cover').evaluateAll(covers=>covers.map(cover=>{const r=cover.getBoundingClientRect();return {width:r.width,height:r.height}}))
    expect(sizes[0].width).toBeLessThan(previous);previous=sizes[0].width
    for(const size of sizes)expect(Math.abs(size.width-size.height),JSON.stringify({columns,gap,size})).toBeLessThan(.1)
   }
  }
 }
})

test('horizontal and manual row spacing are independent and cells remain square',async({page})=>{
 await page.goto('/?demo=1')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 for(const profile of [/Mac display/,/4K monitor/]){
  await page.getByRole('button',{name:profile}).click()
  await page.getByRole('slider',{name:'Columns',exact:true}).fill('6')
  await page.getByRole('checkbox',{name:'Automatic row spacing',exact:true}).uncheck()
  for(const rowGap of ['0','27','80']){
   await page.getByRole('slider',{name:'Space between rows',exact:true}).fill(rowGap)
   for(const gap of ['0','6','40']){
    await page.getByRole('slider',{name:'Space between covers',exact:true}).fill(gap)
    const geometry=await page.locator('.preview-render').evaluate(preview=>{
     const scale=preview.getBoundingClientRect().width/(preview as HTMLElement).offsetWidth
     const cells=Array.from(preview.querySelectorAll('.desktop-cell'),cell=>cell.getBoundingClientRect())
     return {
      horizontal:(cells[1].left-cells[0].right)/scale,
      vertical:(cells[6].top-cells[0].bottom)/scale,
      squares:cells.every(cell=>Math.abs(cell.width-cell.height)<.1),
     }
    })
    expect(geometry.horizontal).toBeCloseTo(Number(gap),1)
    expect(geometry.vertical).toBeCloseTo(Number(rowGap),1)
    expect(geometry.squares).toBe(true)
   }
  }
 }
})
