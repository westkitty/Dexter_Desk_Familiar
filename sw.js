const CACHE="dexter-desk-familiar-v3";
const PREFIX="dexter-desk-familiar-";
const SHELL=["./","./index.html","./styles.css","./app.js","./src/behavior.mjs","./src/observations.mjs","./src/director.mjs","./src/renderer.mjs","./src/audio.mjs","./src/settings.mjs","./src/interaction.mjs","./src/remarks.mjs","./manifest.webmanifest","./assets/dexter-sit-96.png","./assets/dexter-stand-96.png","./assets/dexter-rest-96.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await cache.addAll(SHELL);}
  catch(error){await caches.delete(CACHE);throw error;}
  await self.skipWaiting();
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  await self.clients.claim();
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith(PREFIX)&&name!==CACHE).map(name=>caches.delete(name)));
 })());
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin){event.respondWith(Response.error());return;}
 event.respondWith((async()=>{
  // Never search older cache namespaces or unrelated application caches.
  const cache=await caches.open(CACHE);
  const cached=await cache.match(event.request,{ignoreSearch:true});
  if(cached)return cached;
  if(event.request.mode==="navigate")return await cache.match("./index.html")||new Response("Offline shell unavailable",{status:503});
  return new Response("Not part of Dexter's offline shell",{status:404,headers:{"Content-Type":"text/plain"}});
 })());
});
