import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {MAP_W,MAP_H,RESOURCE} from '../src/core/constants.js';
const sim=new Simulation(42),n=sim.npcs,w=sim.world;
assert.equal(MAP_W,192);assert.equal(MAP_H,192);assert.equal(n.living().length,100,'Fase B deve iniciar com 100 pessoas');
assert.equal(w.buildings.length,0,'estado zero não possui construções');
assert.equal(Array.from(w.stock).reduce((a,b)=>a+b,0),0,'estado zero não possui estoque comunitário');
assert.equal(Array.from(w.tools).reduce((a,b)=>a+b,0),0,'estado zero não possui ferramentas prontas');
for(const i of n.living()){assert.equal(sim.technology.knownList(i).length,0,'ninguém nasce sabendo técnicas');assert.equal(sim.memory.spatial.get(i)?.count||0,0,'ninguém nasce conhecendo o mapa')}
for(let t=0;t<240;t++)sim.step();
assert.ok(Object.keys(sim.actionHistogram).length>0,'agentes devem começar a agir');
const data=sim.serialize();assert.equal(data.world.tiles,undefined);const restored=Simulation.hydrate(data);restored.step();assert.equal(restored.tick,sim.tick+1,'save/load deve continuar a simulação');
console.log(`OK v5: ${restored.npcs.living().length} vivos, ${restored.world.resources.length} nós, ${restored.world.dungeons.length} dungeons`);
