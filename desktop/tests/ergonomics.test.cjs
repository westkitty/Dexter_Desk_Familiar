'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ws = require('../window-state.cjs');
const {isNoseHit} = require('../hit-test.js');

test('ergonomics: headroom bleed permits Dexter visible art to touch screen top', () => {
  const windowSize = ws.petWindowSize(100); // 260 x 369
  const headroom = ws.headroomHeight(windowSize);
  assert.ok(headroom > 100, `Headroom height should be > 100px, got ${headroom}`);

  const workArea = {x: 0, y: 25, width: 1440, height: 875}; // typical macOS menu bar
  const candidateHigh = {x: 500, y: -300}; // Attempt to drag window far above screen

  // Standard clamp (without allowHeadroomBleed) stops at workArea.y
  const standard = ws.clampPosition(candidateHigh, workArea, windowSize, {allowHeadroomBleed: false});
  assert.equal(standard.y, 25);

  // Clamped with allowHeadroomBleed allows window to sit higher so visible art reaches workArea.y
  const bleed = ws.clampPosition(candidateHigh, workArea, windowSize, {allowHeadroomBleed: true});
  assert.ok(bleed.y < 25, `Expected bleed.y < 25, got ${bleed.y}`);
  assert.equal(bleed.y, workArea.y - headroom);

  // Visible art top boundary allows reaching menu bar
  const artBounds = ws.visibleArtBounds({...bleed, ...windowSize});
  assert.ok(artBounds.y <= workArea.y, `Visible art top (${artBounds.y}) should reach up to workArea.y (${workArea.y})`);
});

test('ergonomics: nose-only hit test distinguishes nose from body and ears across art modes', () => {
  const bounds = {left: 100, top: 100, width: 200, height: 200};

  // Pixel mode: nose center is around u=0.30, v=0.36
  const noseX = 100 + 200 * 0.30;
  const noseY = 100 + 200 * 0.36;
  assert.equal(isNoseHit('pixel', bounds, noseX, noseY), true, 'nose center should hit');

  // Forehead/ear: u=0.30, v=0.15
  assert.equal(isNoseHit('pixel', bounds, 100 + 200 * 0.30, 100 + 200 * 0.15), false, 'ear should not hit');

  // Paws/feet: u=0.30, v=0.85
  assert.equal(isNoseHit('pixel', bounds, 100 + 200 * 0.30, 100 + 200 * 0.85), false, 'feet should not hit');

  // Tail/back: u=0.75, v=0.50
  assert.equal(isNoseHit('pixel', bounds, 100 + 200 * 0.75, 100 + 200 * 0.50), false, 'back should not hit');
});

test('ergonomics: flipped art mirrors nose coordinate horizontally', () => {
  const bounds = {left: 0, top: 0, width: 100, height: 100};

  // Unflipped: u in [0.25, 0.36] => x in [25, 36]
  assert.equal(isNoseHit('pixel', bounds, 30, 36, {flipped: false}), true);
  assert.equal(isNoseHit('pixel', bounds, 70, 36, {flipped: false}), false);

  // Flipped: mirrored => 1 - u in [0.25, 0.36] => u in [0.64, 0.75] => x in [64, 75]
  assert.equal(isNoseHit('pixel', bounds, 30, 36, {flipped: true}), false);
  assert.equal(isNoseHit('pixel', bounds, 70, 36, {flipped: true}), true);
});

test('ergonomics: default window settings have pinned: true and roamingEnabled: false', () => {
  const defaults = ws.DEFAULTS;
  assert.equal(defaults.pinned, true);
  assert.equal(defaults.roamingEnabled, false);
});
