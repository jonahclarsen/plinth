import { test, expect, type Page } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import type { Album } from '../src/lib/types'
const sharp: typeof import('sharp').default = createRequire(import.meta.url)('sharp')

// Publishing is explicit: ordinary tests never replace the approved local-library captures.
const publish = process.env.PLINTH_SCREENSHOT_PUBLISH === '1'
const libraryPath = process.env.PLINTH_SCREENSHOT_LIBRARY
const websitePath = process.env.PLINTH_SCREENSHOT_WEBSITE
const output = publish ? 'docs/screenshots' : 'test-results/readme-screenshots'

test('light-mode Collection and Stats captures', async ({ page }) => {
 if (publish && (!libraryPath || !websitePath)) throw new Error('Publishing requires explicit library and website paths')
 let count = 18
 if (libraryPath) {
  const library = JSON.parse(await readFile(libraryPath, 'utf8')) as { albums: Album[] }
  count = library.albums.length
  // Only display fields enter the isolated browser; links, playlists, history, and paths stay out.
  const albums = library.albums.map(({ id, title, artist, date, enabled }, index) => ({
   id, title, artist, date, enabled, url: '', playlist: '', original: '', cover: `/readme-cover/${index}`,
  }))
  await page.route('**/src/lib/demo.ts', route => route.fulfill({
   contentType: 'application/javascript', body: `export const demoAlbums = ${JSON.stringify(albums)}`,
  }))
  await page.route('**/readme-cover/*', async route => {
   const index = Number(new URL(route.request().url()).pathname.split('/').pop())
   const cover = library.albums[index].cover
   if (cover !== cover.split('/').pop()) throw new Error('Expected a cover filename')
   const body = await sharp(await readFile(resolve(dirname(libraryPath), 'covers', cover)))
    .resize(420, 420, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
   await route.fulfill({ contentType: 'image/webp', body })
  })
 }
 await page.emulateMedia({ colorScheme: 'light' })
 await page.setViewportSize({ width: 1550, height: 1000 })
 await page.goto('/?demo=1')
 await expect(page.locator('.album-card')).toHaveCount(count)
 await page.getByRole('button', { name: 'Settings', exact: true }).click()
 await page.getByRole('button', { name: 'Light', exact: true }).click()
 await page.keyboard.press('Escape')
 await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
 await page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all(Array.from(document.images).filter(image => image.getBoundingClientRect().top < innerHeight).map(image => image.decode()))
 })
 await mkdir(output, { recursive: true })
 await page.mouse.move(0, 0)
 const lastCard = await page.locator('.album-card').nth(Math.min(count - 1, 20)).boundingBox()
 await page.setViewportSize({ width: 1550, height: Math.ceil(lastCard!.y + lastCard!.height + 16) })
 await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
 await sharp(await page.screenshot({ animations: 'disabled' })).webp({ quality: 86, effort: 6 }).toFile(`${output}/collection.webp`)
 await page.setViewportSize({ width: 1550, height: 840 })
 await page.getByRole('button', { name: 'Stats', exact: true }).click()
 await expect(page.locator('.release-bucket').first()).toBeVisible()
 await sharp(await page.screenshot({ fullPage: true, animations: 'disabled' })).webp({ quality: 86, effort: 6 }).toFile(`${output}/stats.webp`)
})

async function openWebsite(page: Page, albumCount?: number) {
 const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }
 await page.route('http://plinth-preview.local/**', async route => {
  const pathname = new URL(route.request().url()).pathname
  const file = resolve(websitePath!, `.${pathname === '/' ? '/index.html' : pathname}`)
  if (!file.startsWith(`${resolve(websitePath!)}/`)) return route.abort()
  try {
   let body = await readFile(file)
   if (albumCount !== undefined && pathname === '/albums.js') body = Buffer.from(`${body.toString()}\nwindow.ALBUMS = window.ALBUMS.slice(0, ${albumCount})`)
   await route.fulfill({ contentType: mime[extname(file)] ?? 'application/octet-stream', body })
  } catch { await route.fulfill({ status: 404, body: '' }) }
 })
 await page.goto('http://plinth-preview.local/')
}

test('website desktop preview hero', async ({ page }) => {
 test.skip(!websitePath, 'Set PLINTH_SCREENSHOT_WEBSITE to capture the website preview')
 // Capture the website unchanged: it already contains exported local albums and their covers.
 await page.emulateMedia({ colorScheme: 'light' })
 await page.setViewportSize({ width: 1550, height: 1200 })
 await openWebsite(page)
 await expect(page.locator('#stage .cell')).toHaveCount(144)
 await page.locator('.screen').scrollIntoViewIfNeeded()
 await page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('#stage img')).map(image => image.decode()))
  const wallpaper = new Image(); wallpaper.src = '/img/wallpaper.webp'; await wallpaper.decode()
 })
 const geometry = await page.locator('#stage .cell').evaluateAll(cells => ({
  columns: cells.filter(cell => (cell as HTMLElement).style.top === (cells[0] as HTMLElement).style.top).length,
  rows: new Set(cells.map(cell => (cell as HTMLElement).style.top)).size,
 }))
 expect(geometry).toEqual({ columns: 16, rows: 9 })
 const hovered = page.getByRole('link', { name: 'Channel ORANGE by Frank Ocean', exact: true })
 await hovered.hover()
 // Let the website's enlargement and neighbor push finish before capturing the live scene.
 await expect.poll(async () => hovered.locator('img').evaluate(image => image.getBoundingClientRect().width / image.parentElement!.getBoundingClientRect().width)).toBeGreaterThan(2.4)
 await page.waitForTimeout(400)
 await mkdir(output, { recursive: true })
 await sharp(await page.locator('.screen').screenshot({ animations: 'disabled' }))
  .webp({ quality: 86, effort: 6 }).toFile(`${output}/hero.webp`)
})

for (const albumCount of [141, 3]) {
 test(`website centers ${albumCount === 3 ? 'a single' : 'an incomplete'} desktop row`, async ({ page }) => {
  test.skip(!websitePath, 'Set PLINTH_SCREENSHOT_WEBSITE to check website geometry')
  await openWebsite(page, albumCount)
  await expect(page.locator('#stage .cell')).toHaveCount(albumCount)
  const row = await page.locator('#stage .cell').evaluateAll(cells => {
   const lastTop = (cells.at(-1) as HTMLElement).style.top
   const last = cells.filter(cell => (cell as HTMLElement).style.top === lastTop) as HTMLElement[]
   const first = last[0], final = last.at(-1)!
   return { center: (parseFloat(first.style.left) + parseFloat(final.style.left) + parseFloat(final.style.width)) / 2, vertical: parseFloat(first.style.top) + parseFloat(first.style.height) / 2 }
  })
  expect(row.center).toBeCloseTo(1470 / 2, 0)
  if (albumCount === 3) expect(row.vertical).toBeCloseTo((956 + 33) / 2, 0)
 })
}
