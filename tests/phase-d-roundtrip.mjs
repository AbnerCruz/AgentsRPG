import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Simulation} from '../src/simulation.js';

const normalize=sim=>{const x=sim.serialize();delete x.savedAt;return x};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,12);
const arr=a=>ArrayBuffer.isView(a)?Array.from(a):a;
function diffState(a,b){
 const A=normalize(a),B=normalize(b),keys=[...new Set([...Object.keys(A),...Object.keys(B)])].sort(),bad=[];
 for(const k of keys)if(JSON.stringify(A[k])!==JSON.stringify(B[k]))bad.push(`${k}:${hash(A[k])}/${hash(B[k])}`);
 return bad;
}
function diffWorldInternals(a,b){
 const wa=a.world,wb=b.world,bad=[];
 const fields=['tiles','biomes','waterKind','elevation','moisture','temperature','slope','flow','wear','resourceMask'];
 for(const k of fields){const A=arr(wa[k]),B=arr(wb[k]);if(JSON.stringify(A)!==JSON.stringify(B))bad.push(`${k}:${hash(A)}/${hash(B)}`)}
 const objectFields=['resources','spawnSeeds','dungeons','wind','settlement'];
 for(const k of objectFields)if(JSON.stringify(wa[k])!==JSON.stringify(wb[k]))bad.push(`${k}:${hash(wa[k])}/${hash(wb[k])}`);
 return bad;
}
function assertStateEqual(a,b,label){const bad=diffState(a,b);assert.equal(bad.length,0,`${label}; divergências: ${bad.join(', ')}`)}

const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assertStateEqual(restored,original,'hidratação deve reproduzir exatamente o estado salvo');
const hidden=diffWorldInternals(restored,original);
assert.equal(hidden.length,0,`hidratação compacta diverge internamente antes do primeiro tick: ${hidden.join(', ')}`);
for(let i=1;i<=72;i++){
 original.step();restored.step();
 const bad=diffState(restored,original);
 assert.equal(bad.length,0,`save/load divergiu no tick continuado ${i} (tick global ${original.tick}); ${bad.join(', ')}`);
}
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
