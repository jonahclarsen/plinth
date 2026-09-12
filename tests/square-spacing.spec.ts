import { test, expect } from '@playwright/test'

test('covers stay square across cover spacing and column settings',async({page})=>{
 await page.goto('/?demo=1')
 await page.getByRole('button',{name:'Appearance',exact:true}).click()
 for(const profile of [/Mac display/,/4K monitor/]){
  await page.getByRole('button',{name:profile}).click()
  await page.locator('.preview-render .desktop-cover img').first().evaluate(async(image:HTMLImageElement)=>{
   image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="red"/></svg>')
   await image.decode()
  })
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
