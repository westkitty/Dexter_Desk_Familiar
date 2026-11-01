const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {EventEmitter} = require('node:events');
const persona = require('../core/persona.cjs');
const attention = require('../core/attention.cjs');
const {createConversation} = require('../core/conversation.cjs');
const {createEventLog} = require('../core/events.cjs');
const diagnostics = require('../core/diagnostics.cjs');
const {createSpeechQueue, clean} = require('../speech-queue.js');
const {createPiper, checkPiper} = require('../core/tts-piper.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-test-'));

test('persona stays restrained: no exclamation marks or emoji in any authored line', () => {
  const lines = [persona.SYSTEM_PROMPT];
  for (const c of persona.CHECKINS) { lines.push(c.text); for (const ch of c.choices) lines.push(ch.label, ch.reply); }
  for (const e of Object.values(persona.EVENTS)) lines.push(...e.lines);
  for (const text of ['hello', 'thanks', 'sorry', 'treat', 'why?', 'blah']) for (const r of [0, 0.5, 0.99]) lines.push(persona.localReply(text, () => r));
  for (const line of lines) {
    assert.doesNotMatch(line, /!/, line);
    assert.doesNotMatch(line, /\p{Extended_Pictographic}/u, line);
  }
  assert.match(persona.SYSTEM_PROMPT, /cannot see their screen/);
});
test('commands are parsed locally and unknown commands are flagged', () => {
  assert.deepEqual(persona.parseCommand(' /TREAT now'), {name: '/treat'});
  assert.equal(persona.parseCommand('/rm -rf').unknown, true);
  assert.equal(persona.parseCommand('hello'), null);
  assert.match(persona.helpText(), /\/status/);
});
test('check-ins never repeat back-to-back and choices are validated', () => {
  for (const c of persona.CHECKINS) assert.notEqual(persona.chooseCheckin(c.id, () => 0).id, c.id);
  assert.equal(persona.checkinChoice('status', 9), null);
  assert.equal(persona.checkinChoice('nope', 0), null);
  assert.equal(persona.checkinChoice('status', 0).state, 'judging');
  assert.equal('reply' in persona.publicCheckin(persona.CHECKINS[0]).choices, false);
});
test('attention arbiter: replies bypass budget, check-ins obey quiet, nap, hours and budget', () => {
  const settings = {checkinsEnabled: true, checkinQuietHours: true, eventReactions: true, intensity: 'reserved'};
  const noon = new Date(2026, 10, 1, 12).getTime();
  const late = new Date(2026, 10, 1, 23).getTime();
  const budget = attention.createBudget();
  assert.equal(attention.evaluateProactive({kind: 'checkin', now: noon, settings, state: {}, budget}).allow, true);
  budget.record(noon);
  const second = attention.evaluateProactive({kind: 'checkin', now: noon + 60000, settings, state: {}, budget});
  assert.equal(second.allow, false); assert.match(second.reason, /budget/);
  assert.equal(attention.evaluateProactive({kind: 'checkin', now: late, settings, state: {}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'checkin', now: noon, settings: {...settings, quiet: true}, state: {}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'checkin', now: noon, settings, state: {napping: true}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'checkin', now: noon, settings: {...settings, checkinsEnabled: false}, state: {}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'reply', now: noon, settings: {quiet: true}, state: {}, budget}).allow, true);
  assert.equal(attention.evaluateProactive({kind: 'reply', settings: {}, state: {chatOpen: true}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'event', settings: {eventReactions: false}, state: {}}).allow, false);
  assert.equal(attention.evaluateProactive({kind: 'event', settings: {eventReactions: true}, state: {passThrough: true}}).allow, false);
});
test('check-in scheduling uses one bounded delay, never polling', () => {
  assert.equal(attention.nextCheckinDelay({settings: {checkinsEnabled: false}}), null);
  const d = attention.nextCheckinDelay({settings: {checkinsEnabled: true, checkinMinutes: 60}, now: 0, lastAt: 0, random: () => 0.5});
  assert.equal(d, 3600000);
  assert.ok(attention.nextCheckinDelay({settings: {checkinsEnabled: true, checkinMinutes: 30}, now: 10 ** 9, lastAt: 0, random: () => 0}) >= 60000);
  assert.ok(attention.profileFor('attentive').hourlyCap > attention.profileFor('reserved').hourlyCap);
  assert.equal(attention.profileFor('bogus'), attention.PROFILES.standard);
});
test('conversation stays in memory unless remembering is enabled; clear deletes the file', () => {
  const dir = tmp(), file = path.join(dir, 'conversation.json');
  const c = createConversation({file, persist: false});
  c.add('user', 'secret'); c.save();
  assert.equal(fs.existsSync(file), false);
  c.setPersist(true);
  assert.equal(fs.existsSync(file), true);
  assert.equal((fs.statSync(file).mode & 0o777), 0o600);
  const again = createConversation({file, persist: true});
  assert.equal(again.load(), 1);
  c.setPersist(false);
  assert.equal(fs.existsSync(file), false, 'turning remembering off deletes the stored history');
  c.setPersist(true); c.clear();
  assert.equal(fs.existsSync(file), false); assert.equal(c.size, 0);
});
test('conversation is bounded, rejects bad roles and builds model context from completed turns', () => {
  const c = createConversation();
  for (let i = 0; i < 130; i++) c.add(i % 2 ? 'assistant' : 'user', 'm' + i);
  assert.equal(c.size, 100);
  assert.throws(() => c.add('system', 'x'));
  const s = c.add('assistant', '', 'streaming');
  c.add('dexter', 'bubble line');
  assert.ok(!c.context().some(m => m.content === 'bubble line'));
  assert.ok(!c.context().some(m => m === s));
  c.update(s.id, {content: 'done', status: 'complete'});
  assert.equal(c.context().at(-1).content, 'done');
  const dir = tmp(), file = path.join(dir, 'c.json');
  fs.writeFileSync(file, JSON.stringify({messages: [{role: 'root', content: 'x'}, {role: 'user', content: 'ok', id: '../../etc'}]}));
  const loaded = createConversation({file, persist: true});
  assert.equal(loaded.load(), 1);
  assert.notEqual(loaded.list()[0].id, '../../etc');
});
test('event log is bounded and strips non-primitive or oversized detail', () => {
  const log = createEventLog({limit: 5, clock: () => 1});
  for (let i = 0; i < 9; i++) log.record('interaction', 'poke', {n: i, text: {nested: true}, long: 'x'.repeat(500), 'bad key': 1});
  assert.equal(log.size, 5);
  const last = log.recent(1)[0];
  assert.deepEqual(Object.keys(last.detail).sort(), ['long', 'n']);
  assert.equal(last.detail.long.length, 80);
  assert.equal(log.count('interaction', 'poke'), 9);
  assert.equal(log.record('keylogger', 'x'), null);
  const off = log.on(() => {}); assert.equal(log.listenerCount, 1); off(); assert.equal(log.listenerCount, 0);
});
test('self-audit fails on unsafe renderers, unexpected egress and hidden history', () => {
  const good = {windows: [{name: 'pet', sandbox: true, contextIsolation: true, nodeIntegration: false}], cspConnectNone: true,
    settings: {aiEnabled: false, opacity: 1, rememberConversation: false}, egressCount: 0, trayAlive: true, petOnScreen: true, historyFileExists: false};
  assert.equal(diagnostics.runSelfAudit(good).result, 'pass');
  const bad = {...good, windows: [{name: 'pet', sandbox: false, contextIsolation: true}], egressCount: 2, egressWhileDisabled: 1, historyFileExists: true};
  assert.equal(diagnostics.runSelfAudit({...good, egressCount: 5}).result, 'pass', 'earlier opted-in traffic is not a violation');
  const audit = diagnostics.runSelfAudit(bad);
  assert.equal(audit.result, 'fail');
  const failed = audit.checks.filter(c => c.status === 'fail').map(c => c.id).sort();
  assert.deepEqual(failed, ['egress-policy', 'history-privacy', 'renderer-isolation']);
});
test('diagnostic report redacts coordinates, paths, voices and remote hosts', () => {
  const report = diagnostics.buildReport({settings: {x: 12, y: 40, piperPath: '/Users/me/piper', aiEndpoint: 'http://10.0.0.9:11434', ttsVoice: 'Fred'},
    endpointLoopback: false, recentEvents: [], windows: []});
  const text = JSON.stringify(report);
  assert.doesNotMatch(text, /10\.0\.0\.9|\/Users\/me|"x":12|Fred/);
  assert.equal(report.settings.aiEndpoint, 'http://<non-local host>:11434');
  assert.equal(diagnostics.redactEndpoint('http://127.0.0.1:11434', true), 'http://127.0.0.1:11434');
});
test('speech queue bounds pending lines, speaks in order and cancels', async () => {
  const spoken = [], states = [];
  let stops = 0, finish;
  const q = createSpeechQueue({speak: t => { spoken.push(t); return new Promise(r => { finish = r; }); }, stop: () => { stops++; }, onState: s => states.push(s)});
  q.enqueue('one'); q.enqueue('two'); q.enqueue('three'); q.enqueue('four'); q.enqueue('five');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(q.pending, 3);
  finish(); await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(spoken, ['one', 'three']);
  q.cancel();
  assert.equal(stops, 1); assert.equal(q.pending, 0); assert.equal(q.speaking, false);
  assert.equal(q.enqueue('   '), false);
});
test('speech queue reports engine failure and continues', async () => {
  const states = [];
  const q = createSpeechQueue({speak: t => t === 'bad' ? Promise.reject(new Error('no voice')) : Promise.resolve(), stop() {}, onState: (s, d) => states.push(d ? s + ':' + d : s)});
  q.enqueue('bad'); q.enqueue('good');
  await new Promise(r => setTimeout(r, 10));
  assert.ok(states.includes('error:no voice'));
  assert.equal(states.at(-1), 'idle');
});
test('speech text is cleaned of code, links and markup and bounded', () => {
  assert.equal(clean('See **this** https://x.y/z ```rm -rf /```'), 'See this a link code omitted.');
  assert.ok(clean('word. '.repeat(200)).length <= 403);
});
test('piper adapter refuses missing binaries and never uses a shell', async () => {
  assert.equal(checkPiper({piperPath: '', piperModel: ''}).ok, false);
  assert.equal(checkPiper({piperPath: 'piper', piperModel: 'voice.onnx'}).ok, false);
  const dir = tmp();
  const bin = path.join(dir, 'piper'), model = path.join(dir, 'voice.onnx');
  fs.writeFileSync(bin, '#!/bin/sh\n', {mode: 0o755}); fs.writeFileSync(model, 'x');
  let seen;
  const fakeSpawn = (cmd, args, opts) => {
    seen = {cmd, args, opts};
    const proc = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => setImmediate(() => proc.emit('close', null, 'SIGKILL'));
    proc.stdin = {end: text => {
      const out = args[args.indexOf('--output_file') + 1];
      fs.writeFileSync(out, Buffer.alloc(100, 1));
      setImmediate(() => proc.emit('close', 0, null));
      proc.text = text;
    }};
    return proc;
  };
  const piper = createPiper({spawnImpl: fakeSpawn, tmpRoot: dir});
  const wav = await piper.synthesize('Hff.', {piperPath: bin, piperModel: model});
  assert.equal(wav.length, 100);
  assert.equal(seen.cmd, bin); assert.equal(seen.opts.shell, false);
  assert.deepEqual(seen.args.slice(0, 2), ['--model', model]);
  assert.deepEqual(fs.readdirSync(dir).filter(n => n.startsWith('dexter-tts-')), [], 'temp audio deleted');
  const hanging = createPiper({spawnImpl: (c, a) => { const p = fakeSpawn(c, a, {shell: false}); p.stdin = {end() {}}; return p; }, tmpRoot: dir, timeoutMs: 5000});
  const pending = hanging.synthesize('x', {piperPath: bin, piperModel: model});
  hanging.cancel();
  await assert.rejects(pending, /cancelled/);
});
