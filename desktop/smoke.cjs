'use strict';
// Runtime smoke for the real Electron app (development, packaged, and the copy
// installed from the DMG). Uses a disposable profile. Synthetic DOM events here
// prove wiring inside Electron; they do NOT prove physical mouse click-through.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {net, screen} = require('electron');
const ws = require('./window-state.cjs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, step = 50) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(step);
  }
}
const js = (win, code) => win.webContents.executeJavaScript(code, true);
function loaded(win) {
  return new Promise((resolve, reject) => {
    if (!win.webContents.isLoading()) return resolve();
    win.webContents.once('did-finish-load', resolve);
    win.webContents.once('did-fail-load', (_e, code, reason) => reject(new Error('load failed ' + code + ' ' + reason)));
  });
}
function check(report, name, ok, detail) {
  report[name] = detail === undefined ? Boolean(ok) : detail;
  if (!ok) throw new Error('Smoke assertion failed: ' + name + ' ' + JSON.stringify(detail === undefined ? ok : detail));
}

// Minimal local stand-in for an Ollama server. Bound to loopback only.
function fakeModelServer() {
  const seen = [];
  const server = http.createServer((req, res) => {
    if (req.url === '/api/tags') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({models: [{name: 'dexter-smoke:latest'}]})); }
    if (req.url !== '/api/chat' || req.method !== 'POST') { res.statusCode = 404; return res.end(); }
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      const payload = JSON.parse(body);
      seen.push(payload);
      res.setHeader('Content-Type', 'application/x-ndjson');
      const last = payload.messages.at(-1).content;
      const tokens = ['Hff. ', 'Acceptable', '.'];
      if (last.includes('slow')) { res.write(JSON.stringify({message: {content: 'Considering'}}) + '\n'); return; } // hang until aborted
      let i = 0;
      const timer = setInterval(() => {
        if (i < tokens.length) res.write(JSON.stringify({message: {content: tokens[i++]}}) + '\n');
        else { clearInterval(timer); res.end(JSON.stringify({done: true}) + '\n'); }
      }, 40);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port, seen})));
}

async function persistencePhase(ctx, phase) {
  const {state} = ctx;
  await loaded(state.win);
  await sleep(300);
  const report = {phase};
  if (phase === 'persist-write') {
    ctx.updateSettings({scale: 130, opacity: 0.85, flipped: true, quiet: true, intensity: 'reserved'});
    const area = screen.getPrimaryDisplay().workArea;
    state.win.setPosition(area.x + 40, area.y + 60);
    await sleep(400);
    const b = state.win.getBounds();
    report.bounds = b;
    fs.writeFileSync(path.join(ctx.app.getPath('userData'), 'smoke-expected.json'), JSON.stringify(b));
  } else {
    const expected = JSON.parse(fs.readFileSync(path.join(ctx.app.getPath('userData'), 'smoke-expected.json'), 'utf8'));
    const b = state.win.getBounds();
    check(report, 'settingsPersisted', state.settings.scale === 130 && state.settings.opacity === 0.85 && state.settings.flipped && state.settings.quiet && state.settings.intensity === 'reserved', state.settings);
    check(report, 'boundsRestored', b.x === expected.x && b.y === expected.y && b.width === expected.width && b.height === expected.height, {b, expected});
    check(report, 'clickThroughResetOnLaunch', state.passThrough === false);
    const flipped = await waitFor(() => js(state.win, 'document.body.classList.contains("desktop-flipped")'));
    check(report, 'flipRestoredInRenderer', flipped);
    check(report, 'quietRestoredInRenderer', await js(state.win, 'document.getElementById("quietToggle").checked'));
  }
  console.log('[DEXTER DESKTOP SMOKE PASS] ' + JSON.stringify(report));
}

async function fullSmoke(ctx) {
  const {state, events} = ctx;
  const win = state.win;
  const report = {};
  await loaded(win);
  await sleep(1500);
  const metric = () => Math.round(ctx.app.getAppMetrics().reduce((n, m) => n + (m.memory?.workingSetSize || 0), 0) / 1024);
  report.idleMemoryMB = metric();
  report.idleProcesses = ctx.app.getAppMetrics().map(m => m.type).join(',');

  // ---------------------------------------------------------- original familiar wiring
  const startBounds = win.getBounds();
  const base = await js(win, `(async()=>{
    await new Promise(r=>setTimeout(r,150));
    const pet=document.getElementById('pet'),sprite=document.getElementById('sprite'),mode=document.getElementById('celModeToggle');
    const css=getComputedStyle(document.body).backgroundColor;
    const bridge=typeof window.dexterDesktop?.move==='function'&&typeof window.dexterDesktop?.onBubble==='function';
    const dockHidden=getComputedStyle(document.querySelector('.dock')).display==='none';
    const pixel=Boolean(sprite?.complete&&sprite.naturalWidth===96&&sprite.naturalHeight===96);
    const o={bubbles:true,button:0,pointerId:4,screenX:180,screenY:180};
    pet.dispatchEvent(new PointerEvent('pointerdown',o));pet.dispatchEvent(new PointerEvent('pointerup',o));
    const poke=document.getElementById('thought').textContent.includes('Personal space');
    pet.dispatchEvent(new PointerEvent('pointerdown',o));
    pet.dispatchEvent(new PointerEvent('pointermove',{...o,screenX:157,screenY:162}));
    pet.dispatchEvent(new PointerEvent('pointerup',{...o,screenX:157,screenY:162}));
    document.querySelector('[data-action="treat"]').click();
    const treated=pet.dataset.state==='eating';
    const motion=document.getElementById('motionToggle');motion.checked=false;motion.dispatchEvent(new Event('change',{bubbles:true}));
    mode.checked=true;mode.dispatchEvent(new Event('change',{bubbles:true}));
    const celEnabled=pet.dataset.artMode==='cel';
    const video=document.getElementById('celVideo');let decodedEver=false;
    const observe=()=>{if(video.videoWidth>0&&!video.hidden)decodedEver=true;};
    video.addEventListener('loadeddata',observe);video.addEventListener('playing',observe);
    const sel=document.getElementById('celClipSelect');sel.value='slow_blink';sel.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>{const end=performance.now()+4500;const id=setInterval(()=>{observe();if(decodedEver||performance.now()>=end){clearInterval(id);r();}},50);});
    const celReady=celEnabled&&(!video.hidden||!document.getElementById('celPoster').hidden);
    const celStatus=document.getElementById('celStatus').textContent;
    mode.checked=false;mode.dispatchEvent(new Event('change',{bubbles:true}));
    return {bridge,dockHidden,pixel,poke,treated,celReady,celDecoded:decodedEver,celStatus,css,origin:location.origin,desktop:document.body.dataset.desktop};
  })()`);
  Object.assign(report, base);
  await sleep(130);
  const endBounds = win.getBounds();
  check(report, 'dragged', startBounds.x !== endBounds.x || startBounds.y !== endBounds.y, {startBounds, endBounds});
  for (const key of ['bridge', 'dockHidden', 'pixel', 'poke', 'treated', 'celReady']) check(report, key, base[key], base[key]);
  check(report, 'transparentBody', base.css === 'rgba(0, 0, 0, 0)' || base.css === 'transparent', base.css);
  check(report, 'origin', base.origin === 'dexter://app' && base.desktop === 'true', base.origin);
  if (process.env.DEXTER_DESKTOP_SMOKE_REQUIRE_VIDEO === '1') check(report, 'celDecoded', base.celDecoded, base.celStatus);
  check(report, 'alwaysOnTop', win.isAlwaysOnTop());
  const size = ws.petWindowSize(100);
  check(report, 'petWindowSize', endBounds.width === size.width && endBounds.height === size.height, endBounds);
  // macOS/Windows honour focusable:false; on Linux the WM may report otherwise, so only record it there.
  report.petFocusable = win.isFocusable();
  check(report, 'passiveFocusDefault', state.settings.passiveFocus === true && (process.platform === 'linux' || win.isFocusable() === false), {focusable: win.isFocusable()});

  // ---------------------------------------------------------- protocol containment
  const status = async u => (await net.fetch(u)).status;
  const denied = {main: await status('dexter://app/main.cjs'), core: await status('dexter://app/core/ollama.cjs'),
    smoke: await status('dexter://app/smoke.cjs'), preload: await status('dexter://app/preload-ui.cjs'),
    traversal: await status('dexter://app/ui/..%2Fmain.cjs'), query: await status('dexter://app/index.html?x=1')};
  check(report, 'protocolDenied', Object.values(denied).every(s => s === 403 || s === 404) && denied.main === 403 && denied.core === 403, denied);
  check(report, 'uiServed', (await status('dexter://app/ui/settings.html')) === 200 && (await status('dexter://app/ui/chat.js')) === 200);
  const range = await net.fetch('dexter://app/assets/cel-shaded/clips/slow_blink.webm', {headers: {Range: 'bytes=0-31'}});
  const rangeBytes = Buffer.from(await range.arrayBuffer());
  check(report, 'videoRange', range.status === 206 && rangeBytes.length === 32, {status: range.status, bytes: rangeBytes.length});

  // ---------------------------------------------------------- alpha hit routing (IPC, not physical)
  const points = await js(win, `(()=>{
    const pet=document.getElementById('pet'),sprite=document.getElementById('sprite'),b=pet.getBoundingClientRect();
    const c=document.createElement('canvas');c.width=c.height=64;const x2=c.getContext('2d',{willReadFrequently:true});x2.drawImage(sprite,0,0,64,64);
    const px=x2.getImageData(0,0,64,64).data;let opaque=null,transparent=null;
    for(let y=4;y<60;y++)for(let x=4;x<60;x++){const a=px[(y*64+x)*4+3];
      if(a>200&&!opaque)opaque={x:b.left+(x+.5)/64*b.width,y:b.top+(y+.5)/64*b.height};
      if(a===0&&!transparent)transparent={x:b.left+(x+.5)/64*b.width,y:b.top+(y+.5)/64*b.height};}
    return {opaque,transparent,above:{x:b.left+b.width/2,y:Math.max(2,b.top-30)}};
  })()`);
  async function hover(p) {
    await js(win, 'document.dispatchEvent(new MouseEvent("mousemove",' + JSON.stringify({clientX: p.x, clientY: p.y, bubbles: true}) + '))');
    await sleep(80);
    return state.overPet;
  }
  check(report, 'opaqueCaptured', await hover(points.opaque));
  check(report, 'transparentReleased', !(await hover(points.transparent)));
  check(report, 'headroomReleased', !(await hover(points.above)));

  // ---------------------------------------------------------- flip, hide, tray recovery, click-through recovery
  ctx.petMenu().items.find(i => i.label === 'Flip Dexter').click();
  check(report, 'mirrored', await waitFor(() => js(win, 'document.body.classList.contains("desktop-flipped")')));
  ctx.petMenu().items.find(i => i.label === 'Flip Dexter').click();
  check(report, 'unmirrored', await waitFor(() => js(win, '!document.body.classList.contains("desktop-flipped")')));
  win.showInactive();
  ctx.petMenu().items.find(i => i.label === 'Hide Dexter').click();
  check(report, 'hidden', !win.isVisible());
  check(report, 'trayShowEnabled', ctx.trayMenu().items.find(i => i.label === 'Show Dexter').enabled);
  state.tray.emit('click');
  check(report, 'trayRecovered', win.isVisible());
  ctx.trayMenu().items.find(i => i.label === 'Pass through all clicks').click();
  check(report, 'passThroughOn', state.passThrough === true);
  ctx.trayMenu().items.find(i => i.label === 'Restore Dexter').click();
  check(report, 'passThroughRecovered', state.passThrough === false && win.isVisible());
  check(report, 'trayMenuItems', ['Show Dexter', 'Hide Dexter', 'Restore Dexter', 'Talk to Dexter…', 'Settings…', 'Quit Dexter'].every(l => ctx.trayMenu().items.some(i => i.label === l)));

  // ---------------------------------------------------------- display recovery
  win.setBounds({...win.getBounds(), x: -20000, y: -20000});
  ctx.onDisplaysChanged('display-removed');
  await sleep(600);
  const recovered = win.getBounds();
  const areas = screen.getAllDisplays().map(d => d.workArea);
  check(report, 'displayRecovery', areas.some(a => recovered.x >= a.x && recovered.y >= a.y && recovered.x + recovered.width <= a.x + a.width && recovered.y + recovered.height <= a.y + a.height), recovered);

  // ---------------------------------------------------------- scale and opacity
  ctx.updateSettings({scale: 130});
  check(report, 'scaled', win.getBounds().width === ws.petWindowSize(130).width, win.getBounds());
  ctx.updateSettings({scale: 100, opacity: 0.1});
  check(report, 'opacityFloor', state.settings.opacity >= 0.4, state.settings.opacity);

  // ---------------------------------------------------------- check-in bubble and answer
  const shown = ctx.runCheckin({force: true});
  check(report, 'checkinShown', shown.shown);
  const bubble = await waitFor(() => js(win, `(()=>{const b=document.querySelector('.desktop-bubble');return b&&!b.hidden?{text:b.querySelector('.desktop-bubble-text').textContent,choices:b.querySelectorAll('.desktop-bubble-choices button').length,rect:b.getBoundingClientRect().toJSON()}:null})()`));
  check(report, 'checkinBubble', bubble && bubble.choices >= 2, bubble);
  check(report, 'bubbleCaptured', await hover({x: bubble.rect.left + 6, y: bubble.rect.top + 6}));
  await js(win, `document.querySelector('.desktop-bubble-choices button').click()`);
  const answered = await waitFor(() => !state.activeCheckin && js(win, `document.querySelector('.desktop-bubble-text').textContent`));
  check(report, 'checkinAnswered', Boolean(answered), answered);
  check(report, 'checkinEventsLogged', events.count('checkin', 'answered') === 1);

  // ---------------------------------------------------------- conversation without AI (no network)
  const chat = ctx.openChat();
  await loaded(chat);
  await waitFor(() => chat.isVisible());
  const send = async text => js(chat, `(()=>{const i=document.getElementById('input');i.value=${JSON.stringify(text)};document.getElementById('composer').requestSubmit();})()`);
  const before = ctx.conversation().size;
  await send('hello dexter?');
  check(report, 'localReply', await waitFor(() => ctx.conversation().size >= before + 2 && js(chat, `document.querySelectorAll('.msg-assistant').length>0`)));
  check(report, 'noEgressWhenDisabled', state.egressCount === 0, state.egressCount);
  await send('/treat');
  check(report, 'commandTreat', await waitFor(() => js(win, `document.getElementById('pet').dataset.state==='eating'`)));
  await send('/status');
  check(report, 'commandStatus', await waitFor(() => js(chat, `[...document.querySelectorAll('.msg-dexter .body')].some(n=>n.textContent.startsWith('State:'))`)));

  // ---------------------------------------------------------- local AI: streaming, cancel, offline
  const fake = await fakeModelServer();
  const set = ctx.updateSettings({aiEnabled: true, aiEndpoint: 'http://127.0.0.1:' + fake.port});
  check(report, 'aiEnabled', set.settings.aiEnabled && set.settings.aiEndpoint.endsWith(':' + fake.port), set.settings.aiEndpoint);
  await send('hello model');
  const streamed = await waitFor(() => js(chat, `(()=>{const b=[...document.querySelectorAll('.msg-assistant')].pop();return b&&b.className.includes('is-complete')?b.querySelector('.body').textContent:null})()`), 8000);
  check(report, 'streamedReply', streamed === 'Hff. Acceptable.', streamed);
  check(report, 'systemPromptSent', fake.seen[0]?.messages[0]?.role === 'system' && /Dexter/.test(fake.seen[0].messages[0].content) && fake.seen[0].model === 'dexter-smoke:latest');
  check(report, 'egressCounted', state.egressCount >= 2, state.egressCount);
  check(report, 'aiReady', state.aiStatus === 'ready', state.aiStatus);
  await send('slow please');
  await waitFor(() => js(chat, `!document.getElementById('stop').hidden`), 4000);
  await sleep(200);
  await js(chat, `document.getElementById('stop').click()`);
  const cancelled = await waitFor(() => js(chat, `(()=>{const b=[...document.querySelectorAll('.msg-assistant')].pop();return b&&b.className.includes('is-cancelled')})()`), 4000);
  check(report, 'cancelled', cancelled);
  await new Promise(r => { fake.server.closeAllConnections?.(); fake.server.close(r); });
  await send('are you there');
  const offline = await waitFor(() => (state.aiStatus === 'offline' ? state.aiStatus : null), 8000);
  check(report, 'offlineHandled', offline === 'offline', state.aiStatus);
  check(report, 'offlineNotice', await waitFor(() => js(chat, `!document.getElementById('notice').hidden`)));
  ctx.updateSettings({aiEnabled: false});
  check(report, 'aiOff', state.aiStatus === 'off');

  // ---------------------------------------------------------- optional speech degrades gracefully
  ctx.updateSettings({ttsEnabled: true, ttsEngine: 'system'});
  state.win.webContents.send('dexter:speech', {op: 'say', text: 'Hff.', interrupt: true});
  // macOS has on-device voices (expect speaking); a bare Linux runner has none (expect a graceful error).
  const tts = await waitFor(() => (/^(speaking|error)/.test(state.ttsStatus) ? state.ttsStatus : null), 6000);
  report.ttsOutcome = tts || state.ttsStatus;
  check(report, 'ttsSpeaksOrFailsGracefully', Boolean(tts), state.ttsStatus);
  check(report, 'petSurvivesSpeechOutcome', await js(win, 'Boolean(document.getElementById("pet"))'));
  ctx.updateSettings({ttsEnabled: false, ttsEngine: 'piper'});
  ctx.updateSettings({ttsEngine: 'system'});

  // ---------------------------------------------------------- settings window
  const settingsWin = ctx.openSettings();
  await loaded(settingsWin);
  const ui = await waitFor(() => js(settingsWin, `(()=>{
    const sections=document.querySelectorAll('main section').length;
    const unlabeled=[...document.querySelectorAll('[data-key]')].filter(el=>!el.closest('label')).length;
    const unnamed=[...document.querySelectorAll('button')].filter(b=>!(b.textContent.trim()||b.getAttribute('aria-label'))).length;
    const ready=document.querySelector('[data-key="scale"]').value!=='';
    return ready?{sections,unlabeled,unnamed,quietLoaded:document.querySelector('[data-key="quiet"]').checked===false}:null;
  })()`));
  check(report, 'settingsSections', ui && ui.sections === 11 && ui.unlabeled === 0 && ui.unnamed === 0, ui);
  await js(settingsWin, `(()=>{const r=document.querySelector('[data-key="scale"]');r.value='160';r.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  check(report, 'settingsAppliesLive', await waitFor(() => win.getBounds().width === ws.petWindowSize(160).width), win.getBounds());
  const rejected = ctx.updateSettings({aiEndpoint: 'http://user:pw@127.0.0.1:1'});
  check(report, 'endpointRejected', rejected.rejected.includes('aiEndpoint') && /Credentials/.test(rejected.endpointError), rejected.endpointError);
  await js(settingsWin, `document.getElementById('audit').click()`);
  const audit = await waitFor(() => js(settingsWin, `(()=>{const t=document.getElementById('auditTable');return t.hidden?null:[...t.querySelectorAll('tbody tr')].map(r=>r.children[0].textContent+':'+r.children[1].textContent)})()`));
  check(report, 'selfAuditNoFail', audit && audit.length >= 10 && !audit.some(r => r.endsWith(':FAIL')), audit);
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-report-')), 'report.json');
  await ctx.exportReport(out);
  const exported = fs.readFileSync(out, 'utf8');
  check(report, 'reportPrivate', !exported.includes('hello model') && !exported.includes('slow please') && JSON.parse(exported).kind === 'dexter-desktop-diagnostics');
  fs.rmSync(path.dirname(out), {recursive: true, force: true});
  check(report, 'historyNotPersisted', !fs.existsSync(path.join(ctx.app.getPath('userData'), 'conversation.json')));

  // ---------------------------------------------------------- resources
  const snap = ctx.snapshot();
  check(report, 'allRenderersIsolated', snap.windows.length === 3 && snap.windows.every(w => w.sandbox && w.contextIsolation && !w.nodeIntegration), snap.windows);
  await js(chat, `document.getElementById('closeChat').click()`);
  check(report, 'chatClosedReleased', await waitFor(() => state.chatWin === null));
  settingsWin.close();
  await waitFor(() => state.settingsWin === null);
  await sleep(1500);
  report.memoryAfterPanelsClosedMB = metric();
  report.memoryMB = Math.round(snap.memoryMB);
  report.windows = snap.windows.map(w => w.name + (w.sandbox && w.contextIsolation ? ':isolated' : ':UNSAFE'));
  check(report, 'listenersBounded', snap.maxIpcListeners <= 1, snap.maxIpcListeners);
  const captured = await win.capturePage();
  const bitmap = captured.toBitmap();
  report.screenshotAlphaCorners = bitmap.length >= 4 ? [bitmap[3], bitmap[bitmap.length - 1]] : [];
  console.log('[DEXTER DESKTOP SMOKE PASS] ' + JSON.stringify(report));
}

function run(ctx) {
  const timeout = setTimeout(() => { console.error('[DEXTER DESKTOP SMOKE] timeout'); ctx.app.exit(1); }, 90000);
  const phase = process.env.DEXTER_DESKTOP_SMOKE_PHASE || 'full';
  const job = phase === 'full' ? fullSmoke(ctx) : persistencePhase(ctx, phase);
  job.then(() => { clearTimeout(timeout); ctx.app.quit(); }).catch(error => {
    clearTimeout(timeout);
    console.error('[DEXTER DESKTOP SMOKE FAIL]', error.stack || String(error));
    ctx.app.exit(1);
  });
}
module.exports = {run};
