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
  if (process.env.DEXTER_SMOKE_TRACE === '1') console.log('[check] ' + name + ' ' + Boolean(ok));
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
  check(report, 'semanticThinking', ctx.semantic.history().some(h => h.to === 'thinking' && h.reason === 'model request'));
  // Continuity firewall: a note reaches the model only when the user allows it.
  ctx.notes().add('NOTE-FIREWALL-7');
  const lastFor = q => fake.seen.filter(p => p.messages.at(-1).content === q).pop();
  await send('firewall closed');
  await waitFor(() => lastFor('firewall closed') && state.aiStatus === 'ready', 8000);
  check(report, 'notesBlockedByDefault', lastFor('firewall closed') && !JSON.stringify(lastFor('firewall closed')).includes('NOTE-FIREWALL-7'));
  ctx.updateSettings({notesInContext: true});
  await send('firewall open');
  await waitFor(() => lastFor('firewall open') && state.aiStatus === 'ready', 8000);
  check(report, 'notesCrossWhenAllowed', lastFor('firewall open') && lastFor('firewall open').messages[0].content.includes('NOTE-FIREWALL-7') && ctx.notes().crossings >= 1);
  ctx.updateSettings({notesInContext: false});
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
  check(report, 'settingsSections', ui && ui.sections === 16 && ui.unlabeled === 0 && ui.unnamed === 0, ui);
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

  await parity2(ctx, report, {win, chat, settingsWin, send});

  // ---------------------------------------------------------- resources
  const snap = ctx.snapshot();
  check(report, 'allRenderersIsolated', snap.windows.length >= 3 && snap.windows.every(w => w.sandbox && w.contextIsolation && !w.nodeIntegration), snap.windows);
  // The click closes (destroys) the very frame running it, so its result can never
  // resolve; assert the observable outcome instead of awaiting the script.
  js(chat, `document.getElementById('closeChat').click()`).catch(() => {});
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

// WestCat parity round 2: modes, router, sessions, check-in follow-ups and editor,
// journal, packet, inspector, detached bubble, hotkey, Spaces, tricks, typewriter,
// demo, Piper voice listing and push-to-talk transcription with a fake whisper.cpp.
async function parity2(ctx, report, {win, chat, settingsWin, send}) {
  const {state} = ctx;
  const userData = ctx.app.getPath('userData');
  ctx.updateSettings({motion: 'full', quiet: false});
  // Router: natural-language intent handled locally.
  await send('what mode are we in');
  check(report, 'routerIntent', await waitFor(() => js(chat, `[...document.querySelectorAll('.msg-dexter .body')].some(n=>n.textContent.startsWith('Mode: Plain'))`)));
  check(report, 'routeShown', await waitFor(() => js(chat, `document.getElementById('route').textContent.includes('change mode')||document.getElementById('route').textContent.includes('mode')`)));
  // Modes overlay settings without rewriting them.
  ctx.updateSettings({checkinsEnabled: true});
  await send('/mode work');
  check(report, 'modeWork', state.settings.mode === 'work' && state.settings.checkinsEnabled === true && ctx.inspectorSnapshot().mode.label === 'Work');
  ctx.updateSettings({mode: 'plain', checkinsEnabled: false});
  // Quick-add custom check-in, then a custom question with a follow-up, answered through the pet bubble.
  await send('/ask Coffee yet? | Yes | No');
  check(report, 'quickAsk', await waitFor(() => state.settings.customCheckins.length === 1));
  ctx.updateSettings({checkinSource: 'custom', customCheckins: [{text: 'Smoke question?', choices: [
    {label: 'First', reply: 'First reply.', followUp: {text: 'Follow-up?', choices: [{label: 'Deep', reply: 'Deep reply.'}, {label: 'Shallow', reply: 'Shallow reply.'}]}},
    {label: 'Second', reply: 'Second reply.'}]}]});
  ctx.updateSettings({keepJournal: true});
  ctx.runCheckin({force: true});
  const q1 = await waitFor(() => js(win, `(()=>{const b=document.querySelector('.desktop-bubble');return b&&!b.hidden&&b.querySelector('.desktop-bubble-text').getAttribute('aria-label')})()`));
  check(report, 'customCheckinShown', q1 === 'Smoke question?', q1);
  await js(win, `document.querySelector('.desktop-bubble-choices button').click()`);
  const q2 = await waitFor(() => js(win, `(()=>{const t=document.querySelector('.desktop-bubble-text').getAttribute('aria-label');return t==='Follow-up?'?t:null})()`));
  check(report, 'followUpShown', q2 === 'Follow-up?', q2);
  await js(win, `document.querySelector('.desktop-bubble-choices button').click()`);
  check(report, 'followUpAnswered', await waitFor(() => js(win, `document.querySelector('.desktop-bubble-text').getAttribute('aria-label')==='Deep reply.'`)));
  check(report, 'journalRecorded', await waitFor(() => ctx.journal().read().filter(j => j.kind === 'checkin').length === 2));
  ctx.updateSettings({keepJournal: false, checkinSource: 'mixed'});
  check(report, 'journalDeletedOnDisable', !fs.existsSync(path.join(userData, 'journal.jsonl')));
  // Typewriter reveals progressively (full motion), screen readers get the whole text.
  state.win.webContents.send('dexter:bubble', {kind: 'say', text: 'This sentence is long enough to be typed out slowly.', timeoutMs: 6000});
  const partial = await js(win, `new Promise(r=>setTimeout(()=>r(document.querySelector('.desktop-bubble-text').textContent.length),120))`);
  check(report, 'typewriterProgressive', partial > 0 && partial < 52, partial);
  check(report, 'typewriterCompletes', await waitFor(() => js(win, `document.querySelector('.desktop-bubble-text').textContent==='This sentence is long enough to be typed out slowly.'`), 4000));
  // Tricks animate the sprite.
  await js(win, `window.__gags=0;const o=Element.prototype.animate;Element.prototype.animate=function(...a){window.__gags++;return o.apply(this,a)};true`);
  state.win.webContents.send('dexter:gag', 'hop');
  check(report, 'gagAnimated', await waitFor(() => js(win, 'window.__gags>0')));
  // Sessions: start a 3-second session and observe halfway and end milestones.
  ctx.startSession(0.05);
  check(report, 'sessionStarted', ctx.workSession.snapshot().active);
  check(report, 'sessionHalf', await waitFor(() => state.sessionMilestone === 'half', 4000));
  check(report, 'sessionEnded', await waitFor(() => !ctx.workSession.snapshot().active, 5000));
  ctx.startSession(25); ctx.pauseSession();
  check(report, 'sessionPaused', ctx.workSession.snapshot().paused);
  ctx.stopSession();
  // Demo playback through the bubble.
  ctx.demo.play();
  check(report, 'demoPlays', await waitFor(() => js(win, `(document.querySelector('.desktop-bubble-text').getAttribute('aria-label')||'').includes('demonstration')`)));
  ctx.demo.stop();
  // Retry, compact and packet.
  check(report, 'retryAvailable', state.lastUserText === 'are you there');
  await send('/compact');
  check(report, 'compactToggled', await waitFor(() => js(chat, `document.body.classList.contains('compact')`)));
  await send('/compact');
  const packetFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-packet-')), 'p.md');
  await ctx.exportPacket(packetFile);
  check(report, 'packetExported', fs.readFileSync(packetFile, 'utf8').includes('# Dexter context packet'));
  fs.rmSync(path.dirname(packetFile), {recursive: true, force: true});
  // Inspector window with real data.
  const inspector = ctx.openInspector();
  await loaded(inspector);
  check(report, 'inspectorRenders', await waitFor(() => js(inspector, `document.querySelectorAll('#familiar dd').length>=3 && document.getElementById('auditResult').textContent.startsWith('Result:')`), 6000));
  // Detached bubble window.
  ctx.updateSettings({bubbleMode: 'window'});
  ctx.showBubble({kind: 'reply', text: 'Detached bubble line.', timeoutMs: 6000});
  const bubbleOk = await waitFor(async () => state.bubbleWin && !state.bubbleWin.isDestroyed() && !state.bubbleWin.webContents.isLoading() &&
    await js(state.bubbleWin, `!document.getElementById('bubble').hidden && document.getElementById('text').textContent`), 6000);
  check(report, 'detachedBubble', bubbleOk === 'Detached bubble line.', bubbleOk);
  check(report, 'detachedBubbleNoFocus', state.bubbleWin.isFocusable() === false || process.platform === 'linux');
  ctx.updateSettings({bubbleMode: 'pet'});
  check(report, 'detachedBubbleClosed', await waitFor(() => !state.bubbleWin));
  // Global hotkey: registers one fixed combination, or reports that it is unavailable.
  ctx.updateSettings({globalHotkey: 'CommandOrControl+Shift+K'});
  report.hotkey = state.hotkeyStatus;
  check(report, 'hotkeyAttempted', /^(registered|unavailable)/.test(state.hotkeyStatus), state.hotkeyStatus);
  ctx.updateSettings({globalHotkey: ''});
  check(report, 'hotkeyReleased', state.hotkeyStatus === 'off');
  // All Spaces / full screen.
  ctx.updateSettings({allSpaces: true});
  if (process.platform === 'darwin') check(report, 'allSpaces', win.isVisibleOnAllWorkspaces());
  ctx.updateSettings({allSpaces: false});
  // Piper voice folder listing.
  const voices = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-voices-'));
  fs.writeFileSync(path.join(voices, 'en_GB-dexter-low.onnx'), 'x');
  ctx.updateSettings({piperVoicesDir: voices});
  const listed = await js(settingsWin, `window.dexterUI.invoke('piper:voices')`);
  check(report, 'piperVoicesListed', listed.length === 1 && listed[0].name === 'en GB dexter low', listed);
  fs.rmSync(voices, {recursive: true, force: true});
  // Push-to-talk transcription with a fake, local whisper.cpp program.
  const sttDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-stt-fake-'));
  const fakeWhisper = path.join(sttDir, 'whisper-cli'), model = path.join(sttDir, 'ggml-tiny.bin');
  fs.writeFileSync(fakeWhisper, '#!/bin/sh\nout=""\nwhile [ $# -gt 0 ]; do if [ "$1" = "-of" ]; then out="$2"; fi; shift; done\nprintf "Hello from whisper" > "$out.txt"\n', {mode: 0o755});
  fs.writeFileSync(model, 'x');
  const sttOff = await js(chat, `window.dexterUI.invoke('stt:prepare')`);
  check(report, 'sttOffByDefault', sttOff.ok === false);
  ctx.updateSettings({sttEnabled: true, whisperPath: fakeWhisper, whisperModel: model});
  check(report, 'micButtonShown', await waitFor(() => js(chat, `!document.getElementById('mic').hidden`)));
  const transcript = await js(chat, `window.dexterUI.invoke('stt:transcribe', window.DexterWav.encodeWav(new Float32Array(3200)))`);
  check(report, 'sttTranscribed', transcript.ok && transcript.text === 'Hello from whisper', transcript);
  ctx.updateSettings({sttEnabled: false});
  fs.rmSync(sttDir, {recursive: true, force: true});
  // Developer menu exists only when enabled.
  ctx.updateSettings({developerTools: true});
  check(report, 'devMenu', ctx.devMenu().items.length >= 6 && ctx.petMenu().items.some(i => i.label === 'Developer'));
  ctx.updateSettings({developerTools: false});
  check(report, 'devMenuHidden', !ctx.petMenu().items.some(i => i.label === 'Developer'));
  // Notifications preference is honored without error.
  ctx.updateSettings({nativeNotifications: true});
  report.notificationsSupported = require('electron').Notification.isSupported();
  ctx.updateSettings({nativeNotifications: false});
  inspector.close();
}
function run(ctx) {
  const timeout = setTimeout(() => { console.error('[DEXTER DESKTOP SMOKE] timeout'); ctx.app.exit(1); }, 150000);
  const phase = process.env.DEXTER_DESKTOP_SMOKE_PHASE || 'full';
  const job = phase === 'full' ? fullSmoke(ctx) : persistencePhase(ctx, phase);
  job.then(() => { clearTimeout(timeout); ctx.app.quit(); }).catch(error => {
    clearTimeout(timeout);
    console.error('[DEXTER DESKTOP SMOKE FAIL]', error.stack || String(error));
    ctx.app.exit(1);
  });
}
module.exports = {run};
