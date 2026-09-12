<script lang="ts">
 export let keys:string[]=[]
</script>
<kbd class="shortcut" aria-hidden="true">{#each keys as key,index}{#if index}{' '}<svg class="shortcut-plus" width="6" height="6" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 1.6v6.8M1.6 5h6.8"/></svg>{' '}{/if}<span>{key}</span>{/each}</kbd>
