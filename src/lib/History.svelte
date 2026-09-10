<script lang="ts">
 import Icon from './Icon.svelte'
 import type { HistoryView } from './history'
 export let history:HistoryView
 export let busy=false
 export let loading=false
 export let undo:()=>void
 export let redo:()=>void
 export let restore:(id:number)=>void
 const date=(timestamp:number)=>new Date(timestamp).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})
</script>
<section class="history-page" aria-label="History">
 <div class="history-heading"><div><h1>History</h1><p>Every saved change to your collection and settings.</p></div><div class="history-controls"><button aria-label="Undo" aria-keyshortcuts="Meta+Z Control+Z" onclick={undo} disabled={busy||!history.canUndo}><Icon name="undo"/>Undo<kbd>Cmd Z</kbd></button><button aria-label="Redo" aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z" onclick={redo} disabled={busy||!history.canRedo}><Icon name="redo"/>Redo<kbd>Shift Cmd Z</kbd></button></div></div>
 {#if loading&&history.entries.length===0}<p class="history-note">Loading history…</p>
 {:else}
 <p class="history-note">{history.entries.length} saved {history.entries.length===1?'state':'states'} · Restoring a state includes its albums, artwork, and settings. Later states stay here.</p>
 <ol class="history-list" reversed>
 {#each [...history.entries].reverse() as entry (entry.id)}
  <li class:current={entry.id===history.current} aria-current={entry.id===history.current?'step':undefined}>
   <div class="history-marker"><Icon name={entry.id===history.current?'check':'history'}/></div>
   <div class="history-content"><div class="history-entry-heading"><h2>{entry.label}</h2>{#if entry.id===history.current}<span class="history-current">Current</span>{/if}</div><div class="history-meta"><time datetime={new Date(entry.timestamp).toISOString()}>{date(entry.timestamp)}</time><span>State {entry.id+1}</span><span>{entry.albumCount} {entry.albumCount===1?'album':'albums'}</span>{#if entry.parent!==null}<span>From state {entry.parent+1}</span>{/if}</div>{#if entry.details.length===1}<p class="history-detail">{entry.details[0]}</p>{:else}<details><summary>{entry.details.length} changes</summary><ul>{#each entry.details as detail}<li>{detail}</li>{/each}</ul></details>{/if}</div>
   <button class="history-restore" aria-label={`Restore state ${entry.id+1}`} onclick={()=>restore(entry.id)} disabled={busy||entry.id===history.current}><Icon name="history"/>Restore</button>
  </li>
 {/each}
 </ol>
 {/if}
</section>
