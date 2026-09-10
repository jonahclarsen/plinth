<script lang="ts">
 export let name = 'grid'
 const paths:Record<string,string> = {
  download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',replace:'M4 10a8 8 0 0 1 13-6l3 3m0-5v5h-5M20 14a8 8 0 0 1-13 6l-3-3m0 5v-5h5',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  monitor:'M3 4h18v13H3zM8 21h8m-4-4v4',plus:'M12 5v14M5 12h14',folder:'M3 7V5h6l2 2h10v13H3V7Z',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',close:'m6 6 12 12M6 18 18 6',
  arrow:'M5 12h14m-6-6 6 6-6 6',check:'m5 12 4 4L19 6',sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings:'M4 7h16M4 17h16M8 4v6m8 4v6',music:'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm11-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z',
  play:'m8 4 12 8-12 8V4Z',pause:'M8 5v14M16 5v14',upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
  trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  cursor:'m5 3 14 10-7 1-3 7L5 3Z',info:'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  plinth:'M6 5h12v9H6zM4 19h16M8 14v5m8-5v5',chevron:'m8 10 4 4 4-4'
 }
</script>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name] || paths.grid}/></svg>
