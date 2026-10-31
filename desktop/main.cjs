'use strict';
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, dialog, session, protocol, net} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {sanitizeSettings, dimensions, clampPosition, shouldIgnoreMouse, isWithinRoot} = require('./window-state.cjs');
const ROOT = __dirname;
const SETTINGS_NAME = 'desktop-settings.json';
let win, tray, settings, settingsPath, passThrough = false, overPet = false, moving = false, saveTimer;
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
  const current = win.getBounds();
  const display = screen.getDisplayMatching(current).workArea;
  const position = clampPosition({x:current.x + Math.round(delta.dx), y:current.y + Math.round(delta.dy)}, display, current);
  win.setPosition(position.x, position.y);
}
function placeWindow() {
  const size = dimensions(settings.size);
  const display = screen.getPrimaryDisplay().workArea;
  const candidate = {x:settings.x ?? display.x + display.width - size.width - 28,
    y:settings.y ?? display.y + display.height - size.height - 28};
  const at = clampPosition(candidate, display, size);
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
    moving=false;setIgnore();scheduleSave();
  });
  ipcMain.on('dexter:menu',event=>{
    if(event.sender!==win?.webContents)return;
    contextMenu().popup({window:win});
  });
}
app.whenReady().then(()=>{
  app.setAppUserModelId('dev.stinkyweasel.dexterdesk');
  app.setName('Dexter Desk Familiar');
  session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  load();
  protocol.handle('dexter', request=>{
    let url;
    try{url=new URL(request.url);}catch{return new Response('Bad URL',{status:400});}
    if(url.hostname!=='app' || url.username || url.password || url.port)return new Response('Forbidden',{status:403});
    let pathname;
    try{pathname=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
    if(pathname.includes('\\\\') || pathname.includes('\\0'))return new Response('Forbidden',{status:403});
    const requested=path.resolve(ROOT,'.'+pathname);
    if(!isWithinRoot(ROOT,requested))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(requested).toString());
  });
  setupIpc();
  createWindow();
  const image=nativeImage.createFromPath(path.join(ROOT,'icons','icon-192.png'));
  tray=new Tray(image.isEmpty()?nativeImage.createEmpty():image.resize({width:18,height:18}));
  tray.setToolTip('Dexter Desk Familiar');
  tray.on('click',()=>{passThrough=false;overPet=true;win.show();setIgnore();});
  refreshMenu();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{clearTimeout(saveTimer);if(settings){try{save();}catch(error){console.error(error.message);}}});
