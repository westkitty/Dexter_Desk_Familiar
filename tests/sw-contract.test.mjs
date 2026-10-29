import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://westkitty.github.io/Dexter_Desk_Familiar/';

function harness({failInstall = false} = {}) {
  const handlers = new Map();
  const backing = new Map();
  let skipWaiting = 0;
  let claimed = 0;
  let deleted = [];
  class MockResponse {
    constructor(body = '', options = {}) {
      this.body = body;
      this.status = options.status ?? 200;
      this.headers = options.headers ?? {};
    }
    static error() {return new MockResponse('blocked', {status: 0});}
  }
  const oldCache = new Map([['./index.html', new MockResponse('Old version')]]);
  backing.set('dexter-desk-familiar-v2', oldCache);
  const caches = {
    async open(name) {
      if (!backing.has(name)) backing.set(name, new Map());
      const current = backing.get(name);
      return {
        async addAll(paths) {
          if (failInstall) throw Error('network interrupted during install');
          for (const path of paths) current.set(path, new MockResponse('Asset: ' + path));
        },
        async match(request, options) {
          if (typeof request === 'string') return current.get(request) ?? null;
          const pathname = new URL(request.url).pathname;
          const name = './' + pathname.replace('/Dexter_Desk_Familiar/', '');
          return current.get(name) ?? null;
        }
      };
    },
    async keys() {return [...backing.keys()];},
    async delete(name) {deleted.push(name); return backing.delete(name);}
  };
  const self = {
    location: {origin: 'https://westkitty.github.io'},
    addEventListener(name, handler) {handlers.set(name, handler);},
    skipWaiting: async () => {skipWaiting++;},
    clients: {claim: async () => {claimed++;}}
  };
  runInNewContext(source, {self, caches, Response: MockResponse, URL});
  async function dispatch(name, event = {}) {
    let promise;
    const enriched = {
      ...event,
      waitUntil(p) {promise = p;},
      respondWith(p) {promise = p;}
    };
    handlers.get(name)(enriched);
    return promise;
  }
  return {dispatch, backing, deleted, get skipWaiting(){return skipWaiting;}, get claimed(){return claimed;}};
}

test('staged install does not delete last working cache when network fails', async () => {
  const h = harness({failInstall:true});
  await assert.rejects(h.dispatch('install'), /interrupted/);
  assert.equal(h.backing.has('dexter-desk-familiar-v2'), true);
  assert.equal(h.backing.has('dexter-desk-familiar-v3'), false);
  assert.equal(h.skipWaiting, 0);
});

test('successful install and activate remove old cache only after new shell succeeds', async () => {
  const h = harness();
  await h.dispatch('install');
  assert.equal(h.skipWaiting, 1);
  await h.dispatch('activate');
  assert.equal(h.claimed, 1);
  assert.equal(h.backing.has('dexter-desk-familiar-v2'), false);
  assert.equal(h.backing.has('dexter-desk-familiar-v3'), true);
});

test('requests use only current-version cache and block off-origin resources', async () => {
  const h = harness();
  await h.dispatch('install');
  const good = await h.dispatch('fetch', {request:{method:'GET', url:scope+'index.html', mode:'navigate'}});
  assert.equal(good.status, 200);
  assert.equal(good.body, 'Asset: ./index.html');
  const notInShell = await h.dispatch('fetch', {request:{method:'GET', url:scope+'private.md', mode:'same-origin'}});
  assert.equal(notInShell.status, 404);
  const foreign = await h.dispatch('fetch', {request:{method:'GET', url:'https://another.example/', mode:'cors'}});
  assert.equal(foreign.status, 0);
});
