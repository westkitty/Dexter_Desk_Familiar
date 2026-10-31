import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {verifyPublished} from "../scripts/verify-pages.mjs";
const sha="0123456789abcdef0123456789abcdef01234567";
const bytes=Buffer.from("local Dexter", "utf8");
const digest=createHash("sha256").update(bytes).digest("hex");
const manifest={sourceCommit:sha,totalBytes:bytes.length*10,files:Array.from({length:10},(_,i)=>({
 path:"src/test"+i+".mjs",bytes:bytes.length,sha256:digest
}))};
function fixture({corrupt=false,revision=sha,docStatus=404}={}){
 return async url=>{
  const path=new URL(url).pathname.split("/").pop();
  if(path==="release-manifest.json")return new Response(JSON.stringify({...manifest,sourceCommit:revision}),{status:200});
  if(path==="README.md"||path==="OPERATIONAL_STATE.md")return new Response("",{status:docStatus});
  return new Response(corrupt?"bad bytes":bytes,{status:200});
 };
}
test("deployment proof checks SHA, content hashes, total, and exclusions",async()=>{
 const result=await verifyPublished({expectedCommit:sha,fetchImpl:fixture(),retries:1});
 assert.equal(result.verifiedFiles,10);
 assert.equal(result.totalBytes,bytes.length*10);
});
test("wrong commit cannot masquerade as a successful deployment",async()=>{
 await assert.rejects(verifyPublished({expectedCommit:sha,fetchImpl:fixture({revision:"a".repeat(40)}),retries:1}),/revision/);
});
test("tampered asset and accidentally hosted docs fail the delivery gate",async()=>{
 await assert.rejects(verifyPublished({expectedCommit:sha,fetchImpl:fixture({corrupt:true}),retries:1}),/differs/);
 await assert.rejects(verifyPublished({expectedCommit:sha,fetchImpl:fixture({docStatus:200}),retries:1}),/non-release file/);
});
test("public proof never follows a user-controlled or untrusted Pages URL",async()=>{
 await assert.rejects(verifyPublished({siteUrl:"https://example.com/",expectedCommit:sha,fetchImpl:fixture()}),/Unexpected Pages/);
});
