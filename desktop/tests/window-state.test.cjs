const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {sanitizeSettings,dimensions,clampPosition,shouldIgnoreMouse,isWithinRoot}=require('../window-state.cjs');
test('disallows arbitrary persisted configuration',()=>{
 const s=sanitizeSettings({size:'giant',opacity:0.1,alwaysOnTop:'yes',x:Infinity,art:'external'});
 assert.equal(s.size,'medium');assert.equal(s.opacity,1);assert.equal(s.alwaysOnTop,true);
 assert.equal(s.x,null);assert.equal(s.art,'pixel');
});
test('expected panel sizes',()=>{assert.deepEqual(dimensions('small'),{width:200,height:232});assert.deepEqual(dimensions('large'),{width:330,height:383});});
test('window stays inside display work area',()=>{
 assert.deepEqual(clampPosition({x:99999,y:-100},{x:-900,y:30,width:900,height:700},{width:260,height:302}),{x:-260,y:30});
});
test('interactive pet and transparent-region pass through are distinct',()=>{
 assert.equal(shouldIgnoreMouse({preciseHitTest:true,overPet:false}),true);
 assert.equal(shouldIgnoreMouse({preciseHitTest:true,overPet:true}),false);
 assert.equal(shouldIgnoreMouse({passThrough:true,overPet:true}),true);
 assert.equal(shouldIgnoreMouse({preciseHitTest:false,overPet:false}),false);
});
test('file access stays inside the bundled web root',()=>{
 const root=path.resolve('/tmp/dexter/web');
 assert.equal(isWithinRoot(root,path.join(root,'index.html')),true);
 assert.equal(isWithinRoot(root,path.resolve(root,'../other')),false);
});
