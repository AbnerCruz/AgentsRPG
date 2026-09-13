import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {summarizeBatch} from '../src/calibration/headless.js';
const root=process.argv[2]||'calibration-results',out=process.argv[3]||'calibration-batch.json';
async function files(dir){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else if(e.name.endsWith('.json'))out.push(p)}return out}
const paths=await files(root),runs=[];for(const p of paths){const d=JSON.parse(await readFile(p,'utf8'));if(d?.seed!=null&&d?.final)runs.push(d)}runs.sort((a,b)=>a.seed-b.seed);if(!runs.length)throw new Error(`Nenhum resultado de calibração encontrado em ${root}`);const batch={config:{source:root,seeds:runs.map(r=>r.seed),days:Math.max(...runs.map(r=>r.days))},summary:summarizeBatch(runs),runs};await writeFile(out,JSON.stringify(batch,null,2));console.log(JSON.stringify(batch.summary,null,2));
