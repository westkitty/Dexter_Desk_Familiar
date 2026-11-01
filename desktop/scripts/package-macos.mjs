import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.join(root,'out');
fs.mkdirSync(out,{recursive:true});
const sourceIcon=path.join(root,'.stage','app','icons','icon-512.png');
const iconset=path.join(root,'.stage','Dexter.iconset');
const icon=path.join(root,'.stage','Dexter.icns');
fs.mkdirSync(iconset,{recursive:true});
for (const [size,name] of [
  [16,'icon_16x16.png'],[32,'icon_16x16@2x.png'],
  [32,'icon_32x32.png'],[64,'icon_32x32@2x.png'],
  [128,'icon_128x128.png'],[256,'icon_128x128@2x.png'],
  [256,'icon_256x256.png'],[512,'icon_256x256@2x.png'],
  [512,'icon_512x512.png'],[1024,'icon_512x512@2x.png']
]) {
  execFileSync('sips',['-s','format','png','-z',String(size),String(size),
    sourceIcon,'--out',path.join(iconset,name)],{stdio:'ignore'});
}
execFileSync('iconutil',['-c','icns',iconset,'-o',icon],{stdio:'inherit'});
const packager=path.join(root,'node_modules','.bin','electron-packager');
execFileSync(packager,[
  path.join(root,'.stage','app'),'Dexter Desk Familiar','--platform=darwin',
  '--arch=arm64','--out='+out,'--overwrite','--app-bundle-id=dev.stinkyweasel.dexterdesk',
  '--app-version=0.1.0-alpha.1','--prune=true','--asar','--icon='+icon
],{cwd:root,stdio:'inherit'});
const app=path.join(out,'Dexter Desk Familiar-darwin-arm64','Dexter Desk Familiar.app');
if(!fs.existsSync(path.join(app,'Contents','Resources','app.asar'))) throw new Error('Missing packaged app payload');
// Electron Packager leaves an invalid linker signature on Apple Silicon unless
// the complete bundle and nested helpers are signed. Ad-hoc signing is a BUILD
// integrity fix only; it is NOT a Developer ID signature or notarization.
execFileSync('/usr/bin/codesign',[
  '--force','--deep','--sign','-','--timestamp=none',app
],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',[
  '--verify','--deep','--strict','--verbose=2',app
],{stdio:'inherit'});
const signature=execFileSync('/usr/bin/codesign',[
  '-dv','--verbose=2',app
],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
console.log('macOS arm64 app: ad-hoc code signature verified, including sealed resources.');
console.log('This is not a Developer ID signature. Gatekeeper may still reject downloads until individually approved.');

