<script lang="ts">
 import { onMount } from 'svelte'
 import { invoke } from '@tauri-apps/api/core'
 import { listen } from '@tauri-apps/api/event'
 import Icon from './Icon.svelte'
 import * as api from './api'
 import { musicAccessDemo, type MusicAccess, type Permission } from './musicAccess'
 let access:MusicAccess|null=null,error='',requesting=''
 let mediaDark=matchMedia('(prefers-color-scheme: dark)').matches,theme='system'
 $: if(typeof document!=='undefined')document.documentElement.dataset.theme=theme==='system'?(mediaDark?'dark':'light'):theme
 $: blocked=!!access?.permissions.some(p=>p.access==='denied'||p.access==='not-requested'||p.access==='unknown')
 const labels:Record<string,string>={allowed:'Allowed',denied:'Off','not-requested':'Not asked yet','not-running':'Music is closed',unknown:'Couldn’t check'}
 async function refresh(){
  if(!api.native){access=musicAccessDemo(new URLSearchParams(location.search).get('access')??'');return}
  try{access=await invoke<MusicAccess>('music_access');error=''}catch(e){error=String(e)}
 }
 async function request(p:Permission){requesting=p.id;try{await invoke('request_music_access',{permission:p.id})}catch(e){error=String(e)}finally{requesting='';void refresh()}}
 async function openSettings(p:Permission){try{await invoke('open_privacy_settings',{permission:p.id})}catch(e){error=String(e)}}
 async function retry(){if(api.native)await invoke('retry_music_request')}
 async function close(){if(api.native){const {getCurrentWebviewWindow}=await import('@tauri-apps/api/webviewWindow');await getCurrentWebviewWindow().close()}}
 onMount(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)'),onMedia=()=>mediaDark=media.matches
  media.addEventListener('change',onMedia)
  void api.loadLibrary().then(l=>theme=l.settings.theme).catch(()=>{})
  const unsubscribe=api.subscribe(l=>theme=l.settings.theme)
  const changed=api.native?listen('music-access-changed',refresh):Promise.resolve(()=>{})
  // Permissions change in System Settings, outside Plinth; poll so each row updates live.
  void refresh();const timer=setInterval(refresh,1000)
  const onFocus=()=>void refresh();window.addEventListener('focus',onFocus)
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')void close()};window.addEventListener('keydown',onKey)
  return()=>{clearInterval(timer);media.removeEventListener('change',onMedia);window.removeEventListener('focus',onFocus);window.removeEventListener('keydown',onKey);void unsubscribe.then(f=>f());void changed.then(f=>f())}
 })
</script>

<main class="access">
 <div class="access-drag" data-tauri-drag-region></div>
 <div class="access-head">
  <span class="access-mark"><Icon name="music"/></span>
  <div>
   <h1>{blocked?'Plinth needs access to Music':'Plinth can reach Music'}</h1>
   <p>{#if access}To open {access.subject}.{:else}&nbsp;{/if}</p>
  </div>
 </div>
 <ul aria-live="polite">
  {#each access?.permissions??[] as p (p.id)}
   <li class={p.access}>
    <span class="state-icon" aria-hidden="true">{#if p.access==='allowed'}<Icon name="check"/>{:else if p.access==='denied'}<Icon name="close"/>{:else}<Icon name="info"/>{/if}</span>
    <div class="permission-copy"><strong>{p.title}</strong><small>{p.detail}</small></div>
    {#if p.access==='allowed'||p.access==='not-running'}
     <span class="state-label">{labels[p.access]}</span>
    {:else if p.access==='not-requested'}
     <button type="button" onclick={()=>request(p)} disabled={requesting===p.id}>{requesting===p.id?'Asking…':'Allow…'}</button>
    {:else}
     <button type="button" onclick={()=>openSettings(p)} aria-label={`Open System Settings for ${p.title}`}>Open Settings<Icon name="external"/></button>
    {/if}
   </li>
  {/each}
 </ul>
 <div class="access-foot">
  <small class="live" class:error>{#if error}{error}{:else}<span class="live-dot" aria-hidden="true"></span>Updates as you change System Settings{/if}</small>
  <div class="access-actions"><button type="button" onclick={close}>Cancel</button><button type="button" class="primary" onclick={retry} disabled={blocked}>Try again</button></div>
 </div>
</main>

<style>
 :global(html:has(.access)),:global(body:has(.access)){height:100%;overflow:hidden;min-width:0}
 .access{height:100vh;display:flex;flex-direction:column;padding:38px 24px 20px;user-select:none;-webkit-user-select:none}
 .access-drag{position:fixed;inset:0 0 auto;height:30px}
 .access-head{display:flex;gap:14px;align-items:center;margin-bottom:18px}
 .access-mark{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;color:#fff;background:linear-gradient(140deg,#fb5c74,#c03a9a 55%,#7a4fd6)}
 .access-mark :global(svg){width:22px;height:22px}
 h1{font-size:17px;font-weight:600;letter-spacing:-.3px;line-height:1.25}
 .access-head p{margin-top:3px;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}
 ul{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--paper);overflow:hidden}
 li{display:flex;align-items:center;gap:12px;min-height:66px;padding:12px 14px;transition:background .2s}
 li+li{border-top:1px solid var(--line)}
 .state-icon{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto;transition:background .2s,color .2s}
 .state-icon :global(svg){width:14px;height:14px;stroke-width:2.2}
 .allowed .state-icon{background:#4fae7f26;color:#5cbf8d}
 .denied .state-icon,.unknown .state-icon{background:color-mix(in srgb,var(--danger) 16%,transparent);color:var(--danger)}
 .not-requested .state-icon,.not-running .state-icon{background:#d9a54a26;color:#d9a54a}
 .permission-copy{flex:1;min-width:0;display:grid;gap:3px}
 strong{font-size:13px;font-weight:550}
 .permission-copy small{font-size:11.5px;color:var(--muted)}
 .state-label{font-size:12px;color:var(--muted)}
 .allowed .state-label{color:#5cbf8d}
 li button{padding:6px 11px;font-size:12px;gap:6px;white-space:nowrap}
 li button :global(svg){width:13px;height:13px}
 .access-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:16px}
 .live{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--faint);min-width:0}
 .live.error{color:var(--danger)}
 .live-dot{width:6px;height:6px;border-radius:50%;background:#5cbf8d;flex:0 0 auto;animation:pulse 2s ease-in-out infinite}
 @keyframes pulse{50%{opacity:.35}}
 .access-actions{display:flex;gap:8px;flex:0 0 auto}
 .access-actions button{padding:7px 14px;font-size:13px}
 :global(:root[data-theme=light]) .allowed .state-icon{color:#2f8a5d}
 :global(:root[data-theme=light]) .allowed .state-label{color:#2f8a5d}
 :global(:root[data-theme=light]) .not-requested .state-icon,:global(:root[data-theme=light]) .not-running .state-icon{color:#a8741c}
 @media (prefers-reduced-motion:reduce){.live-dot{animation:none}}
</style>
