import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const pngSignature=Buffer.from("89504e470d0a1a0a","hex");
const assets=[
  ["assets/dexter-rest-96.png",96,true],
  ["assets/dexter-sit-96.png",96,true],
  ["assets/dexter-stand-96.png",96,true],
  ["icons/icon-192.png",192,false],
  ["icons/icon-512.png",512,false]
];
function crc32(bytes,start,end){
  let crc=0xffffffff;
  for(let i=start;i<end;i++){
    crc^=bytes[i];
    for(let bit=0;bit<8;bit++) crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);
  }
  return (crc^0xffffffff)>>>0;
}
function inspectPng(bytes,path){
  assert.ok(bytes.subarray(0,8).equals(pngSignature),path+": invalid PNG signature");
  let offset=8,hasHeader=false,hasEnd=false,hasTransparency=false,width=0,height=0;
  while(offset<bytes.length){
    assert.ok(offset+12<=bytes.length,path+": truncated PNG chunk header");
    const length=bytes.readUInt32BE(offset);
    const type=bytes.toString("ascii",offset+4,offset+8);
    const end=offset+12+length;
    assert.ok(end<=bytes.length,path+": truncated PNG "+type+" chunk");
    const actual=crc32(bytes,offset+4,end-4);
    const expected=bytes.readUInt32BE(end-4);
    assert.equal(actual,expected,path+": corrupt PNG "+type+" CRC");
    if(type==="IHDR"){
      assert.equal(hasHeader,false,path+": duplicate IHDR");
      hasHeader=true;
      width=bytes.readUInt32BE(offset+8);
      height=bytes.readUInt32BE(offset+12);
    }
    if(type==="tRNS") hasTransparency=true;
    if(type==="IEND"){
      assert.equal(length,0,path+": invalid IEND length");
      hasEnd=true;
      assert.equal(end,bytes.length,path+": data after IEND");
      break;
    }
    offset=end;
  }
  assert.ok(hasHeader,path+": missing IHDR");
  assert.ok(hasEnd,path+": missing IEND");
  return {width,height,hasTransparency};
}

for(const [path,expectedSize,needsTransparency] of assets){
  test(path+" has valid PNG chunks and full terminator",async()=>{
    const bytes=await readFile(join(root,path));
    const png=inspectPng(bytes,path);
    assert.equal(png.width,expectedSize,path+": width");
    assert.equal(png.height,expectedSize,path+": height");
    if(needsTransparency) assert.equal(png.hasTransparency,true,path+": sprite must support transparency");
  });
}
