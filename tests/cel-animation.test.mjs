import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {CEL_CLIPS,CEL_POSTERS,celPoseForState,chooseCelClip,createCelAnimator} from "../src/cel-animation.mjs";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
const approved={
 head_tilt:"2eb01b2e94394022fac5c18b082610fcc816662335a3b6a5072999ddd0bd7b2a",
 lie_down:"f05621ad6b7f23758e8e6a01d7ab72d1006615117def2ff2452fec48428fe70e",
 sit_down:"f7ddabda637695c54d289b3f3de68320f25c465d88ecbcca21cd9e4e2d4ffb61",
 sleep_loop:"5d843489c55cd40c574f79f9b224fbaed94dd38e716cad1fb008fffe23c522f9",
 slow_blink:"ecddfbe2179b710358ebe51e5c6b27ffe822f7ff41f93ac2c03cad963306dab2",
 stretch:"4954a24b06f49188fcdd303fef670769f5c256001ac042d5ed9e84462235a174",
 tail_wag:"0dcac2bdf2c4448eafc8ee3d4b372d619293f540f5e4c10d7aa9a850e27c2215",
 treat_lick:"864dab709a492118c9be45beca38526e4829a3ddc562a61dc5fbfd41fa43a03e"
};
class FakeElement{
 constructor(){this.hidden=true;this.attributes=new Map();}
 setAttribute(k,v){this.attributes.set(k,v);}
 getAttribute(k){return this.attributes.get(k)??null;}
 hasAttribute(k){return this.attributes.has(k);}
 removeAttribute(k){this.attributes.delete(k);}
}
function harness({alpha=0,support="probably"}={}){
 const video=new FakeElement(),poster=new FakeElement(),pixel=new FakeElement(),status={textContent:""};
 pixel.hidden=false;video.pause=()=>{video.pauseCount=(video.pauseCount||0)+1;};
 video.load=()=>{video.loadCount=(video.loadCount||0)+1;};
 video.canPlayType=()=>support;
 video.play=()=>{video.playCount=(video.playCount||0)+1;return Promise.resolve();};
 Object.defineProperty(video,"src",{set(v){video.setAttribute("src",v);},get(){return video.getAttribute("src");}});
 video.videoWidth=384;video.videoHeight=384;
 const documentRef={createElement(){return {width:24,height:24,getContext(){return {clearRect(){},drawImage(){},getImageData(){return {data:[0,0,0,alpha]};}};}};}};
 return {video,poster,pixel,status,player:createCelAnimator({video,poster,pixel,status,documentRef})};
}
test("eight owner-approved clips are present byte-for-byte and match manifest hashes",async()=>{
 assert.deepEqual(Object.keys(CEL_CLIPS).sort(),Object.keys(approved).sort());
 assert.equal(Object.keys(CEL_POSTERS).length,4);
 for(const [name,digest] of Object.entries(approved)){
  const bytes=await readFile(new URL("../assets/cel-shaded/clips/"+name+".webm",import.meta.url));
  assert.equal(sha(bytes),digest,name);
  assert.equal(bytes.subarray(0,4).toString("hex"),"1a45dfa3");
 }
});
test("semantic clips remain explicit and treat reactions alternate",()=>{
 assert.equal(celPoseForState("working"),"standing");
 assert.equal(celPoseForState("resting"),"resting");
 assert.equal(celPoseForState("judging"),"seated");
 assert.equal(chooseCelClip("idle","sleeping"),"lie_down");
 assert.equal(chooseCelClip("resting","sleeping"),"sleep_loop");
 assert.equal(chooseCelClip("working","idle"),"sit_down");
 assert.equal(chooseCelClip("idle","watching"),"head_tilt");
 assert.equal(chooseCelClip("idle","eating",{treatOrdinal:0}),"treat_lick");
 assert.equal(chooseCelClip("eating","eating",{treatOrdinal:1}),"tail_wag");
 assert.equal(chooseCelClip("idle","huffing"),null);
});
test("activation is session-only, shows proven-alpha video, then restores still/pixel safely",()=>{
 const {player,video,poster,pixel}=harness();
 assert.equal(player.enabled,false);assert.equal(pixel.hidden,false);
 player.enable();
 assert.equal(player.enabled,true);assert.equal(pixel.hidden,true);
 player.setState("watching",{previous:"idle"});
 assert.equal(player.currentClip,"head_tilt");
 assert.match(video.src,/head_tilt\.webm$/);
 assert.equal(poster.hidden,false);
 video.onloadeddata();
 assert.equal(video.hidden,false);assert.equal(poster.hidden,true);
 video.onended();
 assert.equal(video.hidden,true);assert.equal(poster.hidden,false);
 player.disable();assert.equal(pixel.hidden,false);assert.equal(poster.hidden,true);
 assert.equal(player.enabled,false);
});
test("sleep begins with lie-down then loops and survives visibility pause/resume",()=>{
 const {player,video,poster}=harness();
 player.enable();player.setState("sleeping",{previous:"watching",explicit:true});
 assert.equal(player.currentClip,"lie_down");
 const first=video.onended;first();
 assert.equal(player.currentClip,"sleep_loop");assert.equal(video.loop,true);
 video.onloadeddata();player.setVisible(false);
 assert.equal(video.hidden,true);assert.equal(poster.hidden,false);
 player.setVisible(true);assert.equal(video.hidden,false);assert.equal(poster.hidden,true);
});
test("quiet/reduced-motion never autoplay, explicit inspect bypasses only quiet",()=>{
 const {player,video,poster,pixel}=harness();
 player.setQuiet(true);player.enable();player.setState("watching",{previous:"idle"});
 assert.equal(video.hidden,true);assert.equal(poster.hidden,false);
 player.setClip("head_tilt");assert.equal(player.currentClip,"head_tilt");
 player.setReducedMotion(true);assert.equal(player.currentClip,null);
 player.setClip("sleep_loop");assert.equal(video.hidden,true);assert.equal(pixel.hidden,true);
});
test("missing alpha/codec falls back to stills instead of showing opaque black video",()=>{
 for(const o of [{alpha:255},{support:""}]){
  const {player,video,poster,status}=harness(o);
  player.enable();player.setState("judging",{previous:"idle",explicit:true});
  if(o.support==="")assert.equal(video.hidden,true);
  else video.onloadeddata();
  assert.equal(video.hidden,true);assert.equal(poster.hidden,false);
  assert.match(status.textContent,/still|unavailable|unsupported/i);
 }
});
