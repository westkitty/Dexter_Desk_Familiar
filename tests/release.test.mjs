import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const dist=join(root,"dist");
test("distribution publishes only the explicit app allowlist",async()=>{
 const report=JSON.parse(await readFile(join(dist,"release-manifest.json"),"utf8"));
 assert.equal(report.files.length,17);
 assert.ok(report.totalBytes<2*1024*1024);
 for(const file of report.files){
  assert.match(file.path,/^(?:src\/|assets\/|icons\/)?[a-zA-Z0-9_-]+\.(?:html|css|js|mjs|png|webmanifest)$/);
  const bytes=await readFile(join(dist,file.path));
  assert.equal(bytes.length,file.bytes,file.path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256,file.path);
 }
 const names=await readdir(dist);
 for(const forbidden of ["README.md","OPERATIONAL_STATE.md","dev-server.mjs","package.json",
 "tests","docs",".github","node_modules"])assert.equal(names.includes(forbidden),false,forbidden);
 assert.ok(names.includes(".nojekyll"));
});
test("project Pages paths stay relative and application has no remote script tag",async()=>{
 const html=await readFile(join(dist,"index.html"),"utf8");
 for(const path of ["app.js","styles.css","manifest.webmanifest"])assert.ok(html.includes("./"+path));
 assert.doesNotMatch(html,/<script[^>]*src=["']https?:/);
 const manifest=JSON.parse(await readFile(join(dist,"manifest.webmanifest"),"utf8"));
 assert.equal(manifest.start_url,"./");assert.equal(manifest.scope,"./");
 const app=await readFile(join(dist,"app.js"),"utf8");
 for(const match of app.matchAll(/from\s*["'](\.\/src\/[^"']+)["']/g)){
   const file=join(dist,match[1]);
   assert.ok((await readFile(file)).length>0,"Missing app import: "+match[1]);
 }
});
