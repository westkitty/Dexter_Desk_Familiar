// Build a review-only, ad-hoc signed macOS disk image from the packaged arm64 app,
// then prove the real install path: mount read-only, verify, copy the app out,
// launch the copy (full runtime smoke), quit, relaunch and verify persistence.
// Never Developer ID signs, notarizes, installs into /Applications, or strips quarantine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyApp, IDENTIFIER} from './verify-macos.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'));
const out = path.join(desktop, 'out');
const appName = 'Dexter Desk Familiar.app';
const sourceApp = path.join(out, 'Dexter Desk Familiar-darwin-arm64', appName);
const dmgName = 'Dexter_Desk_Familiar_' + pkg.version + '_macOS_arm64_adhoc.dmg';
const dmgPath = path.join(out, dmgName);
const checksumPath = dmgPath + '.sha256';

const run = (command, args, opts = {}) => execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts});
function assert(condition, message) { if (!condition) throw new Error(message); }
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function smoke(exe, env, label) {
  execFileSync(exe, [], {env: {...process.env, DEXTER_DESKTOP_SMOKE: '1', ...env}, stdio: 'inherit', timeout: 150000});
  console.log(label + ': PASS');
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('This DMG build must run on Apple Silicon macOS');
const sourceAsar = path.join(sourceApp, 'Contents', 'Resources', 'app.asar');
assert(fs.existsSync(sourceAsar), 'Run npm run package:mac first');
const sourceFacts = verifyApp(sourceApp);
assert(!fs.existsSync(dmgPath) && !fs.existsSync(checksumPath), 'Existing DMG or checksum would be overwritten; preserve previous review builds first');

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-dmg-stage-'));
const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-dmg-check-'));
// Keep the extracted-app test under the project, not /var/folders, where sandbox
// extensions can reject helper-process media access.
const trialInstall = fs.mkdtempSync(path.join(out, '.dmg-install-probe-'));
const relaunchProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-relaunch-profile-'));
let attached = false;
try {
  run('ditto', [sourceApp, path.join(stage, appName)]);
  fs.symlinkSync('/Applications', path.join(stage, 'Applications'));
  run('hdiutil', ['create', '-srcfolder', stage, '-volname', 'Dexter Desk Familiar', '-fs', 'HFS+', '-format', 'UDZO', '-imagekey', 'zlib-level=9', dmgPath], {timeout: 180000});
  assert(fs.existsSync(dmgPath) && fs.statSync(dmgPath).size > 1000000, 'No valid DMG output');
  run('hdiutil', ['verify', '-quiet', dmgPath], {timeout: 120000});
  assert(/Format: UDZO/.test(run('hdiutil', ['imageinfo', dmgPath])), 'DMG is not a compressed read-only UDZO image');
  run('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, dmgPath], {timeout: 120000});
  attached = true;
  const mountedApp = path.join(mount, appName);
  assert(fs.lstatSync(path.join(mount, 'Applications')).isSymbolicLink(), 'Applications alias is not a symlink');
  assert(fs.readlinkSync(path.join(mount, 'Applications')) === '/Applications', 'Applications shortcut does not point to /Applications');
  assert(fs.readdirSync(mount).filter(n => !n.startsWith('.')).sort().join('|') === ['Applications', appName].sort().join('|'), 'Unexpected items in the DMG window');
  const mountedFacts = verifyApp(mountedApp);
  assert(mountedFacts.identifier === IDENTIFIER, 'DMG contains wrong application');
  assert(sha(path.join(mountedApp, 'Contents', 'Resources', 'app.asar')) === sha(sourceAsar), 'DMG app payload differs from packaged app');
  console.log('DMG verified: UDZO, read-only mount, drag-to-Applications layout, identity, signature and payload hash.');

  // Copy-out handoff, as a user dragging to Applications would do (into a disposable folder).
  const installedApp = path.join(trialInstall, appName);
  run('ditto', [mountedApp, installedApp], {timeout: 120000});
  assert(sha(path.join(installedApp, 'Contents', 'Resources', 'app.asar')) === sha(sourceAsar), 'Copied app changed its packaged payload');
  verifyApp(installedApp);
  const exe = path.join(installedApp, 'Contents', 'MacOS', 'Dexter Desk Familiar');
  smoke(exe, {DEXTER_DESKTOP_SMOKE_REQUIRE_VIDEO: '1'}, 'Copied-out app full runtime smoke');
  smoke(exe, {DEXTER_DESKTOP_SMOKE_PROFILE: relaunchProfile, DEXTER_DESKTOP_SMOKE_PHASE: 'persist-write'}, 'Copied-out app first launch (write preferences, quit)');
  smoke(exe, {DEXTER_DESKTOP_SMOKE_PROFILE: relaunchProfile, DEXTER_DESKTOP_SMOKE_PHASE: 'persist-verify'}, 'Copied-out app relaunch (preferences and position restored)');
  console.log('Source, mounted and copied-out app all pass deep strict ad-hoc signature checks. Gatekeeper: ' + sourceFacts.gatekeeper);
} finally {
  let detachError = null;
  if (attached) { try { run('hdiutil', ['detach', '-quiet', mount], {timeout: 30000}); } catch (error) { detachError = error; } }
  for (const dir of [stage, trialInstall, relaunchProfile]) fs.rmSync(dir, {recursive: true, force: true});
  if (!detachError) fs.rmSync(mount, {recursive: true, force: true});
  if (detachError) throw new Error('DMG was mounted but could not be detached: ' + detachError.message);
}
const digest = sha(dmgPath);
fs.writeFileSync(checksumPath, digest + '  ' + dmgName + '\n', {flag: 'wx'});
console.log('macOS review DMG: ' + dmgPath);
console.log('SHA-256: ' + digest);
console.log('Ad-hoc signed for integrity only. NOT Developer ID signed, NOT notarized. Gatekeeper requires explicit user approval on first open.');
