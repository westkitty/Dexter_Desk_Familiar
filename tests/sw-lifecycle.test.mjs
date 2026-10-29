import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {createContext,runInContext} from "node:vm";

const source=await readFile(fileURLToPath(new URL("../sw.js",import.meta.url)),"utf8");
const ORIGIN="http://127.0.0.1:4173";
const OLD="dexter-desk-familiar-last-known-good";
const NEW=source.match(/const CACHE="([^"]+)"/)?.[1];
assert.ok(NEW?.startsWith("dexter-desk-familiar-"),"test must load a real versioned Dexter worker");
const resolvePath=input=>new URL(typeof input==="string"?input:input.url,ORIGIN+"/sw.js").href;

function workerHarness({brokenAsset=null}={}){
 const listeners=new Map(),stores=new Map(),stats={skipWaiting:0,claimed:0,fetches:[]};
 const createCache=name=>{
   const values=new Map();
   return {
     values,
     async addAll(paths){
       for(const path of paths){
         if(path===brokenAsset)throw Error("Synthetic precache failure: "+path);
         values.set(resolvePath(path),new Response(name+":"+path));
       }
     },
     async put(path,response){values.set(resolvePath(path),response);},
     async match(path,{ignoreSearch=false}={}){
       const url=resolvePath(path);
       if(!ignoreSearch)return values.get(url)?.clone();
       const noQuery=x=>x.split("?")[0];
       for(const [key,value] of values)if(noQuery(key)===noQuery(url))return value.clone();
       return undefined;
     }
   };
 };
 const storage={
   async open(name){if(!stores.has(name))stores.set(name,createCache(name));return stores.get(name);},
   async delete(name){return stores.delete(name);},
   async keys(){return [...stores.keys()];},
   async match(path,options){for(const cache of stores.values()){const match=await cache.match(path,options);if(match)return match;}return undefined;}
 };
 const self={
   location:new URL(ORIGIN+"/sw.js"),
   addEventListener:(event,handler)=>listeners.set(event,handler),
   skipWaiting:()=>{stats.skipWaiting++;return Promise.resolve();},
   clients:{claim:()=>{stats.claimed++;return Promise.resolve();}}
 };
 runInContext(source,createContext({self,caches:storage,URL,Response,Promise,console}));
 async function dispatch(kind,request){
   const pending=[];let response;
   const event={request,waitUntil:task=>pending.push(Promise.resolve(task)),respondWith:task=>{response=Promise.resolve(task);}};
   const listener=listeners.get(kind);assert.ok(listener,"missing "+kind+" handler");listener(event);
   await Promise.all(pending);
   return response?await response:undefined;
 }
 return {storage,stores,stats,dispatch};
}

test("install does not force a new worker over an active session",async()=>{
 const worker=workerHarness();
 await worker.dispatch("install");
 assert.equal(worker.stats.skipWaiting,0,"updates must remain waiting until the old window closes");
});

test("failed partial precache deletes only failed version, keeping last good offline shell",async()=>{
 const worker=workerHarness({brokenAsset:"./icons/icon-192.png"});
 const old=await worker.storage.open(OLD);
 await old.put("./index.html",new Response("last-good-html"));
 await assert.rejects(worker.dispatch("install"),/Synthetic precache failure/);
 assert.deepEqual(await worker.storage.keys(),[OLD]);
 assert.equal(await (await old.match("./index.html")).text(),"last-good-html");
});

test("incomplete current cache cannot cause last good cache to be deleted",async()=>{
 const worker=workerHarness();
 const old=await worker.storage.open(OLD);
 await old.put("./index.html",new Response("last-good-html"));
 const fresh=await worker.storage.open(NEW);
 await fresh.put("./index.html",new Response("partial-html"));
 try{await worker.dispatch("activate");}catch{}
 assert.ok((await worker.storage.keys()).includes(OLD),"keep older shell until the new one is complete");
});

test("fetch prefers its own version even if an older cache was created first",async()=>{
 const worker=workerHarness();
 const old=await worker.storage.open(OLD),fresh=await worker.storage.open(NEW);
 await old.put("./index.html",new Response("OLD"));
 await fresh.put("./index.html",new Response("NEW"));
 const response=await worker.dispatch("fetch",{method:"GET",mode:"same-origin",url:ORIGIN+"/index.html"});
 assert.equal(await response.text(),"NEW");
});

test("unknown same-origin resources cannot leak from another cache",async()=>{
 const worker=workerHarness();
 const unrelated=await worker.storage.open("unrelated-app-cache");
 await unrelated.put("./private-note.txt",new Response("unrelated-cached-content"));
 const response=await worker.dispatch("fetch",{method:"GET",mode:"same-origin",url:ORIGIN+"/private-note.txt"});
 assert.equal(response.status,404);
});

test("complete activation removes only superseded Dexter cache and claims clients",async()=>{
 const worker=workerHarness();
 const old=await worker.storage.open(OLD);
 await old.put("./index.html",new Response("last-good-html"));
 await worker.dispatch("install");
 await worker.dispatch("activate");
 const names=await worker.storage.keys();
 assert.equal(names.includes(OLD),false);
 assert.equal(names.includes(NEW),true);
 assert.equal(worker.stats.claimed,1);
});
