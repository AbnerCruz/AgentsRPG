import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Simulation} from '../src/simulation.js';

const normalize=sim=>{const x=sim.serialize();delete x.savedAt;return x};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,12);
function assertStateEqual(a,b,label){
 const A=normalize(a),B=normalize(b),keys=[...new Set([...Object.keys(A),...Object.keys(B)])].sort(),bad=[];
 for(const k of keys)if(JSON.stringify(A[k])!==JSON.stringify(B[k]))bad.push(`${k}:${hash(A[k])}/${hash(B[k])}`);
 assert.equal(bad.length,0,`${label}; divergências: ${bad.join(', ')}`);
}

const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assertStateEqual(restored,original,'hidratação deve reproduzir exatamente o estado salvo');
for(let i=0;i<72;i++){original.step();restored.step()}
assertStateEqual(restored,original,'save/load deve continuar deterministicamente após novos ticks');
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
