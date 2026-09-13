import assert from 'node:assert/strict';
import {createNewSimulation} from '../src/simulation-factory.js';
import {Simulation} from '../src/simulation.js';
import {ACTION,TOOL,RESOURCE,NEED} from '../src/core/constants.js';

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
assert.equal(save.world.resources,undefined,'recursos determinísticos não devem ser serializados por inteiro');
assert.ok(Array.isArray(save.world.resourceDeltas),'save deve guardar apenas divergências dos recursos');
assert.ok(save.world.resourceDeltas.length<sim.world.resources.length/4,'deltas de recurso devem ser muito menores que a base regenerável');
assert.ok(JSON.stringify(save).length<1_200_000,'save inicial deve permanecer adequado para IndexedDB mobile');
const restored=Simulation.hydrate(save);
assert.ok(restored.technology,'hydrate precisa restaurar technology');
assert.equal(restored.npcs.living().length,sim.npcs.living().length,'hydrate deve preservar população');
restored.step();

const discovery=createNewSimulation(77,null),i=discovery.npcs.living()[0],rock=discovery.world.resources.find(r=>r.kind===RESOURCE.STONE);
assert.ok(rock,'mundo deve possuir pedra para experimento raiz');
discovery.npcs.x[i]=rock.x;discovery.npcs.y[i]=rock.y;discovery.npcs.age[i]=24;discovery.npcs.setNeed(i,NEED.HUNGER,.1);discovery.npcs.setNeed(i,NEED.THIRST,.1);
const originalChance=discovery.rng.chance.bind(discovery.rng);discovery.rng.chance=()=>true;
for(let a=1;a<=5&&!discovery.technology.knows(discovery.npcs,i,0);a++){discovery.tick=a*45;discovery.technology.experiment(discovery,i)}
discovery.rng.chance=originalChance;
assert.equal(discovery.technology.knows(discovery.npcs,i,0),true,'progresso focado deve permitir descobrir a técnica raiz de pedra');

const disease=createNewSimulation(91,null),d=disease.npcs.living()[0];disease.npcs.activeDisease[d]=1;disease.npcs.diseaseTimer[d]=0;disease.step();assert.equal(disease.npcs.diseaseTimer[d],1,'doença deve avançar uma única vez por tick');
console.log('OK Phase C: estado zero, descoberta focada, doença única, save compacto e hydrate');
