export const logos = [
 { id: 'logo-1', label: 'Logo 1' },
 { id: 'logo-2', label: 'Logo 2' },
 { id: 'logo-3', label: 'Logo 3' },
] as const
export type LogoId = typeof logos[number]['id']
export function logoUrl(id: LogoId) { return `/logos/${id}.png` }
