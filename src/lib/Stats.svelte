<script lang="ts">
 import type { Album } from './types'
 import { libraryStats, months } from './stats'
 export let albums:Album[]=[]
 let plotWidth=0
 let grouping:'year'|'month'='year'
 $: stats=libraryStats(albums)
 $: buckets=grouping==='year'?stats.years:stats.monthYears
 $: maximum=Math.max(1,...buckets.map(b=>b.count))
 $: ticks=[...new Set([0,Math.ceil(maximum/2),maximum])]
 $: chartWidth=Math.max(650,plotWidth,buckets.length*48+60)
 $: step=(chartWidth-60)/Math.max(1,buckets.length)
 $: peak=[...stats.years].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))[0]
 const label=(date:string)=>grouping==='year'?date:`${months[Number(date.slice(5))-1]} ${date.slice(0,4)}`
</script>
<section class="stats-page" aria-label="Stats">
 <div class="stats-heading"><h1>Stats</h1><p>Your library, by release date. Includes artwork hidden from the desktop.</p></div>
 <div class="stats-summary">
  <div><strong>{albums.length}</strong><span>Albums</span></div>
  <div><strong>{stats.artists}</strong><span>Artists</span></div>
  <div><strong>{stats.years.length}</strong><span>Release years</span></div>
  <div><strong>{peak?.label??'—'}</strong><span>{peak?`Most represented year · ${peak.count} ${peak.count===1?'album':'albums'}`:'Most represented year'}</span></div>
 </div>
 {#if !albums.length}<div class="empty-state"><h2>Your collection starts here.</h2><p>Add artwork and release dates to see your stats.</p></div>
 {:else}
 <section class="panel stats-chart" aria-label="Albums by release date">
  <div class="stats-chart-heading"><div><h2>Release dates</h2><p>{grouping==='year'?stats.dated:stats.monthly} of {albums.length} albums with {grouping==='year'?'a release year':'a release month'}{grouping==='month'?' · Months with releases shown':''}</p></div><div class="stats-grouping" role="group" aria-label="Group release dates"><button aria-pressed={grouping==='year'} onclick={()=>grouping='year'}>Year</button><button aria-pressed={grouping==='month'} onclick={()=>grouping='month'}>Month + year</button></div></div>
  {#if !buckets.length}<p class="stats-empty">Add {grouping==='year'?'release dates':'release months'} in the album editor to fill this chart.</p>
  {:else}
   <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll the chart.) -->
   <div class="stats-scroll" bind:clientWidth={plotWidth} tabindex="0" role="region" aria-label="Release date chart; scroll for more dates">
    <svg class="release-chart" width={chartWidth} height="265" viewBox={`0 0 ${chartWidth} 265`} role="img" aria-label={`Albums by release ${grouping}`}>
     <defs><linearGradient id="stats-bars" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)"/><stop offset="1" stop-color="#72bab5" stop-opacity=".55"/></linearGradient></defs>
     {#each ticks as count}<line x1="40" x2={chartWidth-10} y1={205-count/maximum*160} y2={205-count/maximum*160} stroke="var(--line)" stroke-dasharray={count?'3 5':undefined}/><text x="26" y={209-count/maximum*160} text-anchor="end">{count}</text>{/each}
     {#each buckets as bucket,index}
      <g aria-label={`${label(bucket.label)}: ${bucket.count} ${bucket.count===1?'album':'albums'}`}><title>{label(bucket.label)}: {bucket.count} {bucket.count===1?'album':'albums'}</title><rect x={40+index*step+step*.22} y={205-bucket.count/maximum*160} width={step*.56} height={bucket.count/maximum*160} rx="4" fill="url(#stats-bars)"/><text class="bar-count" x={40+(index+.5)*step} y={195-bucket.count/maximum*160} text-anchor="middle">{bucket.count}</text><text x={40+(index+.5)*step} y="228" text-anchor="middle">{grouping==='year'?bucket.label:months[Number(bucket.label.slice(5))-1]}</text>{#if grouping==='month'}<text x={40+(index+.5)*step} y="246" text-anchor="middle">{bucket.label.slice(0,4)}</text>{/if}</g>
     {/each}
    </svg>
   </div>
  {/if}
 </section>
 <div class="stats-details">
  {#each [{title:'Decades',items:stats.decades,empty:'Add release dates to see your decades.'},{title:'Most represented artists',items:stats.topArtists,empty:'Add artist names to see your favorites.'}] as chart}
   <section class="panel stats-ranking" aria-label={chart.title}><h2>{chart.title}</h2>{#if !chart.items.length}<p class="stats-empty">{chart.empty}</p>{:else}<ol>{#each chart.items as bucket}<li><div><span>{bucket.label}</span><strong>{bucket.count}</strong></div><div class="stats-track" aria-hidden="true"><span style:width={`${bucket.count/Math.max(...chart.items.map(b=>b.count))*100}%`}></span></div></li>{/each}</ol>{/if}</section>
  {/each}
 </div>
 {/if}
</section>
