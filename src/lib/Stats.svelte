<script lang="ts">
 import { coverUrl } from './api'
 import type { Album } from './types'
 import { libraryStats, months } from './stats'
 export let albums:Album[]=[]
 let plotWidth=0
 let hoveredKey=''
 let progress=0
 let chart:HTMLDivElement
 const chartHeight=265,peekWidth=74,stride=64
 function clearPeek(){hoveredKey='';progress=0}
 function hoverBucket(key:string,event:PointerEvent){
  hoveredKey=key
  const rect=chart.getBoundingClientRect()
  // Moving upward along a date's column reveals later albums in that group.
  progress=Math.max(0,Math.min(1,(205-(event.clientY-rect.top))/190))
 }
 function focusBucket(key:string){hoveredKey=key;progress=0}
 function browseBucket(key:string,event:KeyboardEvent){
  if(event.key==='Escape'){clearPeek();return}
  if(['ArrowUp','ArrowDown','Home','End','Enter',' '].includes(event.key)){
   event.preventDefault();hoveredKey=key
   const distance=1/Math.max(1,hoveredAlbums.length-4)
   progress=event.key==='Home'?0:event.key==='End'?1:event.key==='ArrowUp'?Math.min(1,progress+distance):event.key==='ArrowDown'?Math.max(0,progress-distance):progress
  }
 }
 let grouping:'year'|'month'='year'
 $: stats=libraryStats(albums)
 $: buckets=grouping==='year'?stats.years:stats.monthYears
 $: maximum=Math.max(1,...buckets.map(b=>b.count))
 $: ticks=[...new Set([0,Math.ceil(maximum/2),maximum])]
 $: chartWidth=Math.max(120,plotWidth)
 $: step=(chartWidth-60)/Math.max(1,buckets.length)
 $: datedCount=grouping==='year'?stats.dated:stats.monthly
 $: labelEvery=Math.max(1,Math.ceil(buckets.length/Math.max(1,Math.floor((chartWidth-60)/(grouping==='year'?42:58)))))
 $: hoveredIndex=buckets.findIndex(bucket=>bucket.label===hoveredKey)
 $: hoveredAlbums=(grouping==='year'?stats.yearAlbums:stats.monthAlbums).get(hoveredKey)??[]
 $: peekOffset=progress*Math.max(0,hoveredAlbums.length-4)*stride
 $: firstPeek=Math.max(0,Math.floor(peekOffset/stride)-1)
 $: visiblePeek=hoveredAlbums.slice(firstPeek,firstPeek+7)
 $: barCenter=40+(hoveredIndex+.5)*step
 $: peekLeft=Math.max(0,Math.min(chartWidth-peekWidth,barCenter+step*.28+8+peekWidth<chartWidth?barCenter+step*.28+8:barCenter-step*.28-8-peekWidth))
 $: peak=[...stats.years].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))[0]
 const label=(date:string)=>grouping==='year'?date:`${months[Number(date.slice(5))-1]} ${date.slice(0,4)}`
</script>
<section class="stats-page" aria-label="Stats">
 <div class="stats-summary">
  <div><strong>{albums.length}</strong><span>Albums</span></div>
  <div><strong>{stats.artists}</strong><span>Artists</span></div>
  <div><strong>{stats.years.length}</strong><span>Release years</span></div>
  <div><strong>{peak?.label??'—'}</strong><span>{peak?`Most represented year · ${peak.count} ${peak.count===1?'album':'albums'}`:'Most represented year'}</span></div>
 </div>
 {#if !albums.length}<div class="empty-state"><h2>Your collection starts here.</h2><p>Add artwork and release dates to see your stats.</p></div>
 {:else}
 <section class="panel stats-chart" aria-label="Albums by release date">
  <div class="stats-chart-heading"><div><h2>Release dates</h2><p>{#if datedCount===albums.length}{datedCount} {datedCount===1?'album':'albums'}{:else}{datedCount} of {albums.length} albums with {grouping==='year'?'a release year':'a release month'}{/if}</p></div><div class="stats-grouping" role="group" aria-label="Group release dates"><button aria-pressed={grouping==='year'} onclick={()=>{grouping='year';clearPeek()}}>Year</button><button aria-pressed={grouping==='month'} onclick={()=>{grouping='month';clearPeek()}}>Month + year</button></div></div>
  {#if !buckets.length}<p class="stats-empty">Add {grouping==='year'?'release dates':'release months'} in the album editor to fill this chart.</p>
  {:else}
   <div class="stats-plot" bind:this={chart} bind:clientWidth={plotWidth} onpointerleave={clearPeek} role="group" aria-label="Release date chart">
    <svg class="release-chart" width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="group" aria-label={`Albums by release ${grouping}`}>
     <defs><linearGradient id="stats-bars" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--accent)"/><stop offset="1" stop-color="#72bab5" stop-opacity=".55"/></linearGradient></defs>
     {#each ticks as count}<line x1="40" x2={chartWidth-10} y1={205-count/maximum*160} y2={205-count/maximum*160} stroke="var(--line)" stroke-dasharray={count?'3 5':undefined}/><text x="26" y={209-count/maximum*160} text-anchor="end">{count}</text>{/each}
     {#each buckets as bucket,index}
      <g class="release-bucket" class:peeked={hoveredKey===bucket.label} role="button" tabindex="0" aria-label={`${label(bucket.label)}: ${bucket.count} ${bucket.count===1?'album':'albums'}`} aria-describedby={hoveredKey===bucket.label?'release-artwork-preview':undefined} onpointermove={(event)=>hoverBucket(bucket.label,event)} onfocus={()=>focusBucket(bucket.label)} onblur={clearPeek} onkeydown={(event)=>browseBucket(bucket.label,event)} onclick={()=>focusBucket(bucket.label)}>
       <rect class="release-bar" x={40+index*step+step*.18} y={205-bucket.count/maximum*160} width={step*.64} height={bucket.count/maximum*160} rx={Math.min(4,step*.2)} fill="url(#stats-bars)"/>
       {#if step>=20||index===hoveredIndex}<text class="bar-count" x={40+(index+.5)*step} y={195-bucket.count/maximum*160} text-anchor="middle">{bucket.count}</text>{/if}
       {#if index===hoveredIndex||(index%labelEvery===0&&(hoveredIndex<0||Math.abs(index-hoveredIndex)>=labelEvery*.8))}<text x={Math.max(52,Math.min(chartWidth-24,40+(index+.5)*step))} y="228" text-anchor="middle">{grouping==='year'?bucket.label:months[Number(bucket.label.slice(5))-1]}</text>{#if grouping==='month'}<text x={Math.max(52,Math.min(chartWidth-24,40+(index+.5)*step))} y="246" text-anchor="middle">{bucket.label.slice(0,4)}</text>{/if}{/if}
       <rect class="release-hit" x={40+index*step} y="8" width={step} height="245" fill="transparent"/>
      </g>
     {/each}
    </svg>
    {#if hoveredIndex>=0&&hoveredAlbums.length}
     <div class="stats-peek" id="release-artwork-preview" role="tooltip" aria-label={`${label(hoveredKey)} artwork`} style:left={`${peekLeft}px`}>
      <div class="stats-peek-window">
       {#each visiblePeek as album,index (album.id)}
        <div class="stats-peek-cover" style:top={`${4+(firstPeek+index)*stride-peekOffset}px`}><img src={coverUrl(album)} alt={`${album.title} by ${album.artist||'Unknown artist'}`} draggable="false" style:animation-delay={`${-(firstPeek+index)*1.37}s`}/></div>
       {/each}
      </div>
     </div>
    {/if}
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
