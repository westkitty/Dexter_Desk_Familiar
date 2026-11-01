'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createDocumentsStore,
  chunkMarkdown,
  tokenize,
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  MAX_CONTEXT_CHARS
} = require('../core/documents.cjs');

test('documents: chunkMarkdown splits by headings', () => {
  const md = `# Project Dexter

This is the overview paragraph.

## Architecture

Electron on macOS.
Uses native Node modules.

### Sound System

Web Audio synthesizer with chiptunes.
`;

  const chunks = chunkMarkdown(md, 'dexter-spec.md');
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].heading, 'Project Dexter');
  assert.match(chunks[0].text, /overview paragraph/);
  assert.equal(chunks[1].heading, 'Architecture');
  assert.match(chunks[1].text, /Electron on macOS/);
  assert.equal(chunks[2].heading, 'Sound System');
  assert.match(chunks[2].text, /Web Audio synthesizer/);
});

test('documents: tokenize strips punctuation and stop words', () => {
  const tokens = tokenize('The Dexter desk familiar is an interactive pet for macOS.');
  assert.ok(tokens.includes('dexter'));
  assert.ok(tokens.includes('familiar'));
  assert.ok(tokens.includes('interactive'));
  assert.ok(tokens.includes('macos'));
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('is'));
  assert.ok(!tokens.includes('for'));
});

test('documents: store imports text and computes SHA-256 hash', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dex-doc-test-'));
  const storeFile = path.join(tmpDir, 'project-documents.json');

  try {
    const store = createDocumentsStore({file: storeFile});
    const docMeta = store.importText('synthetic-spec.md', '# Synthetic Spec\n\nModular design.');

    assert.equal(docMeta.name, 'synthetic-spec.md');
    assert.equal(typeof docMeta.hash, 'string');
    assert.equal(docMeta.hash.length, 64);
    assert.equal(docMeta.chunkCount, 1);
    assert.equal(store.size, 1);

    // Verify stored file is mode 0600
    const stat = fs.statSync(storeFile);
    assert.equal(stat.mode & 0o777, 0o600);

    // Verify reloading
    const storeReloaded = createDocumentsStore({file: storeFile});
    assert.equal(storeReloaded.load(), 1);
    assert.equal(storeReloaded.list()[0].name, 'synthetic-spec.md');
  } finally {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
});

test('documents: rejects file exceeding max byte size', () => {
  const store = createDocumentsStore({maxFileBytes: 100});
  const largeText = 'A'.repeat(150);
  assert.throws(() => {
    store.importText('large.md', largeText);
  }, /exceeds maximum size/);
});

test('documents: enforces max document limit', () => {
  const store = createDocumentsStore({maxDocs: 2});
  store.importText('doc1.md', '# Doc 1');
  store.importText('doc2.md', '# Doc 2');
  assert.throws(() => {
    store.importText('doc3.md', '# Doc 3');
  }, /Maximum of 2 project documents reached/);
});

test('documents: relevance retrieval scores and bounds to maxContextChars', () => {
  const store = createDocumentsStore({maxContextChars: 400});
  store.importText('spec.md', `# Engine Architecture

The game engine uses fixed time steps.

# Sound Architecture

The sound engine synthesizes laser and jump chiptunes using Web Audio oscillators.

# Visual Pipeline

Sprites are rendered at 96px pixel scale with alpha mask hit testing.`);

  const ctx = store.retrieveContext('How does sound and audio work?');
  assert.ok(ctx);
  assert.match(ctx.text, /Sound Architecture/);
  assert.match(ctx.text, /chiptunes/);
  assert.ok(ctx.citations.some(c => c.includes('Sound Architecture')));
  assert.ok(ctx.charCount <= 400);
});

test('documents: dual-gate firewall enforces privacy policies', () => {
  const store = createDocumentsStore();
  store.importText('private.md', '# Secret Guidelines\n\nConfidential project goals.');

  // Gate 1: Disabled
  const r1 = store.cross({
    enabled: false,
    isRemote: false,
    allowRemote: false,
    query: 'guidelines'
  });
  assert.equal(r1, null);
  assert.equal(store.crossings, 0);

  // Gate 2: Enabled, but Remote endpoint without allowRemote
  const r2 = store.cross({
    enabled: true,
    isRemote: true,
    allowRemote: false,
    query: 'guidelines'
  });
  assert.equal(r2, null);
  assert.equal(store.crossings, 0);

  // Allowed: Local loopback
  const r3 = store.cross({
    enabled: true,
    isRemote: false,
    allowRemote: false,
    query: 'guidelines'
  });
  assert.ok(r3);
  assert.match(r3.text, /Secret Guidelines/);
  assert.equal(store.crossings, 1);

  // Allowed: Remote with explicit allowRemote
  const r4 = store.cross({
    enabled: true,
    isRemote: true,
    allowRemote: true,
    query: 'guidelines'
  });
  assert.ok(r4);
  assert.equal(store.crossings, 2);
});

test('documents: stats reports counts and bytes without exposing content', () => {
  const store = createDocumentsStore();
  store.importText('one.md', '# Title One\n\nContent one.');
  store.importText('two.md', '# Title Two\n\nContent two.');

  const st = store.stats();
  assert.equal(st.count, 2);
  assert.ok(st.totalBytes > 0);
  assert.equal(st.totalChunks, 2);
  assert.equal(st.crossings, 0);
  // Ensure no doc names or texts in stats object
  assert.equal(st.name, undefined);
  assert.equal(st.content, undefined);
});
