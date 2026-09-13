import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {summarizeBatch} from '../src/calibration/headless.js';
const root=process.argv[2]||'grid-results',key=process.argv[3]||'hungerRate',out=process.argv[4]||'phase-d-grid.json';
async function walk(dir){let xs=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())xs.push(...await walk(p));else if(e.name.endsWith('.json'))xs.push(p)}return xs}
const groups=new Map;for(const p of await walk(root)){const r=JSON.parse(await readFile(p,'utf8'));if(r?.seed==null||!r?.final)continue;const value=r.balance?.[key];if(!Number.isFinite(value))continue;const k=String(value);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
const rows=[...groups.entries()].map(([value,runs])=>({key,value:+value,seeds:runs.map(r=>r.seed).sort((a,b)=>a-b),summary:summarizeBatch(runs)})).sort((a,b)=>a.value-b.value);if(!rows.length)throw new Error(`Sem resultados para ${key}`);const result={key,rows};await writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
