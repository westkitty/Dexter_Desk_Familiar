// Build a review-only, unsigned macOS disk image from the already packaged arm64 app.
// Never sign, notarize, install, or modify the target user's applications.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(desktop, 'out');
const appName = 'Dexter Desk Familiar.app';
const sourceApp = path.join(out, 'Dexter Desk Familiar-darwin-arm64', appName);
const dmgName = 'Dexter_Desk_Familiar_macOS_arm64_unsigned_alpha.dmg';
const dmgPath = path.join(out, dmgName);
const checksumPath = dmgPath + '.sha256';
const identifier = 'dev.stinkyweasel.dexterdesk';

function run(command, args, opts = {}) {
  return execFileSync(command, args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], ...opts});
}
function assert(condition, message) {if (!condition) throw new Error(message);}
function sha(file) {return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function plist(key, file) {
  return run('/usr/libexec/PlistBuddy', ['-c', 'Print :' + key, file]).trim();
}
if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('This unsigned DMG build must run on Apple Silicon macOS');
}
const info = path.join(sourceApp, 'Contents', 'Info.plist');
const sourceAsar = path.join(sourceApp,'Contents','Resources','app.asar');
assert(fs.existsSync(info) && fs.existsSync(sourceAsar), 'Run npm run package:mac first');
assert(plist('CFBundleIdentifier',info) === identifier, 'Unexpected app identity');
assert(plist('CFBundleExecutable',info) === 'Dexter Desk Familiar', 'Unexpected executable');
assert(fs.statSync(sourceAsar).size > 0, 'Missing packaged desktop application');
assert(!fs.existsSync(dmgPath) && !fs.existsSync(checksumPath),
  'Existing DMG or checksum would be overwritten; preserve previous review builds first');

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-dmg-stage-'));
const mount = fs.mkdtempSync(path.join(os.tmpdir(), 'dexter-dmg-check-'));
let attached = false;
try {
  run('ditto', [sourceApp, path.join(stage,appName)]);
  fs.symlinkSync('/Applications',path.join(stage,'Applications'));
  run('hdiutil', ['create','-srcfolder',stage,'-volname','Dexter Desk Familiar',
    '-fs','HFS+','-format','UDZO','-imagekey','zlib-level=9',dmgPath],{timeout:180000});
  assert(fs.existsSync(dmgPath) && fs.statSync(dmgPath).size>1000000,'No valid DMG output');
  run('hdiutil', ['verify','-quiet',dmgPath],{timeout:120000});
  run('hdiutil',['attach','-readonly','-nobrowse','-noautoopen',
    '-mountpoint',mount,dmgPath],{timeout:120000});
  attached = true;
  const mountedApp = path.join(mount, appName);
  const mountedInfo = path.join(mountedApp,'Contents','Info.plist');
  assert(fs.lstatSync(path.join(mount,'Applications')).isSymbolicLink(),
    'Applications alias is not a symlink');
  assert(fs.readlinkSync(path.join(mount,'Applications')) === '/Applications',
    'Applications shortcut does not point to /Applications');
  assert(plist('CFBundleIdentifier',mountedInfo) === identifier,'DMG contains wrong application');
  assert(sha(path.join(mountedApp,'Contents','Resources','app.asar')) === sha(sourceAsar),
    'DMG app payload differs from packaged app');
  assert(fs.statSync(path.join(mountedApp,'Contents','MacOS','Dexter Desk Familiar')).mode & 0o111,
    'DMG application is not executable');
  console.log('DMG verified: read-only mount, exact app identifier, source-matched payload, Applications link.');
  // Test *the mounted disk image*, not only the app source or build directory.
  const exe = path.join(mountedApp,'Contents','MacOS','Dexter Desk Familiar');
  execFileSync(exe,[],{env:{...process.env,DEXTER_DESKTOP_SMOKE:'1'},
    stdio:'inherit',timeout:60000});
  console.log('Mounted DMG application runtime smoke: PASS');
} finally {
  let detachError = null;
  if (attached) {
    try {run('hdiutil',['detach','-quiet',mount],{timeout:30000});}
    catch(error) {detachError=error;}
  }
  fs.rmSync(stage,{recursive:true,force:true});
  if (!detachError) fs.rmSync(mount,{recursive:true,force:true});
  if(detachError)throw new Error('DMG was mounted but could not be detached: '+detachError.message);
}
const digest = sha(dmgPath);
fs.writeFileSync(checksumPath,digest+'  '+dmgName+'\n',{flag:'wx'});
console.log('Unsigned macOS review DMG: '+dmgPath);
console.log('SHA-256: '+digest);
console.log('Not Developer ID signed or notarized. Target-device pointer tests remain pending.');
