import {createHash} from "node:crypto";
import {copyFile, mkdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const dist=join(root,"dist");
const files=["index.html","styles.css","app.js","sw.js","manifest.webmanifest",
 "src/behavior.mjs","src/observations.mjs","src/director.mjs","src/renderer.mjs","src/audio.mjs","src/settings.mjs",
 "assets/dexter-sit-96.png","assets/dexter-stand-96.png","assets/dexter-rest-96.png",
 "icons/icon-192.png","icons/icon-512.png"];
const sizes={"assets/dexter-sit-96.png":96,"assets/dexter-stand-96.png":96,"assets/dexter-rest-96.png":96,
 "icons/icon-192.png":192,"icons/icon-512.png":512};
const budget=2*1024*1024;
const entries=[];
let total=0;
for(const path of files) {
 const bytes=await readFile(join(root,path));
 if(!bytes.length)throw Error("Empty app asset: "+path);
 if(sizes[path]){
  if(bytes.length<24||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||
    bytes.toString("ascii",12,16)!=="IHDR"||
    bytes.readUInt32BE(16)!==sizes[path]||bytes.readUInt32BE(20)!==sizes[path])
   throw Error("PNG missing or wrong dimensions: "+path);
 }
 total+=bytes.length;
 entries.push({path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
const manifest=JSON.parse(await readFile(join(root,"manifest.webmanifest"),"utf8"));
if(manifest.start_url!=="./"||manifest.scope!=="./"||
 !manifest.icons?.every(i=>files.includes(i.src.replace(/^\.\//,""))))
 throw Error("Manifest must use relative and existing icon paths");
if(total>budget)throw Error("Web release over 2 MiB");
await rm(dist,{recursive:true,force:true});
for(const path of files){
 await mkdir(dirname(join(dist,path)),{recursive:true});
 await copyFile(join(root,path),join(dist,path));
}
await writeFile(join(dist,".nojekyll"),"");
const report={project:"Dexter Desk Familiar",version:JSON.parse(await readFile(join(root,"package.json"),"utf8")).version,
 files:entries,totalBytes:total};
await writeFile(join(dist,"release-manifest.json"),JSON.stringify(report,null,2)+"\n");
if(total+(await stat(join(dist,"release-manifest.json"))).size>budget)throw Error("Final web release exceeds 2 MiB");
console.log("Built audited Dexter static bundle: "+files.length+" files / "+total+" bytes");
