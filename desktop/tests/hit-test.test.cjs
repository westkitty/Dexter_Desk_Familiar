const test = require('node:test');
const assert = require('node:assert/strict');
const {MASK_SIZE, containedRect, within, alphaAt, isNoseHit, NOSE_REGIONS} = require('../hit-test.js');

function mask(width = 4, height = 4) {
  const data = new Uint8ClampedArray(width * height * 4);
  return {width, height, data};
}
const bounds = {left: 10, top: 20, width: 80, height: 80};
test('alpha hit returns false outside the native sprite', () => {
  assert.equal(within(bounds, 10, 20), true);
  assert.equal(within(bounds, 90, 40), false);
  assert.equal(alphaAt(mask(), bounds, 9, 35), false);
});
test('transparent corner passes through while opaque body receives clicks', () => {
  const m = mask();
  m.data[(2 * m.width + 2) * 4 + 3] = 255;
  assert.equal(alphaAt(m, bounds, 15, 25), false);
  assert.equal(alphaAt(m, bounds, 60, 70), true);
});
test('horizontal flip mirrors the actual alpha mask, not the bounding box', () => {
  const m = mask();
  m.data[(1 * m.width + 0) * 4 + 3] = 255;
  assert.equal(alphaAt(m, bounds, 15, 50), true);
  assert.equal(alphaAt(m, bounds, 15, 50, {flipped:true}), false);
  assert.equal(alphaAt(m, bounds, 85, 50, {flipped:true}), true);
});
test('contain-fit preserves transparent bars on non-square video', () => {
  assert.deepEqual(containedRect(1920,1080,64,64), {x:0,y:14,width:64,height:36});
  assert.deepEqual(containedRect(100,100,64,64), {x:0,y:0,width:64,height:64});
  assert.equal(containedRect(0,100),null);
  assert.equal(MASK_SIZE,64);
});
test('invalid alpha reads fall back without claiming a pixel hit', () => {
  assert.equal(alphaAt(null,bounds,50,50),null);
  assert.equal(alphaAt({width:4,height:4,data:[]},bounds,50,50),null);
  const m=mask();m.data[(1*4+1)*4+3]=15;
  assert.equal(alphaAt(m,bounds,34,45),false);
  assert.equal(alphaAt(m,bounds,34,45,{threshold:10}),true);
});

test('isNoseHit accurately identifies nose region across art modes and flipped states', () => {
  const b = {left: 0, top: 0, width: 100, height: 100};

  // Pixel mode: u in [0.25, 0.36], v in [0.31, 0.41]
  assert.equal(isNoseHit('pixel', b, 30, 35), true, 'pixel nose center');
  assert.equal(isNoseHit('pixel', b, 70, 70), false, 'pixel body/paws');
  assert.equal(isNoseHit('pixel', b, 10, 10), false, 'pixel outside');

  // Pixel flipped: mirrored horizontally (1 - u in [0.25, 0.36] => u in [0.64, 0.75])
  assert.equal(isNoseHit('pixel', b, 30, 35, {flipped: true}), false, 'unflipped coord when flipped');
  assert.equal(isNoseHit('pixel', b, 70, 35, {flipped: true}), true, 'mirrored nose coord when flipped');

  // Cel mode: u in [0.31, 0.41], v in [0.31, 0.41]
  assert.equal(isNoseHit('cel', b, 36, 36), true, 'cel nose');
  assert.equal(isNoseHit('cel', b, 20, 36), false, 'cel outside nose');

  // Atlas mode: u in [0.27, 0.39], v in [0.31, 0.43]
  assert.equal(isNoseHit('atlas', b, 33, 37), true, 'atlas nose');
  assert.equal(isNoseHit('atlas', b, 60, 37), false, 'atlas body');
});

