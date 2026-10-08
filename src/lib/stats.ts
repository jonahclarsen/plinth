import type { Album } from './types'
export const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export interface Bucket { label:string; count:number }
export function libraryStats(albums:Album[]){
 const years=new Map<string,number>(),monthYears=new Map<string,number>(),decades=new Map<string,number>(),artists=new Map<string,number>()
 const yearAlbums=new Map<string,Album[]>(),monthAlbums=new Map<string,Album[]>()
 const collect=(map:Map<string,Album[]>,key:string,album:Album)=>{const group=map.get(key)??[];group.push(album);map.set(key,group)}
 let dated=0,monthly=0
 const add=(map:Map<string,number>,key:string)=>map.set(key,(map.get(key)??0)+1)
 for(const album of albums){
  const artist=album.artist.trim();if(artist)add(artists,artist)
  // Accept saved year/month precision, and reject invalid calendar dates rather than rolling them over.
  const match=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(album.date)
  if(!match||Number(match[1])===0)continue
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3])
  if(match[2]&&(month<1||month>12))continue
  const calendar=new Date(0);calendar.setUTCFullYear(year,month||1,0)
  if(match[3]&&(day<1||day>calendar.getUTCDate()))continue
  dated++;add(years,match[1]);collect(yearAlbums,match[1],album);add(decades,`${Math.floor(year/10)*10}s`)
  if(match[2]){monthly++;add(monthYears,`${match[1]}-${match[2]}`);collect(monthAlbums,`${match[1]}-${match[2]}`,album)}
 }
 const chronological=(map:Map<string,number>):Bucket[]=>[...map].sort(([a],[b])=>a.localeCompare(b)).map(([label,count])=>({label,count}))
 const ranked=[...artists].sort(([a,ac],[b,bc])=>bc-ac||a.localeCompare(b)).map(([label,count])=>({label,count}))
 return {dated,monthly,yearAlbums,monthAlbums,artists:artists.size,years:chronological(years),monthYears:chronological(monthYears),decades:chronological(decades),topArtists:ranked.slice(0,8)}
}
