import assert from 'node:assert/strict';
import {createNewSimulation} from '../src/simulation-factory.js';
import {Simulation} from '../src/simulation.js';
import {ACTION,TOOL} from '../src/core/constants.js';

const sim=createNewSimulation(42,null);
assert.equal(sim.npcs.living().length,100,'Fase B/C deve iniciar com 100 pessoas');
assert.ok(sim.technology,'technology precisa existir em mundo novo');
assert.ok(sim.senses,'senses precisa existir em mundo novo');
assert.equal(sim.world.buildings.length,0,'estado zero não deve ter vila pronta');
for(const i of sim.npcs.living()){
 assert.equal(sim.npcs.tool[i],TOOL.NONE,'estado zero não deve entregar ferramentas');
 assert.equal(sim.technology.knownList(i).length,0,'técnicas devem começar vazias');
 assert.equal(sim.memory.spatial.get(i)?.count||0,0,'mapa mental deve começar sem marcos');
}
assert.equal(sim.technology.canAction(0,ACTION.DRINK),true,'sobrevivência básica não exige técnica');
assert.equal(sim.technology.canAction(0,ACTION.WOOD),false,'cortar madeira exige técnica');
for(let t=0;t<240;t++)sim.step();
assert.equal(sim.npcs.living().length>0,true,'simulação deve continuar executando');
const save=sim.serialize();
assert.ok(save.technology,'técnicas precisam ir para o save');
const restored=Simulation.hydrate(save);
assert.ok(restored.technology,'hydrate precisa restaurar technology');
assert.equal(restored.npcs.living().length,sim.npcs.living().length,'hydrate deve preservar população');
restored.step();
console.log('OK Phase C: estado zero, gate de técnicas, boot, save e hydrate');
