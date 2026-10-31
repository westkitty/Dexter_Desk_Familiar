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
for(const file of ['main.cjs','preload.cjs','window-state.cjs','renderer.js','overlay.css','package.json']){
 fs.copyFileSync(path.resolve(__dirname,'..',file),path.join(dest,file));
}
const htmlPath=path.join(dest,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/,
 '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' file:; connect-src \'none\'; img-src \'self\' file: data:; media-src \'self\' file:; script-src \'self\' file:; style-src \'self\' file:; worker-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">');
html=html.replace('</head>','<link rel="stylesheet" href="./overlay.css"></head>');
html=html.replace('</body>','<script defer src="./renderer.js"></script></body>');
fs.writeFileSync(htmlPath,html);
console.log('Prepared isolated desktop web payload in desktop/.stage/app');
