// Verify a packaged Dexter .app: identity, metadata, icon and the complete
// ad-hoc code signature including every nested Electron helper and framework.
// Usage: node scripts/verify-macos.mjs "<path to .app>"
// This proves bundle INTEGRITY only. An ad-hoc signature is not Developer ID
// signing and is not notarization; Gatekeeper is assessed for information only.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const IDENTIFIER = 'dev.stinkyweasel.dexterdesk';
const run = (cmd, args) => execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
// codesign -d and spctl report on stderr; capture both streams.
const runAll = (cmd, args) => {
  const r = spawnSync(cmd, args, {encoding: 'utf8'});
  return {code: r.status ?? 1, out: String(r.stdout || '') + String(r.stderr || '')};
};
const plist = (key, file) => run('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, file]).trim();
function assert(ok, message) { if (!ok) throw new Error('macOS bundle verification failed: ' + message); }

export function verifyApp(app, {expectVersion} = {}) {
  assert(process.platform === 'darwin', 'must run on macOS');
  const info = path.join(app, 'Contents', 'Info.plist');
  assert(fs.existsSync(info), 'missing Info.plist in ' + app);
  const facts = {
    identifier: plist('CFBundleIdentifier', info), executable: plist('CFBundleExecutable', info),
    name: plist('CFBundleName', info), version: plist('CFBundleShortVersionString', info),
    category: (() => { try { return plist('LSApplicationCategoryType', info); } catch { return ''; } })()
  };
  assert(facts.identifier === IDENTIFIER, 'unexpected bundle identifier ' + facts.identifier);
  assert(facts.executable === 'Dexter Desk Familiar', 'unexpected executable ' + facts.executable);
  if (expectVersion) assert(facts.version === expectVersion, 'version ' + facts.version + ' != ' + expectVersion);
  const exe = path.join(app, 'Contents', 'MacOS', facts.executable);
  assert((fs.statSync(exe).mode & 0o111) !== 0, 'main executable is not executable');
  assert(fs.statSync(path.join(app, 'Contents', 'Resources', 'app.asar')).size > 0, 'missing app.asar');
  assert(fs.statSync(path.join(app, 'Contents', 'Resources', 'electron.icns')).size > 1000, 'missing app icon');
  // Whole bundle, deep and strict: sealed resources and nested code.
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
  // Each nested helper app and framework individually, so a broken helper is named.
  const frameworks = path.join(app, 'Contents', 'Frameworks');
  const nested = fs.readdirSync(frameworks).filter(n => n.endsWith('.app') || n.endsWith('.framework')).map(n => path.join(frameworks, n));
  assert(nested.some(n => n.endsWith('Helper.app')) && nested.some(n => n.endsWith('Electron Framework.framework')), 'expected Electron helpers missing');
  for (const item of nested) run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', item]);
  const details = runAll('/usr/bin/codesign', ['-dv', '--verbose=4', app]).out;
  assert(/Signature=adhoc/.test(details), 'expected an ad-hoc signature (Developer ID signing is not configured)');
  assert(new RegExp('Identifier=' + IDENTIFIER.replace(/\./g, '\\.')).test(details), 'signature identifier mismatch');
  assert(/Sealed Resources version=2/.test(details), 'resources are not sealed');
  // Informational only. Never bypassed, never fatal: an ad-hoc app is expected to be rejected.
  const gatekeeper = runAll('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', app]);
  return {...facts, nested: nested.length, signature: 'adhoc', gatekeeper: gatekeeper.code === 0 ? 'accepted' : 'rejected (expected for ad-hoc; not notarized)', gatekeeperDetail: gatekeeper.out.trim().split('\n').slice(-1)[0] || ''};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = process.argv[2];
  if (!app) { console.error('usage: verify-macos.mjs <app>'); process.exit(2); }
  console.log(JSON.stringify(verifyApp(path.resolve(app), {expectVersion: process.argv[3]}), null, 2));
}
