import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
const sim=new Simulation(31415),n=sim.npcs;const c=n.child(sim.rng,0,1,sim.tick);assert.ok(c>=0);sim.memory.ensure(c,sim.memory.spatialCapacity(n,c));assert.equal(sim.memory.spatial.get(c).count,0,'recém-nascido não deve nascer conhecendo o mapa');for(let k=0;k<30;k++)sim.step();assert.ok(sim.memory.spatial.get(c).count>0,'o mapa mental deve ser aprendido por percepção/transmissão');console.log('OK perception: conhecimento começa vazio e é adquirido');
