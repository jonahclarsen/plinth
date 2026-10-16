// Album artwork from Apple's free iTunes Search API (no key; roughly 20 requests a minute per client).
export interface ArtworkMatch { title: string; artist: string; year: string; thumbnail: string; full: string }
interface Result { collectionName?: string; artistName?: string; releaseDate?: string; artworkUrl100?: string }
const cache = new Map<string, Promise<ArtworkMatch[]>>()
// Lowercase without accents or punctuation; dropping bracketed edition notes lets "In Rainbows (Deluxe)" match "in rainbows".
export function normalize(text: string, notes = false) { const plain = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return (notes ? plain : plain.replace(/\s*[([][^)\]]*[)\]]/g, '')).replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() }
// An exact name beats one that differs only by an edition note, which beats one containing the other's whole words.
function closeness(wanted: string, found: string) { const a = normalize(wanted), b = normalize(found); return !a || !b ? 0 : normalize(wanted, true) === normalize(found, true) ? 3 : a === b ? 2 : ` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `) ? 1 : 0 }
// Apple's image server renders any requested size up to the source, so a huge request returns the full-resolution JPEG.
export function artworkSize(url: string, size: number) { return url.replace(/\/[^/]+$/, `/${size}x${size}bb.jpg`) }
function storefront() { try { const region = new Intl.Locale(navigator.language).maximize().region; return region && /^[A-Z]{2}$/.test(region) ? region : 'US' } catch { return 'US' } }
export function rank(results: Result[], artist: string, title: string, limit = 3): ArtworkMatch[] {
 const seen = new Set<string>()
 return results.flatMap((r, index) => {
  if (!r.artworkUrl100 || !r.collectionName || !r.artistName) return []
  const titleScore = closeness(title, r.collectionName), artistScore = closeness(artist, r.artistName)
  if (!titleScore || !artistScore) return []
  return [{ score: titleScore * 2 + artistScore, index, match: { title: r.collectionName, artist: r.artistName, year: r.releaseDate?.slice(0, 4) ?? '', thumbnail: artworkSize(r.artworkUrl100, 300), full: artworkSize(r.artworkUrl100, 10000) } }]
 }).sort((a, b) => b.score - a.score || a.index - b.index).flatMap(({ match }) => {
  // Clean and explicit releases share a name but not an image URL; keep only the first of each.
  const name = `${normalize(match.title, true)}\n${normalize(match.artist, true)}`
  if (seen.has(match.full) || seen.has(name)) return []
  seen.add(match.full); seen.add(name); return [match]
 }).slice(0, limit)
}
export function searchArtwork(artist: string, title: string): Promise<ArtworkMatch[]> {
 const key = `${normalize(artist)}\n${normalize(title)}`
 let pending = cache.get(key)
 if (!pending) {
  const params = new URLSearchParams({ term: `${artist} ${title}`, media: 'music', entity: 'album', limit: '25', country: storefront() })
  pending = fetch(`https://itunes.apple.com/search?${params}`).then(async response => {
   if (!response.ok) throw new Error(`iTunes search returned ${response.status}`)
   return rank((await response.json()).results ?? [], artist, title)
  })
  // Forget failures so a later edit can try again.
  pending.catch(() => cache.delete(key))
  cache.set(key, pending)
 }
 return pending
}
