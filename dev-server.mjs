import{createServer}from"node:http";import{readFile,stat}from"node:fs/promises";import{resolve,extname,sep}from"node:path";
const port=Number(process.env.PORT||4173),host="127.0.0.1",root=resolve(import.meta.dirname||new URL(".",import.meta.url).pathname);
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".png":"image/png",".webmanifest":"application/manifest+json"};
const allowed=new Set(["/","/index.html","/styles.css","/app.js","/src/behavior.mjs","/src/observations.mjs","/src/director.mjs","/src/renderer.mjs","/src/audio.mjs","/src/settings.mjs","/src/interaction.mjs","/src/remarks.mjs","/src/attention.mjs","/src/presence.mjs","/src/animation.mjs","/src/locomotion.mjs","/manifest.webmanifest","/sw.js","/assets/dexter-sit-96.png","/assets/dexter-stand-96.png","/assets/dexter-rest-96.png","/assets/dexter-snes-32-candidate.png","/icons/icon-192.png","/icons/icon-512.png"]);
createServer(async(req,res)=>{try{const path=new URL(req.url||"/","http://localhost").pathname;const target=path==="/"?"/index.html":path;
if(!allowed.has(target)){res.writeHead(404);res.end("Not found");return}
const file=resolve(root,"."+target);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
const payload=await readFile(file);res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream","Cache-Control":"no-cache","X-Content-Type-Options":"nosniff"});res.end(payload)
}catch{res.writeHead(500);res.end("Internal error")}}).listen(port,host,()=>{process.stdout.write("Dexter Desk Familiar: http://"+host+":"+port+"\n")});
