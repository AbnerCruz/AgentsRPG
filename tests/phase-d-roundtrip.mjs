import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Simulation} from '../src/simulation.js';

const normalize=sim=>{const x=sim.serialize();delete x.savedAt;return x};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,12);
function diffState(a,b){
 const A=normalize(a),B=normalize(b),keys=[...new Set([...Object.keys(A),...Object.keys(B)])].sort(),bad=[];
 for(const k of keys)if(JSON.stringify(A[k])!==JSON.stringify(B[k]))bad.push(`${k}:${hash(A[k])}/${hash(B[k])}`);
 return bad;
}
function assertStateEqual(a,b,label){const bad=diffState(a,b);assert.equal(bad.length,0,`${label}; divergências: ${bad.join(', ')}`)}

const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assertStateEqual(restored,original,'hidratação deve reproduzir exatamente o estado salvo');
for(let i=1;i<=72;i++){
 original.step();restored.step();
 const bad=diffState(restored,original);
 assert.equal(bad.length,0,`save/load divergiu no tick continuado ${i} (tick global ${original.tick}); ${bad.join(', ')}`);
}
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
