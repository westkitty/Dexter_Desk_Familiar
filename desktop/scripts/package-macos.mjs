import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.join(root,'out');
fs.mkdirSync(out,{recursive:true});
const packager=path.join(root,'node_modules','.bin','electron-packager');
execFileSync(packager,[
  path.join(root,'.stage','app'),'Dexter Desk Familiar','--platform=darwin',
  '--arch=arm64','--out='+out,'--overwrite','--app-bundle-id=dev.stinkyweasel.dexterdesk',
  '--app-version=0.1.0-alpha.1','--prune=true','--asar'
],{cwd:root,stdio:'inherit'});
console.log('Unsigned development bundle prepared in desktop/out; signing and notarization NOT performed.');
