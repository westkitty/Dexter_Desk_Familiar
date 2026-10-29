import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const EXPECTED="ee2e34f8c773e03846ce2800280328f3464a9603";
test("candidate sprite sheet preserves exact SNES_Dex Git blob bytes",async()=>{
 const bytes=await readFile(new URL("../assets/dexter-snes-32-candidate.png",import.meta.url));
 const sha=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 assert.equal(sha,EXPECTED);
});
