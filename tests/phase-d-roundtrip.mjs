import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const normalize=sim=>{const x=sim.serialize();delete x.savedAt;return x};
const original=new Simulation(5150);
for(let i=0;i<48;i++)original.step();
const restored=Simulation.hydrate(original.serialize());
assert.deepEqual(normalize(restored),normalize(original),'hidratação deve reproduzir exatamente o estado salvo');
for(let i=0;i<72;i++){original.step();restored.step()}
assert.deepEqual(normalize(restored),normalize(original),'save/load deve continuar deterministicamente após novos ticks');
console.log('OK Phase D round-trip: save/hydrate preserva e continua o estado determinístico');
