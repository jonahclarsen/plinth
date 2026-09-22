<script lang="ts">
 import { onMount } from 'svelte'
 import { invoke } from '@tauri-apps/api/core'
 import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
 import { listen } from '@tauri-apps/api/event'
 import { previewDisplays, type DetectedDisplay } from './lib/displays'
 import Icon from './lib/Icon.svelte'
 import Shortcut from './lib/Shortcut.svelte'
 import Logo from './lib/Logo.svelte'
 import { logos, logoUrl } from './lib/logos'
 import Desktop from './lib/Desktop.svelte'
 import { desktopSpacing } from './lib/spacing'
 import History from './lib/History.svelte'
 import { emptyHistory, type HistoryView } from './lib/history'
 import * as api from './lib/api'
 import { defaultSettings, ordered, type Library, type Album, type Layout } from './lib/types'
 const desktop=new URLSearchParams(location.search).has('desktop')
 let library:Library={albums:[],settings:structuredClone(defaultSettings)}
 let sortOpen=false
 const sortOptions=[{value:'artist',label:'Artist'},{value:'title',label:'Title'},{value:'date',label:'Newest date'},{value:'oldest',label:'Oldest date'},{value:'shuffle',label:'Shuffle'}]
 function chooseSort(value:string){library.settings.sort=value;if(value==='shuffle'){const next=new Uint32Array(1);do{crypto.getRandomValues(next)}while(next[0]===library.settings.shuffleSeed);library.settings.shuffleSeed=next[0]}sortOpen=false;persist()}
 const tabs=[{id:'collection',label:'Collection',icon:'grid',key:'C'},{id:'appearance',label:'Appearance',icon:'settings',key:'A'},{id:'settings',label:'Settings',icon:'info',key:'S'}]
 let page='collection',query='',busy=false,loaded=false,error='',notice='',dragging=false
 let history:HistoryView=emptyHistory,historyBusy=false,historyLoading=false
 let historyRequest=0
 let edit:Album|null=null,confirmRemove=false
 let availableSpaces:number[]=api.native?[]:[1,2,3],spaceSaving=false,spacesReason=''
 async function refreshSpaces(){if(desktop)return;try{const result=await api.getSpaces();availableSpaces=result?.available??[];spacesReason=result?.reason??''}catch{availableSpaces=[];spacesReason='Numbered Spaces are unavailable.'}}
 async function chooseSpace(value:'all'|'current'|number){
  if(spaceSaving)return;spaceSaving=true;error=''
  try{await flushSettings();await api.saveSettings({...settings,allSpaces:value==='all',targetSpace:typeof value==='number'?value:null});library=await api.loadLibrary();await refreshHistory()}catch(e){error=String(e)}finally{spaceSaving=false;void refreshSpaces()}
 }
 let profile:'layout'|'wideLayout'='layout'
 let replacementFiles:HTMLInputElement
 let artworkTarget:HTMLDivElement
 let replacing=false
 let files:HTMLInputElement
 let quitHeading:HTMLHeadingElement
 let quitDialog:HTMLDialogElement
 let quitBackdropDown=false
 let modal:HTMLDialogElement
 let gallery:HTMLDialogElement
 let galleryAlbum:Album|null=null
 let editorForm:HTMLFormElement
 let saving=false
 let artworkRatio=1
 let backdropPointerDown=false
 function editingText(target:EventTarget|null){return target instanceof Element&&(!!target.closest('textarea,[contenteditable]')||(target instanceof HTMLInputElement&&!['range','checkbox','radio','file','button','submit','reset','color'].includes(target.type)))}
 function outsideDialog(dialog:HTMLDialogElement,e:PointerEvent) {const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom}
 let desktopPreview:Desktop|undefined
 function startHoverPreview(event:PointerEvent) {
  if(event.button!==0)return
  desktopPreview?.startHoverPreview()
 }
 function stopHoverPreview(){desktopPreview?.stopHoverPreview();finishAppearanceDrag()}
 let previewWidth=0
 let screens=api.native?previewDisplays([]).screens:{layout:{width:1280,height:800,menuBarHeight:24,pixels:'2560 × 1600'},wideLayout:{width:1920,height:1080,menuBarHeight:24,pixels:'3840 × 2160'}}
 let currentDisplayId:number|undefined
 let displayRequest=0
 async function refreshDisplays(selectCurrent=false) {
  const request=++displayRequest
  try {
   const result=previewDisplays(await invoke<DetectedDisplay[]>('get_displays'))
   if(request!==displayRequest)return
   screens=result.screens
   if(result.profile&&(selectCurrent||result.currentId!==currentDisplayId))profile=result.profile
   currentDisplayId=result.currentId
  } catch { /* Keep the last preview if a display is disconnected during detection. */ }
 }
 let previousPage=page
 $: if(page!==previousPage){finishAppearanceDrag();previousPage=page;if(page==='appearance'){void refreshSpaces();if(api.native)void refreshDisplays(true)};if(page==='history')void loadHistoryPage()}
 $: screen=screens[profile]
 let mediaDark=window.matchMedia('(prefers-color-scheme: dark)').matches
 let saveQueue=Promise.resolve()
 let saveTimer:ReturnType<typeof setTimeout>
 let settingsRevision=0,settingsDirty=false
 let draggingAppearance=false
 function beginAppearanceDrag(event:PointerEvent){
  if(event.button!==0||!(event.target instanceof HTMLInputElement)||event.target.type!=='range'||!event.target.closest('.controls'))return
  draggingAppearance=true;clearTimeout(saveTimer)
 }
 function finishAppearanceDrag(){if(!draggingAppearance)return;draggingAppearance=false;if(settingsDirty)persist()}
 $: settings=library.settings
 $: layout=settings[profile]
 $: enabled=library.albums.filter(a=>a.enabled)
 $: rowSpacing=desktopSpacing(layout,screen.width,screen.height,enabled.length,screen.menuBarHeight)
 $: filtered=ordered(library.albums.filter(a=>`${a.title} ${a.artist}`.toLowerCase().includes(query.toLowerCase())),settings.sort,settings.shuffleSeed)
 $: artists=new Set(library.albums.map(a=>a.artist).filter(Boolean)).size
 $: if(typeof document!=='undefined') {document.documentElement.dataset.theme=settings.theme==='system'?(mediaDark?'dark':'light'):settings.theme;document.documentElement.classList.toggle('desktop-document',desktop)}
 $: if(edit && modal && !modal.open) modal.showModal()
 function message(text:string) {notice=text;setTimeout(()=>{if(notice===text)notice=''},6000)}
 function persist() {
  settingsDirty=true;const revision=++settingsRevision
  clearTimeout(saveTimer)
  // Keep drag rendering local; commit its final state after release or cancellation.
  if(draggingAppearance)return
  const snapshot=structuredClone(library.settings)
  saveTimer=setTimeout(()=>{saveQueue=saveQueue.then(()=>api.saveSettings(snapshot)).then(()=>{if(revision===settingsRevision)settingsDirty=false}).catch(e=>{error=String(e)})},100)
 }
 function changeLayout(key:keyof Layout,value:number|boolean|null) {library.settings[profile]={...layout,[key]:value};persist()}
 async function importPaths(paths:string[]) {if(!paths.length)return;busy=true;error='';try{const r=await api.importPaths(paths);message(`${r.added} artwork${r.added===1?'':'s'} added${r.duplicates?` · ${r.duplicates} already in your collection`:''}`);if(r.errors.length)error=r.errors.join('\n')}catch(e){error=String(e)}finally{busy=false}}
 async function choose() {if(!api.native){files.click();return}try{await importPaths(await api.chooseImages())}catch(e){error=String(e)}}
 async function browserFiles(selected:File[]) {busy=true;try{const r=await api.importBrowserFiles(selected);message(`${r.added} artworks added${r.duplicates?` · ${r.duplicates} already in your collection`:''}`);if(r.errors.length)error=r.errors.join('\n')}catch(e){error=String(e)}finally{busy=false}}
 async function saveAlbum() {if(!edit||saving||replacing)return;saving=true;try{await api.updateAlbum(edit);closeEditor();message('Album updated')}catch(e){error=String(e)}finally{saving=false}}
 async function replace(input:string|File){if(!edit)return;replacing=true;try{const result=await api.replaceArtwork(edit,input);edit={...edit,cover:result.cover,original:result.original}}catch{await api.showAlert('This image could not be used. Choose a supported image file.')}finally{replacing=false}}
 async function chooseReplacement(){if(!api.native){replacementFiles.click();return}try{const paths=await api.chooseImages(true);if(paths.length)await replace(paths[0])}catch{await api.showAlert('The image picker could not be opened.')}}
 async function revealArtwork(){if(!edit)return;try{await api.revealArtwork(edit)}catch{await api.showAlert('The original artwork could not be shown in Finder.')}}
 function showGallery(album:Album){galleryAlbum=album;gallery.showModal()}
 function closeGallery(){gallery.close();galleryAlbum=null}
 function showQuit(){if(!quitDialog?.open){quitDialog?.showModal();quitHeading?.focus()}}
 async function flushSettings(){clearTimeout(saveTimer);await saveQueue;if(settingsDirty){await api.saveSettings(structuredClone(library.settings));settingsDirty=false}}
 async function refreshHistory(){
  if(desktop||page!=='history')return
  const request=++historyRequest;historyLoading=true
  try{const result=await api.getHistory();if(request===historyRequest)history=result??emptyHistory}catch(e){if(request===historyRequest)error=String(e)}finally{if(request===historyRequest)historyLoading=false}
 }
 async function loadHistoryPage(){try{await flushSettings();await refreshHistory()}catch(e){error=String(e)}}
 async function moveHistory(action:'undo'|'redo'|'restore',id?:number){
  if(historyBusy||spaceSaving||busy||saving||replacing||modal?.open||gallery?.open||quitDialog?.open)return
  historyBusy=true;error=''
  try{
   await flushSettings()
   const current=await api.getHistory()
   if((action==='undo'&&!current.canUndo)||(action==='redo'&&!current.canRedo))return
   history=await api.navigateHistory(action,id)
   library=await api.loadLibrary()
   await refreshHistory()
   message(action==='undo'?'Change undone':action==='redo'?'Change redone':'History state restored')
  }catch(e){error=String(e)}finally{historyBusy=false}
 }

 async function hideWindow(){try{await flushSettings();quitDialog?.close();if(api.native)await invoke('hide_window')}catch{await api.showAlert('The window could not be hidden.')}}
 async function quitApp(){try{await flushSettings();if(api.native)await invoke('quit_app');else quitDialog.close()}catch{await api.showAlert('Plinth could not quit.')}}
 function closeEditor(){gallery?.close();edit=null;confirmRemove=false;modal?.close()}
 async function remove(){if(!edit)return;try{await api.removeAlbum(edit.id);closeEditor();message('Removed from your collection. The original is kept in local storage.')}catch(e){error=String(e)}}
 async function open(album:Album){try{await api.openAlbum(album.id)}catch{await api.showAlert('Apple Music could not be opened.')}}
 function resetLayout(){library.settings[profile]={...defaultSettings[profile]};persist()}
 onMount(()=>{
  let live=true; const disposers:(()=>void)[]=[]
  const media=window.matchMedia('(prefers-color-scheme: dark)');const updateMedia=()=>mediaDark=media.matches;media.addEventListener('change',updateMedia)
  ;(async()=>{try{
   // Subscribe before loading so imports from another window cannot be missed.
   const sub=await api.subscribe(next=>{library=settingsDirty?{...next,settings:library.settings}:next;void refreshHistory()});if(!live){sub();return}disposers.push(sub)
   library=await api.loadLibrary();loaded=true;void refreshHistory()
   if(api.native){
    if(!desktop){
     await refreshDisplays(true)
     const nativeWindow=getCurrentWebviewWindow()
     let displayTimer:ReturnType<typeof setTimeout>
     const scheduleDisplayRefresh=()=>{clearTimeout(displayTimer);displayTimer=setTimeout(()=>void refreshDisplays(),150)}
     disposers.push(()=>{clearTimeout(displayTimer);displayRequest++})
     for(const subscribe of [()=>nativeWindow.onMoved(scheduleDisplayRefresh),()=>nativeWindow.onScaleChanged(scheduleDisplayRefresh),()=>nativeWindow.onFocusChanged(e=>{if(e.payload){scheduleDisplayRefresh();void refreshSpaces()}})]) {
      const unlisten=await subscribe();if(live)disposers.push(unlisten);else unlisten()
     }
    }
    if(!desktop){const quit=await listen('request-quit',showQuit);if(live)disposers.push(quit);else quit()}
    const err=await listen<string>('app-error',e=>error=e.payload);if(live)disposers.push(err);else err()
    if(!desktop){const nativeWindow=getCurrentWebviewWindow();const scale=await nativeWindow.scaleFactor();const drop=await nativeWindow.onDragDropEvent(e=>{
     dragging=!edit&&(e.payload.type==='over'||e.payload.type==='enter');
     if(e.payload.type==='drop'){
      if(gallery?.open)return
      if(edit){const rect=artworkTarget?.getBoundingClientRect(),x=e.payload.position.x/scale,y=e.payload.position.y/scale;if(rect&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom){if(e.payload.paths.length===1)void replace(e.payload.paths[0]);else void api.showAlert('Choose one replacement image.')}}
      else void importPaths(e.payload.paths)
     }
    });if(live)disposers.push(drop);else drop()}
   }
  }catch(e){error=String(e)}})()
  return ()=>{live=false;disposers.forEach(fn=>fn());media.removeEventListener('change',updateMedia)}
 })
</script>

 <svelte:head><link rel="icon" type="image/png" href={logoUrl(settings.logo)}/><link rel="apple-touch-icon" href={logoUrl(settings.logo)}/></svelte:head>
 <svelte:window onpointerup={stopHoverPreview} onpointercancel={stopHoverPreview} onblur={stopHoverPreview} onpointerdown={(e)=>{beginAppearanceDrag(e);if(!(e.target instanceof Element)||!e.target.closest('.sort-picker'))sortOpen=false}} onkeydown={(e)=>{if(desktop)return;if(quitDialog?.open){if(e.repeat){e.preventDefault();return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='q'){e.preventDefault();void quitApp()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='w'){e.preventDefault();void hideWindow()}else if(e.key==='Escape'){e.preventDefault();quitDialog.close()}return}if(e.repeat&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='q'){e.preventDefault();return}if(e.key==='Escape'&&sortOpen){sortOpen=false;return}if(e.altKey&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.isComposing&&!editingText(e.target)&&!modal?.open&&!gallery?.open){const tab=tabs.find(tab=>e.code==='Key'+tab.key);if(tab){e.preventDefault();sortOpen=false;page=tab.id;return}}if(e.altKey&&!e.metaKey&&!e.ctrlKey&&(e.code==='KeyQ'||e.code==='KeyW')){if(modal?.open||quitDialog?.open)return;e.preventDefault();const pages=tabs.map(tab=>tab.id);page=pages[(pages.indexOf(page==='history'?'settings':page)+(e.code==='KeyQ'?-1:1)+pages.length)%pages.length];return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='q'){e.preventDefault();showQuit();return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='w'){e.preventDefault();void hideWindow();return}if(gallery?.open){if(e.key==='Escape'){e.preventDefault();closeGallery()}return}if(modal?.open&&e.key==='Enter'&&!e.isComposing&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.shiftKey&&!confirmRemove){e.preventDefault();if(!e.repeat&&!saving&&!replacing)editorForm.requestSubmit();return}if((e.metaKey||e.ctrlKey)&&!e.altKey&&e.key.toLowerCase()==='z'&&!modal?.open&&!editingText(e.target)){e.preventDefault();if(!e.repeat)void moveHistory(e.shiftKey?'redo':'undo');return}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='a'&&page==='collection'&&!modal?.open&&!(e.target instanceof Element&&e.target.closest('input,textarea,[contenteditable]'))){e.preventDefault();if(!e.repeat&&!busy)void choose();return}if(e.key==='/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)){e.preventDefault();document.querySelector<HTMLInputElement>('.search input')?.focus()}if((e.metaKey||e.ctrlKey)&&e.key==='o'){e.preventDefault();void choose()}if(e.key==='Escape'){if(quitDialog?.open)quitDialog.close();else closeEditor()}}}/>
{#if desktop}
 <Desktop {library}/>
{:else}

 <div class="app-shell" inert={historyBusy||spaceSaving} aria-busy={historyBusy||spaceSaving} class:dragging ondragover={(e)=>{e.preventDefault();if(!api.native)dragging=true}} ondragleave={(e)=>{if(!e.relatedTarget)dragging=false}} ondrop={(e)=>{e.preventDefault();dragging=false;if(!api.native&&e.dataTransfer)void browserFiles(Array.from(e.dataTransfer.files))}} role="presentation">
  <div class="titlebar" data-tauri-drag-region aria-hidden="true"></div>
  <header data-tauri-drag-region>
   <a class="brand" href="/" onclick={(e)=>{e.preventDefault();page='collection'}}><span class="brand-mark" data-logo={settings.logo}><Logo logo={settings.logo}/></span>plinth</a>
   <nav aria-label="Main navigation" data-tauri-drag-region>
    {#each tabs as tab}
     <button class:active={(page==='history'?'settings':page)===tab.id} aria-current={(page==='history'?'settings':page)===tab.id?'page':undefined} title={tab.label+' (Alt+'+tab.key+')'} aria-keyshortcuts={'Alt+'+tab.key} onclick={()=>page=tab.id}><Icon name={tab.icon}/><span>{tab.label}</span><Shortcut keys={['⌥',tab.key]}/></button>
    {/each}
   </nav>
   <div class="header-actions" data-tauri-drag-region><button class="desktop-toggle" onclick={()=>{settings.desktopEnabled=!settings.desktopEnabled;persist()}}>{settings.desktopEnabled?'Disable':'Enable'}</button><button class="primary add-artwork" aria-label={busy?'Importing…':'Add artwork'} aria-keyshortcuts={page==='collection'?'Meta+A Control+A':undefined} onclick={()=>choose()} disabled={busy}>{busy?'Importing…':'Add artwork'}{#if page==='collection'&&!busy}<Shortcut keys={['Cmd','A']}/>{/if}</button></div>
  </header>
  {#if error}<div class="banner error" role="alert"><span>{error}</span><button class="icon-only" aria-label="Dismiss error" onclick={()=>error=''}><Icon name="close"/></button></div>{/if}
  {#if notice}<div class="toast" role="status"><Icon name="check"/>{notice}</div>{/if}
  <main>
   {#if page==='collection'}
    <section class="collection-toolbar"><div class="collection-tabs"><span class="collection-meta">{library.albums.length} albums</span><span class="collection-meta">{artists} artists</span></div><div class="toolbar-right"><label class="search"><Icon name="search"/><input aria-label="Search collection" type="search" placeholder="Find a record…" bind:value={query}/><Shortcut keys={['/']}/></label><div class="sort-picker"><button class="sort-trigger" aria-label="Sort collection" aria-haspopup="menu" aria-expanded={sortOpen} onclick={()=>sortOpen=!sortOpen}>{sortOptions.find(o=>o.value===settings.sort)?.label}<Icon name="chevron"/></button>{#if sortOpen}<div class="sort-menu" role="menu" aria-label="Sort collection">{#each sortOptions as option}<button role="menuitemradio" aria-checked={settings.sort===option.value} onclick={()=>chooseSort(option.value)}>{option.label}{#if settings.sort===option.value}<Icon name="check"/>{/if}</button>{/each}</div>{/if}</div></div></section>
    {#if !loaded}<div class="empty-state"><Logo logo={settings.logo}/><h2>Opening your collection…</h2></div>
    {:else if library.albums.length===0}<div class="empty-state"><div class="empty-art"><Icon name="music"/></div><span class="eyebrow">ROOM FOR YOUR FAVORITES</span><h2>Start with a record you love.</h2><p>Drop your artwork here, or choose images from your Mac.<br/>We’ll resize and organize everything for you.</p><div class="actions"><button class="primary add-artwork" aria-label="Add artwork" aria-keyshortcuts="Meta+A Control+A" onclick={()=>choose()}>Add artwork<Shortcut keys={['Cmd','A']}/></button></div><small>PNG, JPEG, WebP, GIF, TIFF, and BMP</small></div>
    {:else if filtered.length===0}<div class="empty-state"><Icon name="search"/><h2>No records found.</h2><button onclick={()=>query=''}>Clear search</button></div>
    {:else}<div class="album-grid">{#each filtered as album (album.id)}<article class="album-card" class:disabled={!album.enabled}><button class="album-edit" onclick={()=>{edit={...album};confirmRemove=false}} aria-label={`Edit ${album.title}`}><span class="artwork"><img draggable="false" ondragstart={(e)=>e.preventDefault()} src={api.coverUrl(album)} alt={`${album.title} artwork`} loading="lazy"/><span class="artwork-edit"><Icon name="settings"/>Edit</span>{#if !album.enabled}<span class="hidden-label">Hidden</span>{/if}</span><span class="album-caption"><span class="album-title" title={album.title}>{album.title}</span><span class="album-artist" title={album.artist}>{album.artist||'Unknown artist'}</span></span></button><div class="collection-artwork-actions"><button class="collection-view" aria-label={`View ${album.title} artwork`} onclick={()=>showGallery(album)}><Icon name="image"/>View</button></div></article>{/each}</div>{/if}
   {:else if page==='appearance'}
    <div class="appearance-layout"><section class="preview-column">
    <div class="screen-picker" role="group" aria-label="Preview display">
     <button class:chosen={profile==='layout'} aria-pressed={profile==='layout'} onclick={()=>profile='layout'}><svg width="54" height="40" viewBox="0 0 54 40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="10" y="4" width="34" height="23" rx="2"/><path d="m10 27-6 6h46l-6-6M23 30h8"/></svg><span>Mac display<small>{screens.layout.pixels}</small></span></button>
     <button class:chosen={profile==='wideLayout'} aria-pressed={profile==='wideLayout'} onclick={()=>profile='wideLayout'}><svg width="54" height="40" viewBox="0 0 54 40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="48" height="27" rx="2"/><path d="M27 31v5m-9 0h18"/></svg><span>4K monitor<small>{screens.wideLayout.pixels}</small></span></button>
    </div>
    <div class="screen-frame"><div class="screen-preview" bind:clientWidth={previewWidth} style:aspect-ratio={`${screen.width}/${screen.height}`}>
     <div class="preview-render" style={`width:${screen.width}px;height:${screen.height}px;transform:scale(${previewWidth/screen.width})`}><Desktop bind:this={desktopPreview} {library} preview previewScale={previewWidth/screen.width} forcedLayout={layout} viewportHeight={screen.height} viewportWidth={screen.width} menuBarHeight={screen.menuBarHeight}/></div>
    </div></div><p class="preview-note">{enabled.length} albums · {screen.pixels}</p></section>
    <section class="controls panel"><div class="spaces-field"><span id="spaces-label">Spaces</span><div class="space-options" onpointerenter={()=>void refreshSpaces()} role="group" aria-labelledby="spaces-label"><button aria-pressed={settings.allSpaces&&!settings.targetSpace} disabled={spaceSaving} onclick={()=>void chooseSpace('all')}>All Spaces</button><button aria-pressed={!settings.allSpaces&&!settings.targetSpace} disabled={spaceSaving} onclick={()=>void chooseSpace('current')}>This Space</button>{#each [1,2,3] as number}<button aria-label={`Space ${number}`} aria-pressed={settings.targetSpace===number} disabled={spaceSaving||!availableSpaces.includes(number)} title={availableSpaces.includes(number)?`Desktop ${number}`:`Create Desktop ${number} in Mission Control`} onclick={()=>void chooseSpace(number)}>{number}</button>{/each}</div></div><p class="field-note">{spacesReason?spacesReason:settings.targetSpace?(availableSpaces.includes(settings.targetSpace)?`Keep artwork on Desktop ${settings.targetSpace}.`:`Desktop ${settings.targetSpace} is unavailable. Create it in Mission Control or choose another option.`):settings.allSpaces?'Show artwork on every desktop.':'Use the active desktop when artwork is enabled.'}</p><div class="control-divider"></div><div class="panel-heading" style="margin-top:24px"><h2>Layout</h2><button class="text-button" onclick={resetLayout}>Reset</button></div>
    {#each [{key:'columns',label:'Columns',min:3,max:30,step:1,unit:''},{key:'gap',label:'Space between covers',min:0,max:40,step:1,unit:'px'},{key:'top',label:'Top clearance',min:0,max:200,step:1,unit:'px'},{key:'radius',label:'Rounded corners',min:0,max:40,step:1,unit:'px'},{key:'shadow',label:'Shadow',min:0,max:1,step:.05,unit:''}] as control}<div class="slider-field"><span><label for={`layout-${control.key}`}>{control.label}</label>{#if control.key==='radius'}<label class="hover-corners-toggle"><input class="switch" type="checkbox" checked={layout.roundedOnHover??false} onchange={(e)=>changeLayout('roundedOnHover',e.currentTarget.checked)}/>When hovered</label>{/if}<output>{layout[control.key as keyof Layout]}{control.unit}</output></span><input id={`layout-${control.key}`} type="range" aria-label={control.label} min={control.min} max={control.max} step={control.step} value={layout[control.key as keyof Layout]} oninput={(e)=>changeLayout(control.key as keyof Layout,Number(e.currentTarget.value))}/></div>{#if control.key==='gap'}
    <div class="row-spacing-field"><div><label for="row-spacing">Space between rows</label><label class="auto-row-spacing"><input type="checkbox" aria-label="Automatic row spacing" checked={layout.rowGap===null} onchange={(e)=>changeLayout('rowGap',e.currentTarget.checked?null:Math.round(rowSpacing.rowGap))}/>Auto</label><output for="row-spacing">{Math.round(rowSpacing.rowGap)}px</output></div><input id="row-spacing" aria-label="Space between rows" aria-describedby="row-spacing-note" disabled={layout.rowGap===null} type="range" min="0" max={Math.max(80,Math.ceil(desktopSpacing({...layout,rowGap:null},screen.width,screen.height,enabled.length,screen.menuBarHeight).rowGap),layout.rowGap??0)} step="1" value={rowSpacing.rowGap} oninput={(e)=>changeLayout('rowGap',Number(e.currentTarget.value))}/><p id="row-spacing-note" class="field-note">Auto balances the top and bottom margins. Uncheck to set a custom gap.</p></div>
    {/if}{/each}
    <div class="control-divider"></div><label class="toggle-row"><span>Enlarge on hover</span><input class="switch" type="checkbox" bind:checked={settings.hoverEnabled} onchange={persist}/></label><label class="toggle-row"><span>While another app has focus</span><input class="switch" type="checkbox" disabled={!settings.hoverEnabled} bind:checked={settings.hoverInBackground} onchange={persist}/></label><label class="slider-field"><span>Hover size<output>{settings.hoverScale.toFixed(1)}×</output></span><input aria-label="Hover size" onpointerdown={startHoverPreview} type="range" min="1" max="3" step=".1" bind:value={settings.hoverScale} oninput={persist}/></label><label class="slider-field"><span>Hover speed<output>{Math.round(250/(settings.hoverSpeed??1))} ms</output></span><input aria-label="Hover speed" onpointerdown={startHoverPreview} type="range" min="83" max="1000" step="1" value={Math.round(250/(settings.hoverSpeed??1))} aria-valuetext={`${Math.round(250/(settings.hoverSpeed??1))} milliseconds`} oninput={(event)=>{settings.hoverSpeed=Math.min(3,250/Number(event.currentTarget.value));persist()}}/></label></section></div>
   {:else if page==='history'}
    <div class="history-back"><button onclick={()=>page='settings'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Back to Settings</button></div>
    <History {history} busy={historyBusy||busy} loading={historyLoading} undo={()=>void moveHistory('undo')} redo={()=>void moveHistory('redo')} restore={(id)=>void moveHistory('restore',id)}/>
   {:else}
    <section class="panel settings-compact" aria-label="Settings">
     <div class="setting-row"><span>App appearance</span><div class="appearance-options" role="group" aria-label="App appearance">
      {#each ['system','light','dark'] as theme}<button class="appearance-option" class:chosen={settings.theme===theme} aria-label={theme[0].toUpperCase()+theme.slice(1)} aria-pressed={settings.theme===theme} onclick={()=>{settings.theme=theme;persist()}}><svg class={`appearance-circle ${theme}`} width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="13" fill={theme==='dark'?'#25232a':'#faf9fc'}/>{#if theme==='system'}<path d="M15 2a13 13 0 0 1 0 26Z" fill="#25232a"/>{/if}<circle cx="15" cy="15" r="13" fill="none" stroke="#96909f" stroke-width="1"/></svg><span>{theme[0].toUpperCase()+theme.slice(1)}</span></button>{/each}
     </div></div>
     <div class="setting-row logo-setting"><span>App logo</span><div class="logo-options" role="group" aria-label="App logo">
      {#each logos as logo}<button class="logo-option" class:chosen={settings.logo===logo.id} aria-label={logo.label} aria-pressed={settings.logo===logo.id} onclick={()=>{settings.logo=logo.id;persist()}}><span class="logo-preview"><Logo logo={logo.id} size={60}/></span><span>{logo.label}</span></button>{/each}
     </div></div>
     <label class="setting-row"><span>Show artwork on the desktop</span><input class="switch" type="checkbox" bind:checked={settings.desktopEnabled} onchange={persist}/></label>
     <div class="setting-row"><span>History</span><button onclick={()=>page='history'}><Icon name="history"/>History</button></div>
     <div class="setting-row"><span>Local storage</span><button disabled={!api.native} onclick={()=>invoke('reveal_data').catch(e=>error=String(e))}><Icon name="folder"/>Open folder</button></div>
    </section>
   {/if}
   {#if !api.native}<footer><span>Browser preview · changes last for this session</span></footer>{/if}
  </main>
  {#if dragging}<div class="drop-overlay"><Icon name="upload"/><h2>Make room for something good.</h2><p>Drop artwork to add it to your collection.</p></div>{/if}
  {#if busy}<div class="import-progress" role="status"><span></span>Preparing your artwork. Keeping the originals.</div>{/if}
 </div>
 <input class="visually-hidden" bind:this={files} type="file" accept="image/*" multiple onchange={(e)=>{void browserFiles(Array.from(e.currentTarget.files??[]));e.currentTarget.value=''}} aria-label="Artwork files"/>
 <input class="visually-hidden" bind:this={replacementFiles} type="file" accept="image/*" aria-label="Replacement image" onchange={(e)=>{const file=e.currentTarget.files?.[0];if(file)void replace(file);e.currentTarget.value=''}}/>
 <dialog class="album-dialog" bind:this={modal} onpointerdown={(e)=>backdropPointerDown=e.target===modal&&outsideDialog(modal,e)} onpointerup={(e)=>{if(backdropPointerDown&&e.target===modal&&outsideDialog(modal,e))closeEditor();backdropPointerDown=false}} onclose={()=>{if(!modal.open){gallery?.close();edit=null;confirmRemove=false}}} oncancel={closeEditor}>
 {#if edit}<form bind:this={editorForm} onsubmit={(e)=>{e.preventDefault();void saveAlbum()}}><button class="icon-only editor-close" type="button" aria-label="Close album editor" onclick={closeEditor}><Icon name="close"/></button><div class="editor-top"><div class="editor-artwork" bind:this={artworkTarget} class:replacing ondragover={(e)=>e.preventDefault()} ondrop={(e)=>{e.preventDefault();if(!api.native&&e.dataTransfer?.files.length===1)void replace(e.dataTransfer.files[0])}} role="presentation"><img draggable="false" ondragstart={(e)=>e.preventDefault()} src={api.originalUrl(edit)} alt={edit.title}/><button type="button" class="artwork-expand" aria-label="View original artwork" onclick={()=>edit&&showGallery(edit)}></button><div class="artwork-actions"><button type="button" class="icon-only" aria-label="Show original artwork in Finder" title="Show original artwork in Finder" onclick={revealArtwork} disabled={replacing||!api.native}><Icon name="folder"/></button><button type="button" class="icon-only" aria-label="Replace artwork" title="Replace artwork" onclick={chooseReplacement} disabled={replacing}><Icon name="upload"/></button></div>{#if replacing}<span class="replacement-progress">Replacing…</span>{/if}</div><div><h3>{edit.title}</h3><p>{edit.artist||'Make it your own.'}</p><button type="button" class="open-music" onclick={()=>edit&&open(edit)}><Icon name="music"/>Open in Music</button></div></div><label>Album title<input required bind:value={edit.title}/></label><div class="two-fields"><label>Artist<input bind:value={edit.artist}/></label><label>Release date<input type="date" bind:value={edit.date}/></label></div><label>Album link <span class="optional">optional</span><input type="url" placeholder="https://music.apple.com/…" bind:value={edit.url} aria-describedby={!edit.url.trim()?'album-link-help':undefined}/></label>{#if !edit.url.trim()}<p id="album-link-help" class="album-link-help">If no link is provided, the album will be searched for in your Apple Music library. This is often faster than opening an Apple Music link.</p>{/if}<label class="toggle-row"><span>Show on desktop</span><input class="switch" type="checkbox" bind:checked={edit.enabled}/></label><div class="editor-actions">{#if confirmRemove}<button type="button" class="danger" onclick={remove}>Remove this album</button><button type="button" onclick={()=>confirmRemove=false}>Keep it</button>{:else}<button type="button" class="icon-only danger" aria-label="Remove album" onclick={()=>confirmRemove=true}><Icon name="trash"/></button><button type="submit" class="primary" aria-label="Save" aria-keyshortcuts="Enter" disabled={saving||replacing}><Icon name="check"/>Save<Shortcut keys={['Enter']}/></button>{/if}</div></form>{/if}
 </dialog>
 <dialog class="artwork-gallery" bind:this={gallery} aria-label="Original artwork" onclose={()=>{if(!gallery.open)galleryAlbum=null}} onclick={closeGallery} onkeydown={(e)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeGallery()}}}>
  {#if galleryAlbum}<img src={api.originalUrl(galleryAlbum)} alt={galleryAlbum.title} draggable="false" ondragstart={(e)=>e.preventDefault()} onload={(e)=>{const image=e.currentTarget as HTMLImageElement;artworkRatio=image.naturalWidth/image.naturalHeight}} style={`--artwork-ratio:${artworkRatio}`}/>{/if}
 </dialog>
 <dialog class="quit-dialog" bind:this={quitDialog} aria-labelledby="quit-title" onpointerdown={(e)=>quitBackdropDown=e.target===quitDialog&&outsideDialog(quitDialog,e)} onpointerup={(e)=>{if(quitBackdropDown&&e.target===quitDialog&&outsideDialog(quitDialog,e))quitDialog.close();quitBackdropDown=false}}>
  <h2 id="quit-title" bind:this={quitHeading} tabindex="-1">Quit Plinth?</h2>
  <div class="quit-actions"><button aria-label="Cancel" aria-keyshortcuts="Escape" onclick={()=>quitDialog.close()}>Cancel<Shortcut keys={['Esc']}/></button><button aria-label="Hide window" aria-keyshortcuts="Meta+W Control+W" onclick={hideWindow}>Hide window<Shortcut keys={['Cmd','W']}/></button><button aria-label="Quit Plinth" aria-keyshortcuts="Meta+Q Control+Q" onclick={quitApp}>Quit Plinth<Shortcut keys={['Cmd','Q']}/></button></div>
 </dialog>

{/if}
