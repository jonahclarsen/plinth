export interface Album { id: string; title: string; artist: string; date: string; url: string; cover: string; original: string; enabled: boolean }
export interface Layout { columns: number; gap: number; rowGap: number; top: number; bottom: number; radius: number; shadow: number }
export interface Settings { layout: Layout; wideLayout: Layout; hoverScale: number; hoverEnabled: boolean; dimOthers: boolean; opacity: number; sort: string; theme: string; desktopEnabled: boolean; openMode: string }
export interface Library { albums: Album[]; settings: Settings }
export const defaultLayout: Layout = { columns: 12, gap: 6, rowGap: 14, top: 42, bottom: 100, radius: 5, shadow: .4 }
export const defaultSettings: Settings = { layout: {...defaultLayout}, wideLayout: {...defaultLayout, columns: 18}, hoverScale: 2.1, hoverEnabled: true, dimOthers: false, opacity: 1, sort: 'artist', theme: 'dark', desktopEnabled: true, openMode: 'library' }
export function ordered(albums: Album[], sort: string) { return [...albums].sort((a,b) => sort === 'shuffle' ? a.id.localeCompare(b.id) : sort === 'date' ? b.date.localeCompare(a.date) : sort === 'title' ? a.title.localeCompare(b.title) : a.artist.localeCompare(b.artist) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) }
