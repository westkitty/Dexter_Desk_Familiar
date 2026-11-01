'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createAiClient, parseSse, PolicyError} = require('../core/ai-providers.cjs');

test('parseSse parses standard OpenAI SSE chunks and recognizes [DONE]', () => {
  const chunk1 = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
  const r1 = parseSse('', chunk1);
  assert.equal(r1.items.length, 1);
  assert.equal(r1.items[0].choices[0].delta.content, 'Hello');

  const chunk2 = 'data: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n';
  const r2 = parseSse('', chunk2);
  assert.equal(r2.items.length, 2);
  assert.equal(r2.items[0].choices[0].delta.content, ' world');
  assert.equal(r2.items[1].done, true);
});

test('OpenAI-compatible provider lists models and streams chat completion via SSE', async () => {
  const requests = [];
  const fakeFetch = async (url, opts) => {
    requests.push({url: String(url), method: opts.method, body: opts.body});
    if (url.endsWith('/models')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          object: 'list',
          data: [{id: 'llama3.2:3b'}, {id: 'qwen2.5:7b'}]
        })
      };
    }
    if (url.endsWith('/chat/completions')) {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Observant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":", as always."}}]}\n\n',
        'data: [DONE]\n\n'
      ];
      let i = 0;
      const encoder = new TextEncoder();
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              if (i >= chunks.length) return {value: undefined, done: true};
              const value = encoder.encode(chunks[i++]);
              return {value, done: false};
            }
          })
        }
      };
    }
    return {ok: false, status: 404};
  };

  const egress = [];
  const client = createAiClient({
    fetchImpl: fakeFetch,
    getConfig: () => ({
      enabled: true,
      provider: 'openai_compatible',
      endpoint: 'http://127.0.0.1:11435/v1',
      model: 'llama3.2:3b',
      timeoutSeconds: 30
    }),
    onEgress: e => egress.push(e)
  });

  const testResult = await client.testConnection();
  assert.equal(testResult.ok, true);
  assert.equal(testResult.model, 'llama3.2:3b');
  assert.ok(testResult.elapsedMs >= 0);
  assert.equal(testResult.provider, 'openai_compatible');

  const tokens = [];
  const reply = await client.streamChat({
    messages: [{role: 'user', content: 'Describe yourself.'}],
    systemPrompt: 'You are Dexter.',
    onToken: t => tokens.push(t)
  });

  assert.equal(reply.status, 'done');
  assert.equal(reply.text, 'Observant, as always.');
  assert.deepEqual(tokens, ['Observant', ', as always.']);
  assert.equal(egress.length, 3); // 1 tags for test, 1 tags for chat, 1 chat
  assert.equal(egress[2].kind, 'chat');
  assert.equal(egress[2].provider, 'openai_compatible');
  assert.equal(requests[2].url, 'http://127.0.0.1:11435/v1/chat/completions');
});

test('OpenAI-compatible protocol incompatibility is reported truthfully on 404', async () => {
  const fakeFetch = async () => ({ok: false, status: 404});
  const client = createAiClient({
    fetchImpl: fakeFetch,
    getConfig: () => ({
      enabled: true,
      provider: 'openai_compatible',
      endpoint: 'http://127.0.0.1:11435/v1'
    })
  });
  const res = await client.testConnection();
  assert.equal(res.ok, false);
  assert.match(res.detail, /Protocol incompatible/);
});

test('OpenAI-compatible stream cancellation aborts cleanly', async () => {
  let aborted = false;
  const fakeFetch = async (url, opts) => {
    if (url.endsWith('/models')) {
      return {ok: true, status: 200, json: async () => ({data: [{id: 'm1'}]})};
    }
    opts.signal.addEventListener('abort', () => { aborted = true; });
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: () => new Promise(resolve => {
            opts.signal.addEventListener('abort', () => resolve({value: undefined, done: true}));
          })
        })
      }
    };
  };

  const client = createAiClient({
    fetchImpl: fakeFetch,
    getConfig: () => ({
      enabled: true,
      provider: 'openai_compatible',
      endpoint: 'http://127.0.0.1:11435/v1',
      model: 'm1'
    })
  });

  const p = client.streamChat({messages: [{role: 'user', content: 'test'}]});
  setTimeout(() => client.cancel(), 20);
  const result = await p;
  assert.equal(result.status, 'cancelled');
  assert.equal(aborted, true);
});

test('Hermes gateway compatibility is labeled unverified', async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({data: [{id: 'hermes-model'}]})
  });
  const client = createAiClient({
    fetchImpl: fakeFetch,
    getConfig: () => ({
      enabled: true,
      provider: 'hermes_unverified',
      endpoint: 'http://127.0.0.1:11435/v1'
    })
  });
  const res = await client.testConnection();
  assert.equal(res.ok, true);
  assert.equal(res.provider, 'hermes_unverified');
  assert.match(res.detail, /Hermes \(unverified\)/);
});

test('OpenAI-compatible reasoning chunks invoke onThinking and keep stream alive', async () => {
  const fakeFetch = async (url) => {
    if (url.endsWith('/models')) {
      return {ok: true, status: 200, json: async () => ({data: [{id: 'reasoning-model'}]})};
    }
    const chunks = [
      'data: {"choices":[{"delta":{"content":"","reasoning":"Thinking step 1"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"","reasoning":" Thinking step 2"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Answer."}}]}\n\n',
      'data: [DONE]\n\n'
    ];
    let i = 0;
    const encoder = new TextEncoder();
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (i >= chunks.length) return {value: undefined, done: true};
            return {value: encoder.encode(chunks[i++]), done: false};
          }
        })
      }
    };
  };

  const thoughts = [];
  const tokens = [];
  const client = createAiClient({
    fetchImpl: fakeFetch,
    getConfig: () => ({
      enabled: true,
      provider: 'openai_compatible',
      endpoint: 'http://127.0.0.1:11435/v1',
      model: 'reasoning-model'
    })
  });

  const res = await client.streamChat({
    messages: [{role: 'user', content: 'solve'}],
    onToken: t => tokens.push(t),
    onThinking: th => thoughts.push(th)
  });

  assert.equal(res.status, 'done');
  assert.equal(res.text, 'Answer.');
  assert.deepEqual(tokens, ['Answer.']);
  assert.deepEqual(thoughts, ['Thinking step 1', ' Thinking step 2']);
});
