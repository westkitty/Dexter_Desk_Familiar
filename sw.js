// All paths are relative to the service worker's own install scope.
// Bump CACHE when any bundled shell asset changes.
const CACHE="dexter-desk-familiar-v3";
const PREFIX="dexter-desk-familiar-";
const SHELL=["./","./index.html","./styles.css","./app.js","./src/behavior.mjs","./src/observations.mjs","./src/director.mjs","./src/renderer.mjs","./src/audio.mjs","./src/settings.mjs","./src/interaction.mjs","./manifest.webmanifest","./assets/dexter-sit-96.png","./assets/dexter-stand-96.png","./assets/dexter-rest-96.png","./icons/icon-192.png","./icons/icon-512.png"];
const ALLOWED=new Set(SHELL.map(path=>new URL(path,self.location.href).href));

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try { await cache.addAll(SHELL); }
    catch(error){ await caches.delete(CACHE); throw error; }
    // Intentionally no skipWaiting(): an open Dexter window retains its current
    // controller and matching cached asset version until its client closes.
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await Promise.all(SHELL.map(path=>cache.match(path)));
    if(cached.some(response=>!response))throw Error("Dexter offline shell is incomplete");
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin){event.respondWith(Response.error());return;}
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=new URL(url.href);key.search="";key.hash="";
    if(ALLOWED.has(key.href)){
      const cached=await cache.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
    }
    if(event.request.mode==="navigate"){
      return await cache.match("./index.html")||new Response("Offline shell unavailable",{status:503});
    }
    return new Response("Not part of Dexter's offline shell",{status:404,headers:{"Content-Type":"text/plain"}});
  })());
});
