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
function diffNpcHidden(a,b){
 const A=a.npcs,B=b.npcs,bad=[];
 for(const k of['prevX','prevY','animFrame','animTimer','moving']){const x=arr(A[k]),y=arr(B[k]);if(JSON.stringify(x)!==JSON.stringify(y))bad.push(`${k}:${firstArrayDiff(x,y)}`)}
 for(const k of['plan','scores'])if(JSON.stringify(A[k])!==JSON.stringify(B[k]))bad.push(`${k}:${hash(A[k])}/${hash(B[k])}`);
 return bad;
}
function firstArrayDiff(a,b){const n=Math.max(a?.length||0,b?.length||0);for(let i=0;i<n;i++)if(a?.[i]!==b?.[i])return`${i}:${a?.[i]}/${b?.[i]}`;return'?' }
function firstNpcSerializedDiff(a,b){
 const A=a.npcs.serialize(),B=b.npcs.serialize();
 for(const k of Object.keys(A)){
  if(JSON.stringify(A[k])===JSON.stringify(B[k]))continue;
  if(Array.isArray(A[k])&&Array.isArray(B[k]))return`${k}[${firstArrayDiff(A[k],B[k])}]`;
  return`${k}:${hash(A[k])}/${hash(B[k])}`;
 }
 return'none';
}
function firstWorldDiff(a,b){
 const A=a.world.serialize(),B=b.world.serialize();
 for(const k of Object.keys(A)){
  if(JSON.stringify(A[k])===JSON.stringify(B[k]))continue;
  if(ArrayBuffer.isView(A[k])&&ArrayBuffer.isView(B[k]))return`${k}[${firstArrayDiff(Array.from(A[k]),Array.from(B[k]))}]`;
  if(Array.isArray(A[k])&&Array.isArray(B[k])){
   const n=Math.max(A[k].length,B[k].length);for(let i=0;i<n;i++)if(JSON.stringify(A[k][i])!==JSON.stringify(B[k][i]))return`${k}[${i}]:${JSON.stringify(A[k][i])}/${JSON.stringify(B[k][i])}`;
  }
  return`${k}:${hash(A[k])}/${hash(B[k])}`;
 }
 return'none';
}
function firstMemoryDiff(a,b){
 const A=a.memory.serialize(),B=b.memory.serialize();
 for(const k of Object.keys(A))if(JSON.stringify(A[k])!==JSON.stringify(B[k])){const aa=A[k]||[],bb=B[k]||[];for(let i=0;i<Math.max(aa.length,bb.length);i++)if(JSON.stringify(aa[i])!==JSON.stringify(bb[i]))return`${k}[${i}]:${hash(aa[i])}/${hash(bb[i])}`;return`${k}:${hash(A[k])}/${hash(B[k])}`}
 return'none';
}
function firstPerceptionDiff(a,b){
 const A=a.lastPerception,B=b.lastPerception;for(let i=0;i<Math.max(A.length,B.length);i++)if(JSON.stringify(A[i])!==JSON.stringify(B[i]))return`${i}:${hash(A[i])}/${hash(B[i])}`;return'none';
}
function assertStateEqual(a,b,label){const bad=diffState(a,b);assert.equal(bad.length,0,`${label}; divergências: ${bad.join(', ')}`)}

const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assertStateEqual(restored,original,'hidratação deve reproduzir exatamente o estado salvo');
const hiddenWorld=diffWorldInternals(restored,original);
assert.equal(hiddenWorld.length,0,`hidratação compacta diverge internamente antes do primeiro tick: ${hiddenWorld.join(', ')}`);
const hiddenNpc=diffNpcHidden(restored,original).filter(x=>!x.startsWith('animFrame:')&&!x.startsWith('animTimer:')&&!x.startsWith('moving:')&&!x.startsWith('prevX:')&&!x.startsWith('prevY:'));
assert.equal(hiddenNpc.length,0,`NPC operacional oculto diverge antes do primeiro tick: ${hiddenNpc.join(', ')}`);
for(let i=1;i<=72;i++){
 original.step();restored.step();
 const bad=diffState(restored,original);
 assert.equal(bad.length,0,`save/load divergiu no tick continuado ${i} (tick global ${original.tick}); ${bad.join(', ')}; npc=${firstNpcSerializedDiff(restored,original)}; world=${firstWorldDiff(restored,original)}; memory=${firstMemoryDiff(restored,original)}; perception=${firstPerceptionDiff(restored,original)}`);
}
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
