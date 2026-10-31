'use strict';
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, dialog, session, protocol, net} = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const {sanitizeSettings, dimensions, clampPosition, shouldIgnoreMouse, isWithinRoot} = require('./window-state.cjs');
const ROOT = __dirname;
const SETTINGS_NAME = 'desktop-settings.json';
let win, tray, settings, settingsPath, passThrough = false, overPet = false, moving = false, dragVirtual = null, saveTimer;
const SMOKE_TEST = process.env.DEXTER_DESKTOP_SMOKE === '1';
protocol.registerSchemesAsPrivileged([{scheme:'dexter',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
app.commandLine.appendSwitch('disable-features','MediaSessionService');

function save() {
  if (!settingsPath) return;
  const target = settingsPath + '.tmp';
  fs.writeFileSync(target, JSON.stringify(settings, null, 2), {mode:0o600});
  fs.renameSync(target, settingsPath);
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {try{save();}catch(error){console.error('Settings save failed', error.message);}}, 250);
}
function load() {
  settingsPath = path.join(app.getPath('userData'), SETTINGS_NAME);
  try{settings = sanitizeSettings(JSON.parse(fs.readFileSync(settingsPath, 'utf8')));}
  catch{settings = sanitizeSettings(null);}
}
function setIgnore() {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(shouldIgnoreMouse({passThrough, preciseHitTest:settings.preciseHitTest, overPet}), {forward:true});
}
function reposition(delta) {
  if (!win || win.isDestroyed()) return;
  const current=win.getBounds();
  if (!dragVirtual) dragVirtual={x:current.x,y:current.y};
  dragVirtual.x+=Math.round(delta.dx);
  dragVirtual.y+=Math.round(delta.dy);
  const target=screen.getDisplayNearestPoint({
    x:dragVirtual.x+Math.floor(current.width/2),
    y:dragVirtual.y+Math.floor(current.height/2)
  }).workArea;
  const position=clampPosition(dragVirtual,target,current);
  win.setPosition(position.x,position.y);
}
function placeWindow() {
  const size=dimensions(settings.size);
  const saved=settings.x!==null && settings.y!==null;
  const chosen=saved ? screen.getDisplayNearestPoint({
    x:settings.x+Math.floor(size.width/2),y:settings.y+Math.floor(size.height/2)
  }) : screen.getPrimaryDisplay();
  const display=chosen.workArea;
  const candidate={x:saved?settings.x:display.x+display.width-size.width-28,
    y:saved?settings.y:display.y+display.height-size.height-28};
  const at=clampPosition(candidate,display,size);
  win.setBounds({...size, ...at});
}
function emit(action) {win?.webContents?.send('dexter:action', action);}
function applyWindow() {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  win.setOpacity(settings.opacity);
  setIgnore();
  refreshMenu();
}
function contextMenu() {
  return Menu.buildFromTemplate([
    {label:'Treat',click:()=>emit('treat')},
    {label:'Huff',click:()=>emit('huff')},
    {label:'Nap / Wake',click:()=>emit('nap')},
    {label:'Toggle quiet mode',click:()=>emit('quiet')},
    {type:'separator'},
    {label:'Appearance',submenu:[
      {label:'Original pixel Dexter', type:'radio', checked:settings.art==='pixel',click:()=>setArt('pixel')},
      {label:'Accepted cel animations', type:'radio',checked:settings.art==='cel',click:()=>setArt('cel')},
      {label:'Candidate SNES atlas (unapproved)',type:'radio',checked:settings.art==='atlas',click:()=>setArt('atlas')}
    ]},
    {label:'Size',submenu:Object.keys(require('./window-state.cjs').SIZES).map(size=>({
      label:size[0].toUpperCase()+size.slice(1),type:'radio',checked:settings.size===size,click:()=>{
        settings.size=size;placeWindow();scheduleSave();refreshMenu();
      }
    }))},
    {label:'Opacity',submenu:[1,0.85,0.7].map(opacity=>({
      label:Math.round(opacity*100)+'%',type:'radio',checked:settings.opacity===opacity,click:()=>{
        settings.opacity=opacity;applyWindow();scheduleSave();
      }
    }))},
    {label:'Always on top',type:'checkbox',checked:settings.alwaysOnTop,click:()=>{
      settings.alwaysOnTop=!settings.alwaysOnTop;applyWindow();scheduleSave();
    }},
    {label:'Click through transparent area',type:'checkbox',checked:settings.preciseHitTest,click:()=>{
      settings.preciseHitTest=!settings.preciseHitTest;applyWindow();scheduleSave();
    }},
    {label:'Pass through all clicks',type:'checkbox',checked:passThrough,click:()=>{
      passThrough=!passThrough;setIgnore();refreshMenu();
    }},
    {type:'separator'},
    {label:'Reset position',click:()=>{settings.x=null;settings.y=null;placeWindow();scheduleSave();}},
    {label:'Show Dexter',click:()=>{passThrough=false;overPet=true;win.show();setIgnore();win.focus();}},
    {label:'Quit Dexter',click:()=>app.quit()}
  ]);
}
function setArt(art) {settings.art=art;emit(art);scheduleSave();refreshMenu();}
function refreshMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(contextMenu());
}
function createWindow() {
  const size=dimensions(settings.size);
  win=new BrowserWindow({
    ...size, show:false, frame:false, transparent:true, hasShadow:false, resizable:false,
    minimizable:false, maximizable:false, fullscreenable:false, skipTaskbar:false,
    backgroundColor:'#00000000', autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),
      nodeIntegration:false, contextIsolation:true, sandbox:true,
      webSecurity:true, allowRunningInsecureContent:false, webviewTag:false}
  });
  placeWindow();
  applyWindow();
  win.on('moved',()=>{
    const {x,y}=win.getBounds();settings.x=x;settings.y=y;scheduleSave();
  });
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==win.webContents.getURL())event.preventDefault();});
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
    callback({cancel:!details.url.startsWith('dexter://app/')});
  });
  win.webContents.on('did-finish-load',()=>{
    win.webContents.executeJavaScript('document.body.dataset.desktop = "true"').catch(()=>{});
    if(settings.art!=='pixel') emit(settings.art);
  });
  win.loadURL('dexter://app/index.html').catch(error=>dialog.showErrorBox('Dexter cannot start',error.message));
  win.once('ready-to-show',()=>{win.showInactive();setIgnore();});
}
function setupIpc() {
  ipcMain.on('dexter:hit',(event,hit)=>{
    if(event.sender!==win?.webContents || typeof hit!=='boolean')return;
    overPet=hit;
    if(!moving)setIgnore();
  });
  ipcMain.on('dexter:move',(event,delta)=>{
    if(event.sender!==win?.webContents || !delta || !Number.isFinite(delta.dx) || !Number.isFinite(delta.dy))return;
    if(Math.abs(delta.dx)>80 || Math.abs(delta.dy)>80)return;
    moving=true;
    reposition(delta);
  });
  ipcMain.on('dexter:drag-end',event=>{
    if(event.sender!==win?.webContents)return;
    moving=false;dragVirtual=null;setIgnore();scheduleSave();
  });
  ipcMain.on('dexter:menu',event=>{
    if(event.sender!==win?.webContents)return;
    contextMenu().popup({window:win});
  });
}
async function runSmokeTest() {
  const timeout = setTimeout(() => {
    console.error('[DEXTER DESKTOP SMOKE] timeout waiting for renderer');
    app.exit(1);
  }, 20000);
  try {
    await new Promise((resolve,reject)=>{
      if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', resolve);
        win.webContents.once('did-fail-load', (_event, code, reason)=>reject(new Error('Renderer load failed: '+code+' '+reason)));
      } else resolve();
    });
    const startBounds=win.getBounds();
    const report = await win.webContents.executeJavaScript(`(async()=>{
      await new Promise(resolve=>setTimeout(resolve,150));
      const pet=document.getElementById('pet');
      const sprite=document.getElementById('sprite');
      const mode=document.getElementById('celModeToggle');
      const css=getComputedStyle(document.body).backgroundColor;
      const bridge=typeof window.dexterDesktop?.move==='function' && typeof window.dexterDesktop?.hit==='function';
      const dockHidden=getComputedStyle(document.querySelector('.dock')).display==='none';
      const media=document.getElementById('celVideo') && document.getElementById('celPoster');
      const pixel=Boolean(sprite?.complete && sprite.naturalWidth===96 && sprite.naturalHeight===96);
      const pokeOptions={bubbles:true,button:0,pointerId:4,screenX:180,screenY:180};
      pet.dispatchEvent(new PointerEvent('pointerdown',pokeOptions));
      pet.dispatchEvent(new PointerEvent('pointerup',pokeOptions));
      const poke=document.getElementById('thought').textContent.includes('Personal space');
      pet.dispatchEvent(new PointerEvent('pointerdown',{...pokeOptions,screenX:180,screenY:180}));
      pet.dispatchEvent(new PointerEvent('pointermove',{...pokeOptions,screenX:157,screenY:162}));
      pet.dispatchEvent(new PointerEvent('pointerup',{...pokeOptions,screenX:157,screenY:162}));
      document.querySelector('[data-action="treat"]').click();
      const treated=pet.dataset.state==='eating';
      mode.checked=true;mode.dispatchEvent(new Event('change',{bubbles:true}));
      const celEnabled=pet.dataset.artMode==='cel';
      const selection=document.getElementById('celClipSelect');
      selection.value='slow_blink';
      selection.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,800));
      const celReady=celEnabled && Boolean(media) &&
        (!document.getElementById('celVideo').hidden || !document.getElementById('celPoster').hidden);
      const celDecoded=Boolean(document.getElementById('celVideo').videoWidth) &&
        !document.getElementById('celVideo').hidden;
      const celStatus=document.getElementById('celStatus').textContent;
      mode.checked=false;mode.dispatchEvent(new Event('change',{bubbles:true}));
      return {bridge,dockHidden,pixel,poke,treated,celReady,celDecoded,celStatus,css,
        origin:location.origin,state:pet.dataset.state,desktop:document.body.dataset.desktop};
    })()`, true);
    await new Promise(resolve=>setTimeout(resolve,130));
    const endBounds=win.getBounds();
    const dragged=startBounds.x!==endBounds.x || startBounds.y!==endBounds.y;
    if(!report.bridge || !report.dockHidden || !report.pixel || !report.poke || !report.treated || !report.celReady || !dragged ||
       report.desktop!=='true' || report.origin!=='dexter://app' ||
       (report.css!=='rgba(0, 0, 0, 0)' && report.css!=='transparent')) {
      throw new Error('Smoke assertions failed: '+JSON.stringify(report));
    }
    if (!win.isAlwaysOnTop()) throw new Error('Floating-window policy not applied');
    const denied=await net.fetch('dexter://app/main.cjs');
    const rangeResponse=await net.fetch('dexter://app/assets/cel-shaded/clips/slow_blink.webm',{
      headers:{Range:'bytes=0-31'}
    });
    const rangeBytes=Buffer.from(await rangeResponse.arrayBuffer());
    const rangeProven=rangeResponse.status===206 && rangeBytes.length===32 &&
      rangeResponse.headers.get('content-range')?.startsWith('bytes 0-31/');
    if(denied.status!==403 || !rangeProven)
      throw new Error('Protocol safety or video byte range failed: '+JSON.stringify({
        denied:denied.status,range:rangeResponse.status,bytes:rangeBytes.length
      }));
    const captured=await win.capturePage();
    const bitmap=captured.toBitmap();
    const corners=bitmap.length>=4?[bitmap[3],bitmap[bitmap.length-1]]:[];
    console.log('[DEXTER DESKTOP SMOKE PASS] '+JSON.stringify({...report,
      dragged,startBounds,endBounds,tray:!!tray&&!tray.isDestroyed(),protocolDenied:denied.status,
      videoRange:rangeResponse.status,rangeBytes:rangeBytes.length,screenshotAlphaCorners:corners
    }));
    clearTimeout(timeout);
    app.quit();
  } catch(error) {
    clearTimeout(timeout);
    console.error('[DEXTER DESKTOP SMOKE FAIL]',error.stack||String(error));
    app.exit(1);
  }
}

app.whenReady().then(()=>{
  app.setAppUserModelId('dev.stinkyweasel.dexterdesk');
  app.setName('Dexter Desk Familiar');
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  load();
  protocol.handle('dexter', request=>{
    let url;
    try {url=new URL(request.url);} catch {return new Response('Bad URL',{status:400});}
    if (url.hostname !== 'app' || url.username || url.password || url.port ||
        url.search || url.hash) return new Response('Forbidden',{status:403});
    let pathname;
    try {pathname=decodeURIComponent(url.pathname);} catch {return new Response('Bad path',{status:400});}
    if (pathname.includes('\\\\') || pathname.includes('\\0')) return new Response('Forbidden',{status:403});
    const relative=pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const allowed=['index.html','app.js','styles.css','overlay.css','renderer.js','manifest.webmanifest'];
    const folder=relative.slice(0,relative.indexOf('/'));
    const leaf=relative.slice(relative.indexOf('/')+1);
    const safeChars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_./-';
    const isAsset=['src','assets','icons'].includes(folder) && leaf.length>0 &&
      [...leaf].every(character=>safeChars.includes(character));
    if (!allowed.includes(relative) && !isAsset) return new Response('Forbidden',{status:403});
    const requested=path.resolve(ROOT,relative);
    if (!isWithinRoot(ROOT,requested)) return new Response('Forbidden',{status:403});
    let data;
    try {
      const canonical=fs.realpathSync.native(requested);
      if (!isWithinRoot(fs.realpathSync.native(ROOT),canonical) || !fs.statSync(canonical).isFile())
        return new Response('Forbidden',{status:403});
      data=fs.readFileSync(canonical);
    } catch {return new Response('Not found',{status:404});}
    const ext=path.extname(relative);
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
      '.mjs':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8','.png':'image/png','.webm':'video/webm',
      '.webmanifest':'application/manifest+json','.json':'application/json'};
    const headers={'Content-Type':types[ext]||'application/octet-stream',
      'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const requestedRange=request.headers.get('range');
    if (requestedRange) {
      const match=new RegExp('^bytes=([0-9]*)-([0-9]*)$').exec(requestedRange);
      if(!match || (!match[1] && !match[2]) || data.length===0)
        return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+data.length}});
      let from,end;
      if (!match[1]) {const suffix=Number(match[2]);from=Math.max(0,data.length-suffix);end=data.length-1;}
      else {from=Number(match[1]);end=match[2]?Math.min(data.length-1,Number(match[2])):data.length-1;}
      if (!Number.isSafeInteger(from)||!Number.isSafeInteger(end)||from> end||from>=data.length)
        return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+data.length}});
      headers['Content-Range']='bytes '+from+'-'+end+'/'+data.length;
      return new Response(data.subarray(from,end+1),{status:206,headers});
    }
    return new Response(data,{status:200,headers});
  });
  setupIpc();
  createWindow();
  if (SMOKE_TEST) void runSmokeTest();
  const image=nativeImage.createFromPath(path.join(ROOT,'icons','icon-192.png'));
  tray=new Tray(image.isEmpty()?nativeImage.createEmpty():image.resize({width:18,height:18}));
  tray.setToolTip('Dexter Desk Familiar');
  tray.on('click',()=>{passThrough=false;overPet=true;win.show();setIgnore();});
  refreshMenu();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{clearTimeout(saveTimer);if(settings){try{save();}catch(error){console.error(error.message);}}});
