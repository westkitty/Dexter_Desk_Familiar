'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const from=path.resolve(__dirname,'../..');
const dest=path.resolve(__dirname,'../.stage/app');
const manifestPath=path.join(from,'scripts/build-release.mjs');
assert(fs.existsSync(manifestPath),'Expected the parent Dexter repository');
const files=['index.html','app.js','styles.css','src','assets','icons','manifest.webmanifest'];
fs.mkdirSync(dest,{recursive:true});
for(const file of files){
 const source=path.join(from,file);
 if(!fs.existsSync(source))throw new Error('Missing source: '+file);
 fs.cpSync(source,path.join(dest,file),{recursive:true,force:true});
}
for(const file of ['main.cjs','preload.cjs','window-state.cjs','renderer.js','hit-test.js','overlay.css','package.json']){
 fs.copyFileSync(path.resolve(__dirname,'..',file),path.join(dest,file));
}
// Bind pointer movement to the *window*, not to the PWA's in-scene pet position.
// Patch only the copied desktop payload; never change the source PWA app.js.
const stagedAppPath=path.join(dest,'app.js');
let stagedApp=fs.readFileSync(stagedAppPath,'utf8');
for(const hook of [
 'pet.addEventListener("pointerdown",event=>{',
 'pet.addEventListener("pointermove",event=>{',
 'pet.addEventListener("pointerup",event=>{',
 'pet.addEventListener("pointercancel",()=>{'
]){
 if(stagedApp.split(hook).length!==2)throw new Error('Desktop hook mismatch: '+hook);
 stagedApp=stagedApp.replace(hook,'if(!window.dexterDesktop) '+hook);
}
const buttonHook='document.querySelectorAll("[data-action]")';
if(stagedApp.split(buttonHook).length!==2)throw new Error('Desktop reaction insertion point changed');
stagedApp=stagedApp.replace(buttonHook,`
if(window.dexterDesktop){
 document.addEventListener("dexter-desktop-poke",()=>{
  lastActivity=Date.now();
  const count=pokeRhythm.tap();
  if(count>=3)reaction("huffing",86,1700,"Repeated poking. The complaint is formal.");
  else if(count===2)reaction("judging",78,1400,"An additional inquiry. Noted.");
  else reaction("watching",70,1600,"Personal space is a concept.");
 });
 document.addEventListener("dexter-desktop-moved",()=>{
  lastActivity=Date.now();pokeRhythm.reset();
  bus.publish("judging",30,1100);speak("Relocated. Without consultation.",true);tick();
 });
}
`+buttonHook);
fs.writeFileSync(stagedAppPath,stagedApp);
const htmlPath=path.join(dest,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
// Original CSP remains valid for the privileged, same-origin dexter://app scheme.
html=html.replace('</head>','<link rel="stylesheet" href="./overlay.css"></head>');
html=html.replace('</body>','<script defer src="./hit-test.js"></script><script defer src="./renderer.js"></script></body>');
fs.writeFileSync(htmlPath,html);
console.log('Prepared isolated desktop web payload in desktop/.stage/app');
