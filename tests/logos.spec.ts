import { test, expect } from '@playwright/test'
import { defaultSettings } from '../src/lib/types'

test('all three logos update the header and browser icons without resetting other settings', async ({ page }) => {
 await page.goto('/?demo=1')
 await page.getByRole('button', { name: 'Settings', exact: true }).click()
 await page.getByRole('button', { name: 'Light', exact: true }).click()
 const choices = page.getByRole('group', { name: 'App logo', exact: true })
 await expect(choices.getByRole('button')).toHaveCount(3)
 for (const id of [2, 3, 1]) {
  await choices.getByRole('button', { name: `Logo ${id}`, exact: true }).click()
  await expect(choices.getByRole('button', { pressed: true })).toHaveAccessibleName(`Logo ${id}`)
  await expect(page.locator('.brand image')).toHaveAttribute('href', `/logos/logo-${id}.png`)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', `/logos/logo-${id}.png`)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', `/logos/logo-${id}.png`)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const asset = await page.request.get(`/logos/logo-${id}.png`)
  expect(asset.ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Collection', exact: true }).click()
  await expect(page.locator('.album-card')).toHaveCount(18)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(choices.getByRole('button', { name: `Logo ${id}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
 }
})

test('native logo selection is saved and restored on relaunch and survives hiding the window', async ({ page }) => {
 await page.addInitScript((settings) => {
  let next = 1
  Object.assign(window, { isTauri: true, __TAURI_INTERNALS__: {
   metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
   transformCallback: () => next++, unregisterCallback: () => {},
   invoke: async (command: string, args: Record<string, any> = {}) => {
    if (command === 'get_library') return { dataDir: '/synthetic-demo', library: { albums: [], settings: JSON.parse(localStorage.getItem('test-settings') || JSON.stringify(settings)) } }
    if (command === 'save_settings') localStorage.setItem('test-settings', JSON.stringify(args.settings))
    if (command === 'get_displays') return []
    if (command === 'plugin:event|listen') return next++
    if (command === 'hide_window') localStorage.setItem('test-hidden', 'true')
    return null
   },
  }, __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} } })
 }, defaultSettings)
 await page.goto('/')
 await page.getByRole('button', { name: 'Settings', exact: true }).click()
 await page.getByRole('button', { name: 'Logo 3', exact: true }).click()
 // Hide immediately to exercise the settings flush before the debounce fires.
 await page.keyboard.press('Control+w')
 await expect.poll(() => page.evaluate(() => localStorage.getItem('test-hidden'))).toBe('true')
 await page.reload()
 await expect(page.locator('.brand image')).toHaveAttribute('href', '/logos/logo-3.png')
 await page.getByRole('button', { name: 'Settings', exact: true }).click()
 await expect(page.getByRole('button', { name: 'Logo 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
