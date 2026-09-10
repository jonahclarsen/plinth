import sharp from 'sharp'
import { copyFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

// Keep the supplied artwork intact; only resize and pad for each icon surface.
await mkdir('public/logos', { recursive: true })
await mkdir('src-tauri/icons', { recursive: true })
for (const [id, source] of [[1, 'logo_1.png'], [2, 'logo_2.svg'], [3, 'logo_3.png']]) {
  const png = await sharp(`assets/logos/${source}`)
    .resize(1024, 1024, { fit: 'contain', background: '#00000000' })
    .png().toBuffer()
  await sharp(png).toFile(`public/logos/logo-${id}.png`)
  await sharp(png).resize(44, 44).toFile(`src-tauri/icons/tray-${id}.png`)
  if (id === 1) {
    await copyFile(`public/logos/logo-${id}.png`, 'src-tauri/icons/icon.png')
    await mkdir('src-tauri/icons/icon.iconset', { recursive: true })
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        await sharp(png).resize(size * scale).toFile(`src-tauri/icons/icon.iconset/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)
      }
    }
  }
}
execFileSync('iconutil', ['-c', 'icns', 'src-tauri/icons/icon.iconset', '-o', 'src-tauri/icons/icon.icns'])
