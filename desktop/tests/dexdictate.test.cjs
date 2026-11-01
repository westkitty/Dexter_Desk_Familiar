'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkDexDictate,
  DEFAULT_APP_PATHS,
  getContractProposal
} = require('../core/dexdictate-interop.cjs');

test('dexdictate: detects missing installation when path does not exist', () => {
  const fakeFs = {
    statSync: () => { throw new Error('ENOENT'); }
  };
  const fakeExec = () => '';

  const res = checkDexDictate({
    fsImpl: fakeFs,
    execSyncImpl: fakeExec,
    appPaths: ['/Applications/DexDictate.app']
  });

  assert.equal(res.installed, false);
  assert.equal(res.running, false);
  assert.equal(res.status, 'not_installed');
  assert.match(res.label, /Not installed/);
  assert.equal(res.directHandoffSupported, false);
});

test('dexdictate: detects installed app and reports external dictation only', () => {
  const fakeFs = {
    statSync: p => {
      if (p === '/Applications/DexDictate.app') return { isDirectory: () => true, isFile: () => false };
      throw new Error('ENOENT');
    }
  };
  const fakeExec = () => '12345\n'; // process is running

  const res = checkDexDictate({
    fsImpl: fakeFs,
    execSyncImpl: fakeExec,
    appPaths: ['/Applications/DexDictate.app']
  });

  assert.equal(res.installed, true);
  assert.equal(res.running, true);
  assert.equal(res.appPath, '/Applications/DexDictate.app');
  assert.equal(res.status, 'installed_external_only');
  assert.equal(res.label, 'Installed — external dictation / Direct handoff unavailable');
  assert.equal(res.directHandoffSupported, false);
  assert.match(res.blockedReason, /Accessibility/);
  assert.match(res.guidance, /Conversation panel/);
});

test('dexdictate: contract proposal contains protocol specifications and socket guidance', () => {
  const proposal = getContractProposal();
  assert.match(proposal, /Unix Domain Socket/);
  assert.match(proposal, /BLOCKED/);
  assert.match(proposal, /Accessibility/);
});
