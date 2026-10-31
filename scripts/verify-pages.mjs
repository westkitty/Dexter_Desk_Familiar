import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

// Verifies the actual Pages payload, not merely a successful deployment action.
// No credentials or repository files are sent to the site.
const ORIGIN="https://westkitty.github.io";
const PATH="/Dexter_Desk_Familiar/";
const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

export async function verifyPublished({
 siteUrl=ORIGIN+PATH,
 expectedCommit,
 fetchImpl=fetch,
 retries=8,
 retryMs=1600,
 wait=sleep
}={}){
 if(!/^[0-9a-f]{40}$/i.test(expectedCommit??""))throw Error("Expected Git commit SHA is required");
 const base=new URL(siteUrl);
 if(base.origin!==ORIGIN||base.pathname!==PATH||base.search||base.hash)
  throw Error("Unexpected Pages origin, path or URL suffix");
 const url=path=>{
  const output=new URL(path,base);
  output.searchParams.set("verify",expectedCommit.slice(0,12));
  return output;
 };
 const read=async path=>fetchImpl(url(path),{cache:"no-store",redirect:"error"});
 let manifest=null,lastError=null;
 for(let attempt=0;attempt<Math.max(1,retries);attempt++){
  try{
   const response=await read("release-manifest.json");
   if(!response.ok)throw Error("Manifest HTTP "+response.status);
   const candidate=await response.json();
   if(candidate.sourceCommit!==expectedCommit)
    throw Error("Published revision "+String(candidate.sourceCommit)+" != "+expectedCommit);
   if(!Array.isArray(candidate.files)||candidate.files.length<10)
    throw Error("Release manifest is incomplete");
   manifest=candidate;break;
  }catch(error){lastError=error;if(attempt+1<retries)await wait(retryMs);}
 }
 if(!manifest)throw Error("Pages not serving intended revision: "+lastError?.message);
 let total=0;
 const paths=new Set();
 for(const file of manifest.files){
  if(typeof file.path!=="string"||
     !/^(?:(?:src|assets|icons)\/)?[a-zA-Z0-9_-]+\.(?:html|css|js|mjs|png|webmanifest)$/.test(file.path)||
     paths.has(file.path)||!/^[0-9a-f]{64}$/i.test(file.sha256)||
     !Number.isInteger(file.bytes)||file.bytes<=0)
    throw Error("Invalid public file declaration");
  paths.add(file.path);
  const response=await read(file.path);
  if(!response.ok)throw Error("Missing published asset "+file.path+": "+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==file.bytes||sha256(bytes)!==file.sha256)
   throw Error("Published asset differs from verified build: "+file.path);
  total+=bytes.length;
 }
 if(total!==manifest.totalBytes)throw Error("Published byte total does not match manifest");
 for(const excluded of ["README.md","OPERATIONAL_STATE.md"]){
  const response=await read(excluded);
  if(response.status!==404)throw Error("Unexpected non-release file on Pages: "+excluded);
 }
 return {sourceCommit:expectedCommit,verifiedFiles:paths.size,totalBytes:total,base:base.href};
}

const isEntry=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntry){
 verifyPublished({siteUrl:process.env.DEXTER_PAGES_URL,expectedCommit:process.env.GITHUB_SHA})
  .then(result=>console.log("Verified published Dexter release: "+JSON.stringify(result)))
  .catch(error=>{console.error("Pages verification FAILED: "+error.message);process.exitCode=1;});
}
