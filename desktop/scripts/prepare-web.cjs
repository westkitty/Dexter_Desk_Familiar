'use strict';
// Stage the isolated desktop payload. The browser/PWA source files are copied,
// never edited in place; desktop-only hooks are applied to the staged copy and
// each hook asserts that its insertion point exists exactly once.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const from = path.resolve(__dirname, '../..');
const desktop = path.resolve(__dirname, '..');
const dest = path.resolve(desktop, '.stage/app');
assert(fs.existsSync(path.join(from, 'scripts/build-release.mjs')), 'Expected the parent Dexter repository');
// Start clean so removed files can never linger in a packaged build.
fs.rmSync(dest, {recursive: true, force: true});
fs.mkdirSync(dest, {recursive: true});
for (const file of ['index.html', 'app.js', 'styles.css', 'src', 'assets', 'icons', 'manifest.webmanifest']) {
  const source = path.join(from, file);
  if (!fs.existsSync(source)) throw new Error('Missing source: ' + file);
  fs.cpSync(source, path.join(dest, file), {recursive: true, force: true});
}
for (const file of ['main.cjs', 'smoke.cjs', 'preload.cjs', 'preload-ui.cjs', 'window-state.cjs', 'renderer.js', 'hit-test.js',
  'speech-queue.js', 'audio-wav.js', 'overlay.css', 'package.json']) {
  fs.copyFileSync(path.join(desktop, file), path.join(dest, file));
}
for (const dir of ['core', 'ui']) fs.cpSync(path.join(desktop, dir), path.join(dest, dir), {recursive: true, force: true});

function patchOnce(source, hook, replacement, label) {
  if (source.split(hook).length !== 2) throw new Error('Desktop hook mismatch: ' + label);
  return source.replace(hook, replacement);
}
const stagedAppPath = path.join(dest, 'app.js');
let stagedApp = fs.readFileSync(stagedAppPath, 'utf8');
// Bind pointer movement to the *window*, not to the PWA's in-scene pet position.
for (const hook of [
  'pet.addEventListener("pointerdown",event=>{',
  'pet.addEventListener("pointermove",event=>{',
  'pet.addEventListener("pointerup",event=>{',
  'pet.addEventListener("pointercancel",()=>{'
]) stagedApp = patchOnce(stagedApp, hook, 'if(!window.dexterDesktop) ' + hook, hook);
// Attention intensity: the desktop may replace the ambient budget profile.
stagedApp = patchOnce(stagedApp,
  'const remarks=createRemarks(),attentionBudget=createAttentionBudget(),',
  'let attentionBudget=createAttentionBudget();document.addEventListener("dexter-desktop-intensity",event=>{attentionBudget=createAttentionBudget(event.detail||{})});const remarks=createRemarks(),',
  'attention budget');
const buttonHook = 'document.querySelectorAll("[data-action]")';
stagedApp = patchOnce(stagedApp, buttonHook, `
if(window.dexterDesktop){
 document.addEventListener("dexter-desktop-poke",()=>{
  lastActivity=Date.now();
  if(manualNap){pokeRhythm.reset();reaction("huffing",88,1800,"Woken. Against policy.");return;}
  const count=pokeRhythm.tap();
  if(count>=3)reaction("huffing",86,1700,"Repeated poking. The complaint is formal.");
  else if(count===2)reaction("judging",78,1400,"An additional inquiry. Noted.");
  else reaction("watching",70,1600,"Personal space is a concept.");
 });
 document.addEventListener("dexter-desktop-moved",()=>{
  lastActivity=Date.now();pokeRhythm.reset();
  bus.publish("judging",30,1100);speak("Relocated. Without consultation.",true);tick();
 });
 // Main-process signals (conversation, check-ins, lifecycle) use the same priority bus.
 document.addEventListener("dexter-desktop-signal",event=>{
  const d=event.detail||{};
  try{bus.publish(d.state,Math.min(94,Math.max(1,Number(d.priority)||50)),Math.min(60000,Math.max(300,Number(d.ms)||1500)));}catch{return;}
  if(d.state!=="sleeping"&&d.state!=="resting")manualNap=false;
  lastActivity=Date.now();
  if(d.line)speak(String(d.line).slice(0,200),true);
  explicitCelState=d.state;
  try{tick();}finally{explicitCelState=null;}
 });
}
` + buttonHook, 'reaction insertion point');
fs.writeFileSync(stagedAppPath, stagedApp);

const htmlPath = path.join(dest, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
// Desktop-only: Piper audio is played from an in-memory blob URL. connect-src stays 'none'.
html = patchOnce(html, "media-src 'self';", "media-src 'self' blob:;", 'media CSP');
html = patchOnce(html, '</head>', '<link rel="stylesheet" href="./overlay.css"></head>', 'head');
html = patchOnce(html, '</body>', '<script defer src="./hit-test.js"></script><script defer src="./speech-queue.js"></script><script defer src="./renderer.js"></script></body>', 'body');
fs.writeFileSync(htmlPath, html);
console.log('Prepared isolated desktop web payload in desktop/.stage/app');
