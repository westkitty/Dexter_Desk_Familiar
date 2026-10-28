const CACHE="dexter-desk-familiar-v1";
const SHELL=["./","./index.html","./styles.css","./app.js","./src/behavior.mjs","./manifest.webmanifest","./assets/dexter-sit-96.png","./assets/dexter-stand-96.png","./assets/dexter-rest-96.png","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith("dexter-desk-familiar-")&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin){event.respondWith(Response.error());return}
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>{
  if(cached)return cached;
  if(event.request.mode==="navigate")return caches.match("./index.html").then(fallback=>fallback||new Response("Offline shell unavailable",{status:503}));
  return new Response("Not in offline app cache",{status:404,headers:{"Content-Type":"text/plain"}});
 }));
});
