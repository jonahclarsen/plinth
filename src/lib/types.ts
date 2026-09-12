import type { LogoId } from './logos'
export interface Album { id: string; title: string; artist: string; date: string; url: string; cover: string; original: string; enabled: boolean }
export interface Layout { columns: number; gap: number; rowGap: number|null; top: number; radius: number; shadow: number }
export interface Settings { layout: Layout; wideLayout: Layout; hoverScale: number; hoverSpeed: number; hoverEnabled: boolean; sort: string; shuffleSeed: number; theme: string; logo: LogoId; desktopEnabled: boolean; allSpaces: boolean; targetSpace: number|null; openMode: string }
export interface Library { albums: Album[]; settings: Settings }
export const defaultLayout: Layout = { columns: 12, gap: 6, rowGap: null, top: 42, radius: 5, shadow: .4 }
export const defaultSettings: Settings = { layout: {...defaultLayout}, wideLayout: {...defaultLayout, columns: 18}, hoverScale: 2.1, hoverSpeed: 1, hoverEnabled: true, sort: 'artist', shuffleSeed:0, theme: 'dark', logo: 'logo-1', desktopEnabled: true, allSpaces: true, targetSpace: null, openMode: 'library' }
function shuffleRank(id:string,seed:number){let h=seed^2166136261;for(let i=0;i<id.length;i++){h=Math.imul(h^id.charCodeAt(i),16777619)}h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^(h>>>16))>>>0}
export function ordered(albums: Album[], sort: string, seed=0) { return [...albums].sort((a,b) => sort === 'shuffle' ? shuffleRank(a.id,seed)-shuffleRank(b.id,seed) : sort === 'date' ? b.date.localeCompare(a.date) : sort === 'oldest' ? a.date.localeCompare(b.date) : sort === 'title' ? a.title.localeCompare(b.title) : a.artist.localeCompare(b.artist) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) }
