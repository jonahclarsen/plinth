<script lang="ts">
 import { logoUrl, type LogoId } from './logos'
 export let logo: LogoId = 'logo-1'
 export let size = 40
</script>
<svg class="plinth-logo" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true"><image href={logoUrl(logo)} width="1024" height="1024"/></svg>
