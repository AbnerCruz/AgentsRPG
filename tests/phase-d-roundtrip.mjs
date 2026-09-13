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
function npcSnapshot(sim,i){const n=sim.npcs;return{uid:n.uid[i],x:n.x[i],y:n.y[i],state:n.state[i],action:n.action[i],taskKind:n.taskKind[i],targetX:n.taskTargetX[i],targetY:n.taskTargetY[i],targetRef:n.taskTargetRef[i],progress:n.taskProgress[i],duration:n.taskDuration[i],timeout:n.taskTimeout[i],pathIndex:n.pathIndex[i],facing:n.facing[i],route:n.getRoute(i)?Array.from(n.getRoute(i)):null,intent:n.intent[i]};}
function firstPhysicalNpcDiff(a,b){for(let i=0;i<Math.max(a.npcs.count,b.npcs.count);i++){const A=npcSnapshot(a,i),B=npcSnapshot(b,i);if(JSON.stringify(A)!==JSON.stringify(B))return`${i}:${JSON.stringify(A)}/${JSON.stringify(B)}`}return'none'}
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
 const A=a.lastPerception,B=b.lastPerception;for(let i=0;i<Math.max(A.length,B.length);i++)if(JSON.stringify(A[i])!==JSON.stringify(B[i]))return`${i}:${JSON.stringify(A[i])}/${JSON.stringify(B[i])}`;return'none';
}
function assertStateEqual(a,b,label){const bad=diffState(a,b);assert.equal(bad.length,0,`${label}; divergências: ${bad.join(', ')}`)}

const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assertStateEqual(restored,original,'hidratação deve reproduzir exatamente o estado salvo');
const hiddenWorld=diffWorldInternals(restored,original);
assert.equal(hiddenWorld.length,0,`hidratação compacta diverge internamente antes do primeiro tick: ${hiddenWorld.join(', ')}`);
// plan/scores/animation are derived presentation state; behavior must not depend on them.
for(let i=1;i<=72;i++){
 original.step();restored.step();
 const bad=diffState(restored,original);
 assert.equal(bad.length,0,`save/load divergiu no tick continuado ${i} (tick global ${original.tick}); ${bad.join(', ')}; npc=${firstNpcSerializedDiff(restored,original)}; físico=${firstPhysicalNpcDiff(restored,original)}; world=${firstWorldDiff(restored,original)}; memory=${firstMemoryDiff(restored,original)}; perception=${firstPerceptionDiff(restored,original)}`);
}
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
