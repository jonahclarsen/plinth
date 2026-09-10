import type { Library } from './types'
export interface HistoryEntry { id:number; parent:number|null; timestamp:number; label:string; details:string[]; albumCount:number }
export interface HistoryView { entries:HistoryEntry[]; current:number; canUndo:boolean; canRedo:boolean }
export const emptyHistory:HistoryView={entries:[],current:0,canUndo:false,canRedo:false}
const display=(value:unknown)=>value===null?'Automatic':value===''?'Empty':value===true?'On':value===false?'Off':String(value)
function describe(before:Library,after:Library) {
 const details:string[]=[],labels:string[]=[]
 let added=0,removed=0,edited=0,artwork=0
 for(const album of after.albums){
  const old=before.albums.find(a=>a.id===album.id)
  if(!old){added++;details.push(`Added ${album.title} — ${album.artist}`);continue}
  let changed=false
  for(const [key,label] of [['title','Title'],['artist','Artist'],['date','Release date'],['url','Album link'],['enabled','Show on desktop']] as const){
   if(old[key]!==album[key]){changed=true;details.push(`${old.title} · ${label}: ${display(old[key])} → ${display(album[key])}`)}
  }
  if(changed)edited++
  if(old.cover!==album.cover||old.original!==album.original){artwork++;details.push(`${album.title} · Replaced artwork`)}
 }
 for(const album of before.albums)if(!after.albums.some(a=>a.id===album.id)){removed++;details.push(`Removed ${album.title} — ${album.artist}`)}
 if(added)labels.push(`Added ${added} album${added===1?'':'s'}`)
 if(removed)labels.push(`Removed ${removed} album${removed===1?'':'s'}`)
 if(edited)labels.push(edited===1?'Edited album':`Edited ${edited} albums`)
 if(artwork)labels.push('Replaced artwork')
 const settings:string[]=[]
 const space=(settings:Library['settings'])=>settings.targetSpace?`Space ${settings.targetSpace}`:settings.allSpaces?'All Spaces':'This Space'
 if(space(before.settings)!==space(after.settings))settings.push(`Spaces: ${space(before.settings)} → ${space(after.settings)}`)
 for(const [key,label] of [['theme','App appearance'],['logo','App logo'],['desktopEnabled','Show desktop'],['openMode','Music behavior'],['sort','Sort order'],['shuffleSeed','Shuffle order'],['hoverScale','Hover size'],['hoverEnabled','Enlarge on hover']] as const){
  if(before.settings[key]!==after.settings[key])settings.push(`${label}: ${display(before.settings[key])} → ${display(after.settings[key])}`)
 }
 for(const [profile,name] of [['layout','Mac display'],['wideLayout','4K monitor']] as const){
  for(const [key,label] of [['columns','Columns'],['gap','Space between covers'],['rowGap','Space between rows'],['top','Top clearance'],['radius','Rounded corners'],['shadow','Shadow']] as const){
   if(before.settings[profile][key]!==after.settings[profile][key])settings.push(`${name} · ${label}: ${display(before.settings[profile][key])} → ${display(after.settings[profile][key])}`)
  }
 }
 if(settings.length)labels.push('Changed settings')
 return {label:labels.join(' · ')||'Updated collection',details:[...details,...settings]}
}
export class BrowserHistory {
 private entries:(HistoryEntry&{state:Library})[]
 private current=0
 private redo:number[]=[]
 constructor(library:Library){this.entries=[{id:0,parent:null,timestamp:Date.now(),label:'Starting state',details:['History begins with this collection and its settings.'],albumCount:library.albums.length,state:structuredClone(library)}]}
 record(library:Library){
  const before=this.entries[this.current].state
  if(JSON.stringify(before)===JSON.stringify(library))return
  const id=this.entries.length
  this.entries.push({id,parent:this.current,timestamp:Date.now(),...describe(before,library),albumCount:library.albums.length,state:structuredClone(library)})
  this.current=id;this.redo=[]
 }
 view():HistoryView{return {entries:this.entries.map(({state,...entry})=>structuredClone(entry)),current:this.current,canUndo:this.entries[this.current].parent!==null,canRedo:this.redo.length>0}}
 navigate(action:'undo'|'redo'|'restore',id?:number):Library{
  if(action==='undo'){
   const parent=this.entries[this.current].parent
   if(parent===null)throw new Error('Nothing to undo')
   this.redo.push(this.current);this.current=parent
  }else if(action==='redo'){
   const next=this.redo.pop();if(next===undefined)throw new Error('Nothing to redo');this.current=next
  }else{
   if(id===undefined||!this.entries[id])throw new Error('History state not found')
   let cursor=this.current;const route:number[]=[]
   while(cursor!==id){route.push(cursor);const parent=this.entries[cursor].parent;if(parent===null)break;cursor=parent}
   if(cursor===id)this.redo.push(...route);else {const position=this.redo.indexOf(id);this.redo=position<0?[]:this.redo.slice(0,position)}
   this.current=id
  }
  return structuredClone(this.entries[this.current].state)
 }
}
