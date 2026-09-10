import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
const mark='<path d="M6 6h12v8H6zM4 18h16M8 14v4m8-4v4" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 24 24"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ad7cdf"/><stop offset="1" stop-color="#4299a0"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="5" fill="#201b2a"/><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#g)" opacity=".25"/>${mark}</svg>`
await sharp(Buffer.from(svg)).png().toFile('src-tauri/icons/icon.png')
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24">${mark.replace('white','black')}</svg>`)).png().toFile('src-tauri/icons/tray.png')
await mkdir('src-tauri/icons/icon.iconset',{recursive:true})
for(const size of [16,32,128,256,512]) for(const scale of [1,2]) await sharp(Buffer.from(svg)).resize(size*scale).png().toFile(`src-tauri/icons/icon.iconset/icon_${size}x${size}${scale===2?'@2x':''}.png`)
await writeFile('public/plinth.svg',svg)
