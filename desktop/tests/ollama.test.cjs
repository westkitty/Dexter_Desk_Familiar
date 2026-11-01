const test = require('node:test');
const assert = require('node:assert/strict');
const {createOllamaClient, resolveModel, boundedContext, parseNdjson} = require('../core/ollama.cjs');

const enc = new TextEncoder();
function streamOf(chunks, {delayMs = 0, hang = false} = {}) {
  let i = 0;
  return {getReader() {
    return {read: () => new Promise(resolve => {
      if (i < chunks.length) { const value = enc.encode(chunks[i++]); setTimeout(() => resolve({value, done: false}), delayMs); }
      else if (hang) { /* never resolves: simulates a stalled server */ }
      else resolve({value: undefined, done: true});
    })};
  }};
}
function fakeFetch(routes, calls = []) {
  return async (url, options = {}) => {
    calls.push({url, method: options.method, body: options.body});
    const route = routes[new URL(url).pathname];
    if (!route) throw new TypeError('fetch failed');
    return new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})));
      Promise.resolve(route(options)).then(resolve, reject);
    });
  };
}
const tags = () => ({ok: true, status: 200, json: async () => ({models: [{name: 'tiny:latest'}, {name: 'other'}]})});
const config = over => () => ({enabled: true, endpoint: 'http://127.0.0.1:11434', allowRemote: false, model: '', timeoutSeconds: 30, contextMessages: 12, ...over});

test('model resolution prefers configured, then :latest, then first installed; never a hardcoded family', () => {
  assert.deepEqual(resolveModel('tiny', ['tiny:latest']), {model: 'tiny:latest', fallback: false});
  assert.deepEqual(resolveModel('missing', ['a', 'b']), {model: 'a', fallback: true});
  assert.deepEqual(resolveModel('', ['a']), {model: 'a', fallback: false});
  assert.deepEqual(resolveModel('x', []), {model: null, fallback: false});
});
test('context is bounded and excludes non-conversation roles', () => {
  const msgs = Array.from({length: 30}, (_, i) => ({role: i % 2 ? 'assistant' : 'user', content: 'm' + i}));
  msgs.push({role: 'system', content: 'inject'}, {role: 'dexter', content: 'bubble'});
  const ctx = boundedContext(msgs, 6);
  assert.equal(ctx.length, 6);
  assert.equal(ctx.at(-1).content, 'm29');
  assert.ok(ctx.every(m => m.role === 'user' || m.role === 'assistant'));
});
test('NDJSON parser keeps partial lines across chunks', () => {
  const a = parseNdjson('', '{"a":1}\n{"b"');
  assert.deepEqual(a.items, [{a: 1}]);
  const b = parseNdjson(a.rest, ':2}\n');
  assert.deepEqual(b.items, [{b: 2}]);
});
test('disabled AI performs zero network requests', async () => {
  const calls = [];
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags}, calls), getConfig: config({enabled: false})});
  const r = await client.streamChat({messages: [{role: 'user', content: 'hi'}]});
  assert.equal(r.status, 'disabled');
  assert.equal((await client.testConnection()).ok, false);
  assert.equal(calls.length, 0);
});
test('remote endpoint without explicit permission performs zero requests', async () => {
  const calls = [];
  const client = createOllamaClient({fetchImpl: fakeFetch({}, calls), getConfig: config({endpoint: 'http://10.1.2.3:11434'})});
  const t = await client.testConnection();
  assert.equal(t.ok, false); assert.equal(t.policy, true);
  assert.equal(calls.length, 0);
});
test('streams tokens in order and reports egress', async () => {
  const calls = [], egress = [], tokens = [];
  const chat = () => ({ok: true, status: 200, body: streamOf([
    '{"message":{"content":"Hm"}}\n{"message":{"con', 'tent":". Fine."}}\n', '{"done":true}\n'])});
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': chat}, calls), getConfig: config({model: 'tiny'}), onEgress: e => egress.push(e)});
  const r = await client.streamChat({messages: [{role: 'user', content: 'hi'}], systemPrompt: 'S', onToken: t => tokens.push(t)});
  assert.equal(r.status, 'done'); assert.equal(r.text, 'Hm. Fine.'); assert.equal(r.model, 'tiny:latest');
  assert.deepEqual(tokens, ['Hm', '. Fine.']);
  const body = JSON.parse(calls[1].body);
  assert.equal(body.messages[0].role, 'system'); assert.equal(body.stream, true);
  assert.deepEqual(egress.map(e => e.kind), ['tags', 'chat']);
  assert.equal(client.busy(), false);
});
test('cancellation stops an in-flight stream promptly', async () => {
  const tokens = [];
  const client = createOllamaClient({fetchImpl: async (url, o) => {
    if (url.endsWith('/api/tags')) return tags();
    let sent = false;
    return {ok: true, status: 200, body: {getReader: () => ({read: () => new Promise((resolve, reject) => {
      if (!sent) { sent = true; return resolve({value: enc.encode('{"message":{"content":"a"}}\n'), done: false}); }
      o.signal.addEventListener('abort', () => reject(new Error('aborted')));
    })})}};
  }, getConfig: config()});
  const pending = client.streamChat({messages: [{role: 'user', content: 'x'}], onToken: t => tokens.push(t)});
  await new Promise(r => setTimeout(r, 30));
  const started = Date.now();
  client.cancel();
  const r = await pending;
  assert.equal(r.status, 'cancelled');
  assert.equal(r.text, 'a', 'partial text is preserved');
  assert.ok(Date.now() - started < 200);
  assert.equal(client.busy(), false);
});
test('cancel before headers aborts the request', async () => {
  let release;
  const chat = () => new Promise(r => { release = r; });
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': chat}), getConfig: config()});
  const pending = client.streamChat({messages: [{role: 'user', content: 'x'}]});
  await new Promise(r => setTimeout(r, 20));
  client.cancel();
  const r = await pending;
  assert.equal(r.status, 'cancelled');
  assert.equal(typeof release, 'function');
});
test('stalled server is stopped by the idle timeout', async () => {
  const chat = () => ({ok: true, status: 200, body: streamOf([], {hang: true})});
  const client = createOllamaClient({fetchImpl: async (url, o) => {
    if (url.endsWith('/api/tags')) return tags();
    const res = chat();
    // Make the hanging reader observe aborts like a real body stream.
    const reader = res.body.getReader();
    res.body = {getReader: () => ({read: () => new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(new Error('aborted'))))})};
    void reader; return res;
  }, getConfig: config(), headerTimeoutMs: 50, idleTimeoutMs: 60});
  const r = await client.streamChat({messages: [{role: 'user', content: 'x'}]});
  assert.equal(r.status, 'error'); assert.match(r.detail, /stopped responding/);
});
test('unreachable server reports offline instead of throwing', async () => {
  const client = createOllamaClient({fetchImpl: async () => { throw new TypeError('fetch failed'); }, getConfig: config()});
  const r = await client.streamChat({messages: [{role: 'user', content: 'x'}]});
  assert.equal(r.status, 'offline');
  const t = await client.testConnection();
  assert.equal(t.ok, false); assert.match(t.detail, /Could not reach/);
});
test('model error lines and HTTP errors surface as errors', async () => {
  const errLine = () => ({ok: true, status: 200, body: streamOf(['{"error":"model not found"}\n'])});
  const c1 = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': errLine}), getConfig: config()});
  assert.match((await c1.streamChat({messages: [{role: 'user', content: 'x'}]})).detail, /model not found/);
  const http = () => ({ok: false, status: 500});
  const c2 = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': http}), getConfig: config()});
  assert.match((await c2.streamChat({messages: [{role: 'user', content: 'x'}]})).detail, /HTTP 500/);
});
test('replies are truncated at the size cap', async () => {
  const big = JSON.stringify({message: {content: 'x'.repeat(5000)}}) + '\n';
  const chat = () => ({ok: true, status: 200, body: streamOf([big, big])});
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': chat}), getConfig: config()});
  const r = await client.streamChat({messages: [{role: 'user', content: 'x'}]});
  assert.equal(r.status, 'truncated'); assert.equal(r.text.length, 6000);
});
test('only one reply streams at a time', async () => {
  const chat = () => new Promise(() => {});
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': tags, '/api/chat': chat}), getConfig: config()});
  const first = client.streamChat({messages: [{role: 'user', content: 'x'}]});
  await new Promise(r => setTimeout(r, 10));
  assert.equal((await client.streamChat({messages: [{role: 'user', content: 'y'}]})).status, 'error');
  client.cancel(); await first;
});
test('no models installed is reported without downloading anything', async () => {
  const calls = [];
  const empty = () => ({ok: true, status: 200, json: async () => ({models: []})});
  const client = createOllamaClient({fetchImpl: fakeFetch({'/api/tags': empty}, calls), getConfig: config()});
  const t = await client.testConnection();
  assert.equal(t.ok, false); assert.match(t.detail, /will not download/);
  assert.ok(calls.every(c => !c.url.includes('/api/pull')));
});
