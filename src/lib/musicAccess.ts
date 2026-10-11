export type Access = 'allowed' | 'denied' | 'not-requested' | 'not-running' | 'unknown'
export interface Permission { id: 'music' | 'system-events' | 'accessibility'; title: string; detail: string; access: Access }
export interface MusicAccess { subject: string; permissions: Permission[] }

const music: Permission = { id: 'music', title: 'Control Music', detail: 'Automation · finds items in your library', access: 'denied' }
// Browser preview of the native window: `?access=1` for a playlist, `?access=artist` for every row.
export function musicAccessDemo(kind: string): MusicAccess {
 if (kind !== 'artist') return { subject: 'the playlist “Evening records”', permissions: [music] }
 return { subject: 'the artist “Fictional Quartet”', permissions: [
  { ...music, access: 'allowed' },
  { id: 'system-events', title: 'Control System Events', detail: 'Automation · uses Music’s Song menu', access: 'not-requested' },
  { id: 'accessibility', title: 'Accessibility', detail: 'Lets Plinth click Show Artist in Library', access: 'denied' },
 ] }
}
