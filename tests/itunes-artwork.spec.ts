import { test, expect, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
const sharp: typeof import('sharp').default = createRequire(import.meta.url)('sharp')
const art=(id:string)=>`https://is1-ssl.mzstatic.com/image/thumb/Music/${id}.png/100x100bb.jpg`
// Never reach Apple from tests: answer the search and image requests locally.
async function mockItunes(page:Page){
 const searches:URL[]=[],downloads:string[]=[]
 await page.route('https://itunes.apple.com/search?**',route=>{
  const url=new URL(route.request().url());searches.push(url)
  const term=url.searchParams.get('term')!
  const results=term.includes('Soft Focus')?[
   {collectionName:'Unrelated',artistName:'Someone Else',artworkUrl100:art('other')},
   {collectionName:'Soft Focus (Deluxe Edition)',artistName:'Mira Vale',releaseDate:'2021-04-02T07:00:00Z',artworkUrl100:art('deluxe')},
   {collectionName:'Soft Focus',artistName:'Mira Vale',releaseDate:'2020-01-10T08:00:00Z',artworkUrl100:art('standard')},
   {collectionName:'Soft Focus - Single',artistName:'Mira Vale',artworkUrl100:art('standard')},
  ]:[]
  return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({resultCount:results.length,results})})
 })
 await page.route('https://is1-ssl.mzstatic.com/**',async route=>{
  const url=route.request().url();if(!url.endsWith('300x300bb.jpg'))downloads.push(url)
  const color=url.includes('deluxe')?'#3b6fd6':'#d63b6f'
  return route.fulfill({contentType:'image/jpeg',headers:{'access-control-allow-origin':'*'},body:await sharp({create:{width:120,height:120,channels:3,background:color}}).jpeg().toBuffer()})
 })
 return {searches,downloads}
}
test('the editor offers iTunes artwork beside your file and switches between them',async({page})=>{
 const {searches,downloads}=await mockItunes(page)
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 const yours=page.getByRole('button',{name:'Use your file'}),choices=page.getByRole('group',{name:'Artwork source'}).getByRole('button',{name:/^Use iTunes artwork/})
 await expect(choices).toHaveCount(2);await expect(yours).toHaveAttribute('aria-pressed','true')
 // The exact title ranks first; duplicate artwork and other artists are left out.
 await expect(choices.first()).toHaveAccessibleName('Use iTunes artwork for Soft Focus by Mira Vale');await expect(choices.first().locator('img')).toHaveAttribute('src',art('standard').replace('100x100','300x300'))
 expect(searches).toHaveLength(1);expect(searches[0].searchParams.get('entity')).toBe('album')
 const image=page.locator('.editor-artwork>img'),local=await image.getAttribute('src')
 await choices.first().click()
 await expect(choices.first()).toHaveAttribute('aria-pressed','true');await expect(yours).toHaveAttribute('aria-pressed','false')
 await expect(image).toHaveAttribute('src',/^data:image\/jpeg/);expect(downloads).toEqual([art('standard').replace('100x100','10000x10000')])
 await yours.click();await expect(yours).toHaveAttribute('aria-pressed','true');await expect(image).toHaveAttribute('src',local!)
 // The chosen source survives reopening the editor; the search comes from the cache.
 await choices.nth(1).click();await expect(choices.nth(1)).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'Close album editor'}).click();await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await expect(choices.nth(1)).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Choose a file'})).toHaveAttribute('aria-pressed','false')
 expect(searches).toHaveLength(1)
 // Typing waits for a pause before searching, and a miss says so.
 await page.getByLabel('Album title').pressSequentially('zzz');await expect(page.getByRole('status').filter({hasText:'No iTunes match'})).toBeVisible()
 expect(searches).toHaveLength(2)
 await page.getByLabel('Artist').fill('');await expect(page.getByRole('group',{name:'Artwork source'})).toHaveCount(0)
})
test('an unavailable iTunes search leaves the editor usable',async({page})=>{
 await page.route('https://itunes.apple.com/search?**',route=>route.fulfill({status:403,body:''}))
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Edit Soft Focus',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'iTunes unavailable'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Use your file'})).toHaveAttribute('aria-pressed','true')
})
