import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {dirname,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const src=resolve(root,'src');
const files=[];
async function walk(dir){for(const name of await readdir(dir)){const p=resolve(dir,name),s=await stat(p);if(s.isDirectory())await walk(p);else if(extname(p)==='.js')files.push(p)}}
await walk(src);
const importRe=/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g;
for(const file of files){const text=await readFile(file,'utf8');for(const m of text.matchAll(importRe)){let target=resolve(dirname(file),m[1]);if(!extname(target))target+='.js';await stat(target).catch(()=>assert.fail(`Import quebrado em ${file.slice(root.length+1)} -> ${m[1]}`))}}
const sw=await readFile(resolve(root,'sw.js'),'utf8');for(const m of sw.matchAll(/['"](\.\/src\/[^'"]+\.js)['"]/g)){const p=resolve(root,m[1].slice(2));await stat(p).catch(()=>assert.fail(`CORE do service worker aponta para arquivo ausente: ${m[1]}`))}
await import('../src/systems/technology.js');
await import('../src/ui/phaseb.js');
console.log(`OK module graph: ${files.length} módulos relativos resolvidos`);
