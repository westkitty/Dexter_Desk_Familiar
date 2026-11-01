// Build the Apple Silicon .app from the staged payload, seal it with a complete
// ad-hoc signature, and verify it. Never Developer ID signs or notarizes.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {verifyApp} from './verify-macos.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
// macOS expects numeric bundle versions; the alpha label is carried by the DMG name.
const bundleVersion = pkg.version.split('-')[0];
const out = path.join(root, 'out');
fs.mkdirSync(out, {recursive: true});
const sourceIcon = path.join(root, '.stage', 'app', 'icons', 'icon-512.png');
const iconset = path.join(root, '.stage', 'Dexter.iconset');
const icon = path.join(root, '.stage', 'Dexter.icns');
fs.mkdirSync(iconset, {recursive: true});
for (const [size, name] of [[16, 'icon_16x16.png'], [32, 'icon_16x16@2x.png'], [32, 'icon_32x32.png'], [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'], [256, 'icon_128x128@2x.png'], [256, 'icon_256x256.png'], [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'], [1024, 'icon_512x512@2x.png']]) {
  execFileSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), sourceIcon, '--out', path.join(iconset, name)], {stdio: 'ignore'});
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icon], {stdio: 'inherit'});
const packager = path.join(root, 'node_modules', '.bin', 'electron-packager');
execFileSync(packager, [
  path.join(root, '.stage', 'app'), 'Dexter Desk Familiar', '--platform=darwin', '--arch=arm64', '--out=' + out, '--overwrite',
  '--app-bundle-id=dev.stinkyweasel.dexterdesk', '--app-version=' + bundleVersion, '--build-version=' + bundleVersion,
  '--app-category-type=public.app-category.entertainment', '--app-copyright=Dexter Desk Familiar contributors',
  '--extend-info=' + path.join(root, 'build', 'Info.extend.plist'),
  '--prune=true', '--asar', '--icon=' + icon
], {cwd: root, stdio: 'inherit'});
const app = path.join(out, 'Dexter Desk Familiar-darwin-arm64', 'Dexter Desk Familiar.app');
if (!fs.existsSync(path.join(app, 'Contents', 'Resources', 'app.asar'))) throw new Error('Missing packaged app payload');
// Electron Packager leaves an invalid linker signature on Apple Silicon unless the
// complete bundle and nested helpers are re-signed. REGRESSION INVARIANT: the build
// fails unless strict deep verification passes. Ad-hoc is integrity, not trust.
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', app], {stdio: 'inherit'});
const facts = verifyApp(app, {expectVersion: bundleVersion});
console.log('Verified macOS arm64 app: ' + JSON.stringify(facts));
console.log('This is NOT Developer ID signed and NOT notarized. Gatekeeper will require explicit approval on first open.');
