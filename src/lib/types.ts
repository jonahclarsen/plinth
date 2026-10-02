import { readable } from 'svelte/store'
import type { LogoId } from './logos'
export interface Album { id: string; title: string; artist: string; date: string; url: string; playlist: string; cover: string; original: string; enabled: boolean }
export interface Layout { columns: number; gap: number; rowGap: number|null; top: number; radius: number; roundedOnHover: boolean; shadow: number }
export interface Settings { layout: Layout; wideLayout: Layout; hoverScale: number; hoverSpeed: number; hoverEnabled: boolean; hoverInBackground: boolean; pushNeighbors: boolean; sort: string; shuffleSeed: number; shuffleDaily: boolean; theme: string; logo: LogoId; desktopEnabled: boolean; allSpaces: boolean; targetSpace: number|null }
export interface Library { albums: Album[]; settings: Settings }
export const defaultLayout: Layout = { columns: 12, gap: 6, rowGap: null, top: 42, radius: 5, roundedOnHover: false, shadow: .4 }
export const defaultSettings: Settings = { layout: {...defaultLayout}, wideLayout: {...defaultLayout, columns: 18}, hoverScale: 2.1, hoverSpeed: 1, hoverEnabled: true, hoverInBackground: true, pushNeighbors: true, sort: 'artist', shuffleSeed:0, shuffleDaily: false, theme: 'dark', logo: 'logo-1', desktopEnabled: true, allSpaces: true, targetSpace: null }
// Local calendar day; checked every minute so the order changes at midnight even after sleep.
export function localDay(date=new Date()){return Math.round(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/864e5)}
export const today=readable(localDay(),set=>{const timer=setInterval(()=>set(localDay()),60000);return ()=>clearInterval(timer)})
export function dayMask(day:number){let h=Math.imul(day^(day>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^(h>>>16))>>>0}
// Daily shuffles XOR the saved seed with a per-day mask, so toggling can keep today's order.
export function shuffleSeed(settings:Pick<Settings,'shuffleSeed'|'shuffleDaily'>,day:number){return settings.shuffleDaily?(settings.shuffleSeed^dayMask(day))>>>0:settings.shuffleSeed}
function shuffleRank(id:string,seed:number){let h=seed^2166136261;for(let i=0;i<id.length;i++){h=Math.imul(h^id.charCodeAt(i),16777619)}h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^(h>>>16))>>>0}
export function ordered(albums: Album[], sort: string, seed=0) { return [...albums].sort((a,b) => sort === 'shuffle' ? shuffleRank(a.id,seed)-shuffleRank(b.id,seed) : sort === 'date' ? b.date.localeCompare(a.date) : sort === 'oldest' ? a.date.localeCompare(b.date) : sort === 'title' ? a.title.localeCompare(b.title) : a.artist.localeCompare(b.artist) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) }
