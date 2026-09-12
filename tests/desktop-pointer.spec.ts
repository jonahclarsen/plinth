import { test, expect } from '@playwright/test'
import { demoAlbums } from '../src/lib/demo'
import { defaultSettings } from '../src/lib/types'

for (const builtIn of [false, true]) for(const hoverInBackground of [false,true]) {
 test(`native pointer events stay on their display (${builtIn ? 'Mac' : '4K'}, background=${hoverInBackground})`, async ({ page }) => {
  await page.setViewportSize({ width: builtIn ? 1512 : 1920, height: 1080 })
  await page.addInitScript(({ albums, settings, builtIn }) => {
   const callbacks = new Map<number, (event: unknown) => void>()
   const listeners: { event: string; handler: number; target: { kind: string; label?: string } }[] = []
   const opened: string[] = []
   let next = 1
   Object.assign(window, {
    isTauri: true,
    __TAURI_INTERNALS__: {
     metadata: { currentWindow: { label: 'desktop-test' }, currentWebview: { label: 'desktop-test' } },
     transformCallback: (fn: (event: unknown) => void) => { const id = next++; callbacks.set(id, fn); return id },
     unregisterCallback: (id: number) => callbacks.delete(id),
     convertFileSrc: (path: string) => path.slice(path.indexOf('data:image/')),
     invoke: async (command: string, args: any = {}) => {
      if (command === 'get_library') return { dataDir: '/synthetic-demo', library: { albums, settings } }
      if (command === 'get_displays') return [{ id: 1, width: 3840, height: 2160, logicalWidth: window.innerWidth, logicalHeight: 1080, builtIn, current: true, remembered: false }]
      if (command === 'plugin:event|listen') { listeners.push(args); return next++ }
      if (command === 'open_album') opened.push(args.id)
      return null
     }
    },
    __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
    opened,
   })
   window.addEventListener('test-pointer', event => {
    const { label, ...payload } = (event as CustomEvent).detail
    // Tauri global listeners receive targeted events too; the listener must
    // explicitly opt into its own WebviewWindow target.
    for (const listener of listeners.filter(l => l.event === 'desktop-pointer')) {
     if (listener.target.kind === 'Any' || listener.target.label === label) {
      callbacks.get(listener.handler)?.({ event: listener.event, id: listener.handler, payload })
     }
    }
   })
  }, { albums: demoAlbums, settings: {...defaultSettings,hoverInBackground}, builtIn })
  await page.goto('/?desktop=1')
  const cells = page.locator('.desktop-cell')
  await expect(cells).toHaveCount(demoAlbums.length)
  await expect(page.locator('.desktop-grid')).toHaveCSS('--columns', String((builtIn ? defaultSettings.layout : defaultSettings.wideLayout).columns))
  const box = (await cells.first().boundingBox())!
  const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2, visible: true }
  const emit = async (label: string, visible: boolean, foregroundAllowed=true) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('test-pointer', { detail })), { ...pointer, label, visible, foregroundAllowed })
  await emit('desktop-other', true)
  await expect(page.locator('.enlarged')).toHaveCount(0)
  await emit('desktop-test', true)
  await expect(cells.first().locator('button')).toHaveClass(/enlarged/)
  await emit('desktop-other', false)
  await expect(cells.first().locator('button')).toHaveClass(/enlarged/)
  await page.mouse.click(pointer.x, pointer.y)
  await expect.poll(() => page.evaluate(() => (window as any).opened)).toEqual([await cells.first().getAttribute('data-id')])
  await emit('desktop-test', true, false)
  await expect(page.locator('.enlarged')).toHaveCount(hoverInBackground?1:0)
  await emit('desktop-test', true, true)
  await expect(cells.first().locator('button')).toHaveClass(/enlarged/)
  await emit('desktop-test', false)
  await expect(page.locator('.enlarged')).toHaveCount(0)
 })
}
