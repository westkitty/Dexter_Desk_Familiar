const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const ws = require('../window-state.cjs');
const modes = require('../core/modes.cjs');
const states = require('../core/states.cjs');
const {route} = require('../core/router.cjs');
const checkins = require('../core/checkins.cjs');
const session = require('../core/session.cjs');
const {createJournal} = require('../core/journal.cjs');
const {createNotes} = require('../core/memory.cjs');
const {buildPacket, packetMarkdown} = require('../core/packet.cjs');
const {createPlayer, DEMO} = require('../core/scripts.cjs');
const {createWhisper, checkWhisper, isWav} = require('../core/stt-whisper.cjs');
const {createTtsCache, listVoices} = require('../core/tts-cache.cjs');
const wav = require('../audio-wav.js');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-p2-'));

test('new settings default off/neutral and reject arbitrary values', () => {
  const s = ws.sanitizeSettings(null);
  for (const k of ['keepJournal', 'developerTools', 'sttEnabled', 'notesInContext', 'allSpaces', 'nativeNotifications', 'ttsCache', 'showLastReplyOnStart'])
    assert.equal(s[k], false, k);
  assert.equal(s.globalHotkey, ''); assert.equal(s.mode, 'plain'); assert.deepEqual(s.customCheckins, []);
  const bad = ws.sanitizeSettings({globalHotkey: 'Command+Q', mode: 'god', animationSpeed: 9, whisperPath: 'whisper', chatBounds: {x: 1, y: 2, width: 10, height: 10}});
  assert.equal(bad.globalHotkey, ''); assert.equal(bad.mode, 'plain'); assert.equal(bad.animationSpeed, 1);
  assert.equal(bad.whisperPath, ''); assert.equal(bad.chatBounds, null);
  // Panel geometry cannot be injected from the settings UI.
  const merged = ws.mergeSettings(s, {chatBounds: {x: 5, y: 5, width: 400, height: 400}});
  assert.equal(merged.chatBounds, null);
});
test('custom check-ins are validated, bounded and keep follow-ups', () => {
  const list = ws.sanitizeCustomCheckins([
    {text: 'Q?', choices: [{label: 'A', reply: 'ra'}, {label: 'B', reply: 'rb', state: 'nonsense', followUp: {text: 'F?', choices: [{label: 'x', reply: 'y'}, {label: 'z', reply: 'w'}]}}]},
    {text: 'One choice only', choices: [{label: 'A', reply: 'r'}]},
    {text: '', choices: []}, 'junk'
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].choices[1].state, 'watching');
  assert.equal(list[0].choices[1].followUp.choices.length, 2);
  assert.equal(ws.sanitizeCustomCheckins(Array.from({length: 40}, () => ({text: 'q', choices: [{label: 'a', reply: 'b'}, {label: 'c', reply: 'd'}]}))).length, 30);
});
test('modes overlay settings without rewriting them', () => {
  const base = ws.sanitizeSettings({checkinsEnabled: true, quiet: false});
  const work = modes.effectiveSettings({...base, mode: 'work'});
  assert.equal(work.checkinsEnabled, false); assert.equal(work.intensity, 'reserved');
  assert.equal(modes.effectiveSettings({...base, mode: 'plain'}).checkinsEnabled, true);
  assert.equal(modes.effectiveSettings({...base, mode: 'quiet'}).quiet, true);
  assert.equal(base.checkinsEnabled, true, 'stored settings untouched');
  for (const id of ws.MODES) assert.ok(modes.MODES[id], id);
});
test('semantic state machine enforces transitions and auto-returns', () => {
  const timers = [];
  const changes = [];
  const m = states.createSemanticMachine({onChange: c => changes.push(c), setTimer: (fn, ms) => { timers.push({fn, ms}); return timers.length; }, clearTimer: () => {}});
  assert.equal(m.enter('thinking', 'ai').ok, true);
  assert.equal(changes.at(-1).visual, 'judging');
  assert.equal(m.enter('alert', 'x').ok, false, 'thinking cannot jump to alert');
  timers.at(-1).fn();
  assert.equal(m.current, 'idle');
  assert.equal(states.canTransition('annoyed', 'thinking'), false);
  for (const [id, def] of Object.entries(states.SEMANTIC)) for (const t of def.to) assert.ok(states.SEMANTIC[t], id + '→' + t);
});
test('router prefers commands and intents, then local AI, never a cloud path', () => {
  assert.deepEqual(route('/session start 25'), {path: 'command', command: '/session', args: 'start 25', reason: 'slash command'});
  assert.equal(route('what mode are we in').command, '/mode');
  assert.deepEqual([route('please switch to work mode').command, route('please switch to work mode').args], ['/mode', 'work']);
  assert.equal(route('start a focus session').command, '/session');
  assert.equal(route('how much time is left?').command, '/time');
  assert.equal(route('explain monads', {aiEnabled: true}).path, 'local_ai');
  assert.equal(route('explain monads').path, 'local_reply');
  assert.equal(route('x'.repeat(200) + ' status', {aiEnabled: true}).path, 'local_ai', 'long text goes to the model');
});
test('check-in picker cycles without repeats, follows up and parses quick-add', () => {
  const settings = {checkinSource: 'builtin', customCheckins: []};
  const picker = checkins.createPicker({random: () => 0});
  const seen = new Set();
  const n = checkins.pool(settings).length;
  for (let i = 0; i < n; i++) seen.add(picker.next(settings).id);
  assert.equal(seen.size, n);
  const status = checkins.pool(settings).find(c => c.id === 'status');
  assert.ok(checkins.publicView(status, [1]).text.includes('Poorly'));
  assert.equal(checkins.resolve(status, [1, 0]).label, 'Stuck');
  assert.equal(checkins.resolve(status, [9]), null);
  assert.equal(checkins.publicView(status, [0]), null, 'no follow-up for this choice');
  const custom = [{id: 'c-1', text: 'Mine?', choices: [{label: 'a', reply: 'b', state: 'idle'}, {label: 'c', reply: 'd', state: 'idle'}]}];
  assert.deepEqual(checkins.pool({checkinSource: 'custom', customCheckins: custom}).map(c => c.id), ['c-1']);
  assert.equal(checkins.parseQuickAsk('Coffee? | Yes | No').choices.length, 2);
  assert.equal(checkins.parseQuickAsk('only question'), null);
});
test('sessions pause time correctly and report milestones', () => {
  let now = 0;
  const s = session.createSession({clock: () => now});
  assert.equal(s.start(10).ok, true);
  now = 4 * 60000; s.pause(); now = 9 * 60000; s.resume();
  assert.equal(s.snapshot().elapsedMs, 4 * 60000);
  now = 9.5 * 60000; assert.equal(s.milestone(null), null, '4.5 of 10 minutes elapsed');
  now = 11 * 60000; assert.equal(s.milestone(null), 'half');
  now = 20 * 60000; assert.equal(s.milestone('half'), 'end');
  assert.equal(s.stop().summary.done, true);
  assert.equal(s.snapshot().active, false);
  assert.equal(session.formatRemaining(95 * 60000), '1 h 35 min');
  assert.equal(s.start(0).ok, false);
});
test('journal is opt-in, bounded, private and clearable', () => {
  const dir = tmp(), file = path.join(dir, 'journal.jsonl');
  let on = false;
  const j = createJournal({file, enabled: () => on});
  assert.equal(j.append('checkin', {id: 'x'}), false);
  assert.equal(fs.existsSync(file), false);
  on = true;
  j.append('checkin', {id: 'status', answer: 'Adequately', nested: {a: 1}});
  assert.equal(j.read()[0].answer, 'Adequately'); assert.equal('nested' in j.read()[0], false);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(j.append('keystrokes', {}), false);
  j.clear(); assert.equal(fs.existsSync(file), false);
});
test('notes cross the firewall only when allowed, and crossings are counted', () => {
  const dir = tmp(), file = path.join(dir, 'notes.json');
  const n = createNotes({file});
  assert.equal(n.cross(true, 'chat'), null, 'nothing to cross');
  n.add('I prefer Dexter on the left.'); n.add('  ');
  assert.equal(n.size, 1);
  assert.equal(n.cross(false, 'chat'), null);
  assert.equal(n.crossings, 0);
  assert.match(n.cross(true, 'chat').text, /prefer Dexter/);
  assert.equal(n.crossings, 1);
  assert.equal(createNotes({file}).load(), 1);
  n.clear(); assert.equal(fs.existsSync(file), false);
});
test('context packet uses real data and includes notes only via the firewall', () => {
  const p = buildPacket({mode: 'work', semanticState: 'idle', visualState: 'idle', session: {active: true, minutes: 50, paused: false, remainingMs: 600000},
    messages: [{role: 'dexter', content: 'bubble'}, {role: 'user', content: 'hi'}, {role: 'assistant', content: 'Hm.'}], includeMessages: 6});
  assert.equal(p.notes, null); assert.equal(p.recentConversation.length, 2); assert.equal(p.session.remainingMinutes, 10);
  assert.match(packetMarkdown(p), /\*\*You:\*\* hi/);
  assert.equal(buildPacket({notesBlock: {text: 'N'}}).provenance.notes, 'user-authored, crossed firewall');
});
test('demo player plays every step and stops cleanly', () => {
  const timers = [], steps = [];
  const p = createPlayer({onStep: s => steps.push(s), setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {}});
  p.play();
  while (p.playing && timers.length) timers.shift()();
  assert.equal(steps.length, DEMO.length);
  assert.equal(p.playing, false);
  for (const s of DEMO) assert.doesNotMatch(s.say, /!/);
});
test('WAV encoder produces valid 16 kHz mono PCM that the STT adapter accepts', () => {
  const samples = new Float32Array(48000).map((_, i) => Math.sin(i / 10));
  const down = wav.downsample(samples, 48000);
  assert.equal(down.length, 16000);
  const bytes = wav.encodeWav(down);
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), 'RIFF');
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 16000);
  assert.equal(isWav(bytes), true);
  assert.equal(isWav(Buffer.from('nope')), false);
});
test('whisper adapter needs user-installed files, uses no shell and deletes audio', async () => {
  assert.equal(checkWhisper({whisperPath: '', whisperModel: ''}).ok, false);
  const dir = tmp(), bin = path.join(dir, 'whisper-cli'), model = path.join(dir, 'ggml-base.bin');
  fs.writeFileSync(bin, '#!/bin/sh\n', {mode: 0o755}); fs.writeFileSync(model, 'x');
  let seen;
  const fake = (cmd, args, opts) => {
    seen = {cmd, args, opts};
    const proc = new EventEmitter(); proc.stderr = new EventEmitter();
    proc.kill = () => setImmediate(() => proc.emit('close', null, 'SIGKILL'));
    setImmediate(() => { fs.writeFileSync(args[args.indexOf('-of') + 1] + '.txt', '  Hello   Dexter \n'); proc.emit('close', 0, null); });
    return proc;
  };
  const w = createWhisper({spawnImpl: fake, tmpRoot: dir});
  const text = await w.transcribe(wav.encodeWav(new Float32Array(1600)), {whisperPath: bin, whisperModel: model});
  assert.equal(text, 'Hello Dexter');
  assert.equal(seen.opts.shell, false); assert.equal(seen.cmd, bin);
  assert.deepEqual(fs.readdirSync(dir).filter(n => n.startsWith('dexter-stt-')), []);
  await assert.rejects(w.transcribe(Buffer.from('junk'), {whisperPath: bin, whisperModel: model}), /not valid audio/);
});
test('TTS cache is bounded with LRU eviction and lists only .onnx voices', () => {
  const dir = tmp();
  const c = createTtsCache({dir: path.join(dir, 'cache'), maxFiles: 2});
  c.put('a', 'v', 1, Buffer.alloc(10)); c.put('b', 'v', 1, Buffer.alloc(10));
  c.get('a', 'v', 1);
  c.put('c', 'v', 1, Buffer.alloc(10));
  assert.equal(c.stats().files, 2);
  assert.ok(c.get('c', 'v', 1));
  c.clear(); assert.equal(c.stats().files, 0);
  fs.writeFileSync(path.join(dir, 'en_US-lessac.onnx'), 'x'); fs.writeFileSync(path.join(dir, 'readme.txt'), 'x');
  assert.deepEqual(listVoices(dir).map(v => v.name), ['en US lessac']);
  assert.deepEqual(listVoices('relative'), []);
});
