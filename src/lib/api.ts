import { invoke, convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { defaultSettings, type Album, type Library, type Settings } from './types'
import { demoAlbums } from './demo'
export const native = isTauri()
let dataDir = ''
let browserLibrary: Library = { albums: new URLSearchParams(location.search).has('demo') ? demoAlbums : [], settings: structuredClone(defaultSettings) }
const listeners = new Set<(library: Library)=>void>()
function changed() { for(const listener of listeners) listener(structuredClone(browserLibrary)) }
export async function loadLibrary(): Promise<Library> {
 if (!native) return structuredClone(browserLibrary)
 const result = await invoke<{library: Library; dataDir:string}>('get_library'); dataDir=result.dataDir; return result.library
}
export function coverUrl(album: Album) { return native ? convertFileSrc(`${dataDir}/covers/${album.cover}`) : album.cover }
export async function subscribe(fn:(library: Library)=>void) { if(native) return listen<Library>('library-changed',e=>fn(e.payload)); listeners.add(fn);return ()=>{listeners.delete(fn)} }
export async function saveSettings(settings:Settings) { if(native) return invoke('save_settings',{settings}); browserLibrary.settings=structuredClone(settings);changed() }
export async function updateAlbum(album:Album) { if(native) return invoke('update_album',{album}); browserLibrary.albums=browserLibrary.albums.map(a=>a.id===album.id?album:a);changed() }
export async function removeAlbum(id:string) { if(native) return invoke('remove_album',{id}); browserLibrary.albums=browserLibrary.albums.filter(a=>a.id!==id);changed() }
export async function openAlbum(id:string) { if(native) return invoke('open_album',{id}); throw new Error('Opening Music is available in the installed Plinth app.') }
export async function chooseImages(single=false) { return invoke<string[]>('choose_images',{single}) }
export async function importPaths(paths:string[]) { return invoke<{added:number;duplicates:number;errors:string[]}>('import_images',{paths}) }
export async function importBrowserFiles(files: File[]) {
 let added=0,duplicates=0; const errors:string[]=[]
 for(const file of files) { try {
  if(!file.type.startsWith('image/')) throw new Error('Unsupported image format')
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer()); const id=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
  if(browserLibrary.albums.some(a=>a.id===id)) {duplicates++;continue}
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
  const stem=file.name.replace(/\.[^.]+$/,''); const parts=stem.split(' - ')
  browserLibrary.albums.push({id,title:parts.length>1?parts.slice(1).join(' - '):stem,artist:parts.length>1?parts[0]:'',date:'',url:'',cover:canvas.toDataURL('image/jpeg',.9),original:'',enabled:true});added++
 } catch(e) { errors.push(`${file.name}: ${String(e)}`) } }
 changed();return {added,duplicates,errors}
}

export function originalUrl(album:Album){return native?convertFileSrc(`${dataDir}/originals/${album.original}`):(album.original||album.cover)}
export async function revealArtwork(album:Album){if(native)return invoke('reveal_artwork',{id:album.id});throw new Error('Finder is available in the installed Plinth app.')}
export async function replaceArtwork(album:Album,input:string|File):Promise<Album>{
 if(native)return invoke('replace_artwork',{id:album.id,path:input})
 const file=input as File;const original=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})
 const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
 const updated={...album,cover:canvas.toDataURL('image/jpeg',.9),original};browserLibrary.albums=browserLibrary.albums.map(a=>a.id===album.id?updated:a);changed();return updated
}
export async function showAlert(message:string){if(native)await invoke('show_alert',{message});else window.alert(message)}
