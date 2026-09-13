import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DAY_TICKS,ACTION} from '../src/core/constants.js';
const sim=new Simulation(42);let maxMove=0;for(let t=0;t<DAY_TICKS*35;t++){const before=sim.npcs.living().map(i=>[i,sim.npcs.x[i],sim.npcs.y[i]]);sim.step();for(const[i,x,y]of before)if(sim.npcs.alive[i])maxMove=Math.max(maxMove,Math.hypot(sim.npcs.x[i]-x,sim.npcs.y[i]-y))}
assert.equal(sim.world.dungeons.length,6,'v3 deve gerar múltiplas dungeons');
assert.ok(sim.npcs.living().length>=5,'a comunidade deve sobreviver aos primeiros 35 dias');
assert.ok(maxMove<.2,'movimento por tick deve ser contínuo, não teletransporte');
assert.ok((sim.actionHistogram[ACTION.WOOD]||0)>0,'madeira precisa ser uma atividade real');
assert.ok((sim.actionHistogram[ACTION.FARM]||0)>0,'agricultura precisa acontecer');
assert.ok(sim.world.blueprints.length>0,'construção deve usar blueprints');
assert.ok(sim.animals.items.some(a=>a.alive),'fauna deve existir');
assert.ok(sim.memory.spatial.size>0,'NPCs devem formar mapas mentais');
const restored=Simulation.hydrate(sim.serialize());restored.step();assert.equal(restored.tick,sim.tick+1,'save/load deve preservar a simulação');
console.log(`OK v3: dia ${restored.meta().day}, ${restored.npcs.living().length} vivos, ${restored.world.buildings.length} estruturas, ${restored.animals.items.filter(a=>a.alive).length} animais`);
