import { test, expect } from '@playwright/test'
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

test('website desktop preview hero', async ({ page }) => {
 test.skip(!websitePath, 'Set PLINTH_SCREENSHOT_WEBSITE to capture the website preview')
 if (publish && !libraryPath) throw new Error('Publishing the hero requires the local library')
 const library = libraryPath ? JSON.parse(await readFile(libraryPath, 'utf8')) as { albums: Album[] } : undefined
 const albums = library?.albums.filter(album => album.enabled)
 const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }
 await page.route('http://plinth-preview.local/**', async route => {
  const pathname = new URL(route.request().url()).pathname
  if (albums && pathname === '/') {
   let columns = 16
   // Keep positive row clearance when the current collection exceeds the website's 144 covers.
   while (Math.ceil(albums.length / columns) * ((1470 - 12 - (columns - 1)) / columns) > 956 - 88 + 33) columns++
   const html = (await readFile(resolve(websitePath!, 'index.html'), 'utf8')).replace('COLS=16', `COLS=${columns}`)
   return route.fulfill({ contentType: 'text/html', body: html })
  }
  if (albums && pathname === '/albums.js') return route.fulfill({
   contentType: 'application/javascript', body: `window.ALBUMS = ${JSON.stringify(albums.map(({ title, artist }) => [title, artist]))}`,
  })
  if (albums && /^\/covers\/\d+\.webp$/.test(pathname)) {
   const index = Number(pathname.match(/\d+/)![0])
   const cover = albums[index]?.cover
   if (!cover || cover !== cover.split('/').pop()) return route.abort()
   const body = await sharp(await readFile(resolve(dirname(libraryPath!), 'covers', cover)))
    .resize(420, 420, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer()
   return route.fulfill({ contentType: 'image/webp', body })
  }
  const file = resolve(websitePath!, `.${pathname === '/' ? '/index.html' : pathname}`)
  if (!file.startsWith(`${resolve(websitePath!)}/`)) return route.abort()
  try { await route.fulfill({ contentType: mime[extname(file)] ?? 'application/octet-stream', body: await readFile(file) }) }
  catch { await route.fulfill({ status: 404, body: '' }) }
 })
 await page.emulateMedia({ colorScheme: 'light' })
 await page.setViewportSize({ width: 1550, height: 1200 })
 await page.goto('http://plinth-preview.local/')
 await expect(page.locator('#stage .cell').first()).toBeVisible()
 await page.locator('.screen').scrollIntoViewIfNeeded()
 await page.evaluate(async () => {
  await document.fonts.ready
  await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('#stage img')).map(image => image.decode()))
  const wallpaper = new Image(); wallpaper.src = '/img/wallpaper.webp'; await wallpaper.decode()
 })
 if (albums) await expect(page.locator('#stage .cell')).toHaveCount(albums.length)
 const featured = albums?.findIndex(album => album.title.toLowerCase() === 'channel orange') ?? -1
 const hovered = page.locator('#stage .cell').nth(featured >= 0 ? featured : 71)
 await hovered.hover()
 // Let the website's enlargement and neighbor push finish before capturing the live scene.
 await expect.poll(async () => hovered.locator('img').evaluate(image => image.getBoundingClientRect().width / image.parentElement!.getBoundingClientRect().width)).toBeGreaterThan(2.4)
 await page.waitForTimeout(400)
 await mkdir(output, { recursive: true })
 await sharp(await page.locator('.screen').screenshot({ animations: 'disabled' }))
  .webp({ quality: 86, effort: 6 }).toFile(`${output}/hero.webp`)
})
