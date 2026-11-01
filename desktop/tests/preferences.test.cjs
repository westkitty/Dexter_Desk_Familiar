const test = require('node:test');
const assert = require('node:assert/strict');
const ws = require('../window-state.cjs');

test('new preferences default to private, quiet, offline and recoverable', () => {
  const s = ws.sanitizeSettings(null);
  assert.equal(s.aiEnabled, false);
  assert.equal(s.ttsEnabled, false);
  assert.equal(s.checkinsEnabled, false);
  assert.equal(s.rememberConversation, false);
  assert.equal(s.launchAtLogin, false);
  assert.equal(s.aiEndpoint, 'http://127.0.0.1:11434');
  assert.equal(s.opacity, 1);
  assert.equal(s.scale, 100);
});
test('legacy size migrates to scale and out-of-range values fall back', () => {
  assert.equal(ws.sanitizeSettings({size: 'large'}).scale, 130);
  assert.equal(ws.sanitizeSettings({size: 'small', scale: 150}).scale, 150);
  assert.equal(ws.sanitizeSettings({scale: 999}).scale, 100);
  assert.equal(ws.sanitizeSettings({opacity: 0.39}).opacity, 1, 'never nearly invisible');
  assert.equal(ws.sanitizeSettings({opacity: 0.43}).opacity, 0.45);
  assert.equal(ws.sanitizeSettings({ttsVolume: -1}).ttsVolume, 0.8);
});
test('endpoint policy rejects credentials, paths, schemes and silent remote hosts', () => {
  assert.equal(ws.validateEndpoint('http://127.0.0.1:11434').ok, true);
  assert.equal(ws.validateEndpoint('http://localhost:11434/').ok, true);
  assert.equal(ws.validateEndpoint('http://[::1]:11434').ok, true);
  assert.equal(ws.validateEndpoint('http://user:pw@127.0.0.1:11434').ok, false);
  assert.equal(ws.validateEndpoint('http://127.0.0.1:11434/api').ok, false);
  assert.equal(ws.validateEndpoint('file:///etc/passwd').ok, false);
  assert.equal(ws.validateEndpoint('http://127.0.0.1:11434?x=1').ok, false);
  assert.equal(ws.validateEndpoint('http://192.168.1.20:11434').ok, false);
  assert.equal(ws.validateEndpoint('http://192.168.1.20:11434', {allowRemote: true}).ok, true);
  // Stored remote endpoint without the remote opt-in reverts to loopback.
  assert.equal(ws.sanitizeSettings({aiEndpoint: 'http://10.0.0.5:11434'}).aiEndpoint, 'http://127.0.0.1:11434');
  assert.equal(ws.sanitizeSettings({aiEndpoint: 'http://10.0.0.5:11434', aiAllowRemote: true}).aiEndpoint, 'http://10.0.0.5:11434');
});
test('merge accepts only known keys and re-sanitizes', () => {
  const base = ws.sanitizeSettings(null);
  const next = ws.mergeSettings(base, {quiet: true, evil: 'x', __proto__: {aiEnabled: true}, piperPath: 'relative/piper', intensity: 'maximum'});
  assert.equal(next.quiet, true);
  assert.equal('evil' in next, false);
  assert.equal(next.aiEnabled, false);
  assert.equal(next.piperPath, '');
  assert.equal(next.intensity, 'standard');
  assert.deepEqual(ws.mergeSettings(base, null), base);
});
test('pet window scales with bubble headroom', () => {
  assert.deepEqual(ws.petWindowSize(100), {width: 260, height: 369});
  assert.deepEqual(ws.petWindowSize(60), {width: 156, height: 222});
  assert.deepEqual(ws.petWindowSize(5000), ws.petWindowSize(100));
});
test('resizing keeps Dexter anchored at his feet', () => {
  assert.deepEqual(ws.resizeAnchored({x: 100, y: 100, width: 260, height: 369}, {width: 520, height: 738}),
    {x: -30, y: -269, width: 520, height: 738});
});
test('display removal recovers the window onto the nearest remaining work area', () => {
  const primary = {x: 0, y: 25, width: 1440, height: 875};
  const recovered = ws.recoverBounds({x: 2500, y: 300, width: 260, height: 369}, [primary]);
  assert.deepEqual(recovered, {x: 1180, y: 300, width: 260, height: 369});
  const shrunk = ws.recoverBounds({x: 1200, y: 700, width: 260, height: 369}, [{x: 0, y: 0, width: 1280, height: 800}]);
  assert.deepEqual(shrunk, {x: 1020, y: 431, width: 260, height: 369});
  const leftScreen = {x: -1920, y: 0, width: 1920, height: 1080};
  assert.equal(ws.recoverBounds({x: -600, y: 100, width: 260, height: 369}, [primary, leftScreen]).x, -600);
  assert.deepEqual(ws.recoverBounds({x: 1, y: 2, width: 3, height: 4}, []), {x: 1, y: 2, width: 3, height: 4});
});
test('companion panel sits beside Dexter and stays on screen', () => {
  const area = {x: 0, y: 0, width: 1440, height: 900};
  const panel = {width: 340, height: 440};
  assert.equal(ws.panelBeside({x: 1100, y: 500, width: 260, height: 369}, panel, area).x, 752);
  assert.equal(ws.panelBeside({x: 10, y: 500, width: 260, height: 369}, panel, area).x, 278);
  const p = ws.panelBeside({x: 10, y: 10, width: 260, height: 369}, panel, area);
  assert.ok(p.y >= 0 && p.y + p.height <= 900);
});
