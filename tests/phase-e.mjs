import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {AnimalSystem} from '../src/systems/animals.js';
import {perceive} from '../src/ai/perception.js';
import {scoreActions} from '../src/ai/utility.js';
import {DISEASES} from '../src/systems/disease.js';
import {ACTION,ANIMAL,ANIMAL_INFO,ANIMAL_STATE,BUILDING,DAY_TICKS,MAX_ANIMALS,RESOURCE} from '../src/core/constants.js';
import {RNG} from '../src/core/rng.js';

const sim=new Simulation(2026),animals=sim.animals,n=sim.npcs;
assert.ok(animals.species instanceof Uint8Array,'AnimalStore precisa usar TypedArrays');
assert.ok(animals.state instanceof Uint8Array&&animals.tameness instanceof Float32Array,'estado/mansidão precisam ser TypedArrays');
const initial=animals.liveCount();
assert.ok(initial>=600&&initial<=MAX_ANIMALS,`fauna inicial fora do orçamento: ${initial}`);
assert.ok(Object.keys(animals.populationBySpecies()).length>=14,'fauna precisa conter catálogo da Fase E');
assert.equal(ANIMAL_STATE.NAMES.length,7,'máquina de estados animal incompleta');

// Ecologia sem humanos: 300 dias de atualização agregada não pode esterilizar o mundo.
for(const i of n.living())n.alive[i]=0;
for(let d=0;d<300;d++){sim.tick+=DAY_TICKS;animals.regionalTick(sim)}
const after300=animals.liveCount();
assert.ok(after300>initial*.38,`ecossistema colapsou sem humanos: ${initial} -> ${after300}`);
assert.ok(after300<=MAX_ANIMALS,'ecossistema ultrapassou a capacidade global');
assert.ok(Object.values(animals.populationBySpecies()).filter(v=>v>0).length>=8,'diversidade ecológica colapsou');

// Recuperação: reduzir coelhos de uma região e verificar recolonização/reprodução.
let targetRegion=null;for(let ry=0;ry<12&&!targetRegion;ry++)for(let rx=0;rx<12&&!targetRegion;rx++){const ids=animals.livingIndices().filter(i=>animals.species[i]===ANIMAL.RABBIT&&Math.floor(animals.x[i]/16)===rx&&Math.floor(animals.y[i]/16)===ry);if(ids.length>=3)targetRegion={rx,ry,ids}}
if(targetRegion){const before=targetRegion.ids.length;for(const i of targetRegion.ids.slice(0,Math.max(1,Math.floor(before*.7))))animals.killIndex(i,'sobrecaça');animals.recountRegional();const low=animals.regionPop[animals.regionSpeciesIndex(targetRegion.rx,targetRegion.ry,ANIMAL.RABBIT)];for(let d=0;d<160;d++){sim.tick+=DAY_TICKS;animals.regionalTick(sim)}const recovered=animals.regionPop[animals.regionSpeciesIndex(targetRegion.rx,targetRegion.ry,ANIMAL.RABBIT)];assert.ok(recovered>low,`fauna local não se recuperou após sobrecaça: ${low} -> ${recovered}`)}

// Novo mundo para comportamento humano e caça/pesca sem técnica avançada.
const s2=new Simulation(7919),j=s2.npcs.living()[0];
const rabbit=s2.animals.spawn(ANIMAL.RABBIT,s2.npcs.x[j]+.8,s2.npcs.y[j],false,{age:1,tameness:.05});
let p=perceive(s2,j),scores=scoreActions(s2,j,p);assert.ok(scores.some(([a])=>a===ACTION.HUNT),'caça de pequeno porte precisa existir antes da técnica avançada');
const fish=s2.world.resources.find(r=>r.kind===RESOURCE.FISH);assert.ok(fish,'mundo precisa de peixe em rio/lago');s2.npcs.x[j]=fish.x+.4;s2.npcs.y[j]=fish.y+.4;p=perceive(s2,j);scores=scoreActions(s2,j,p);assert.ok(scores.some(([a])=>a===ACTION.FISH),'pesca manual precisa existir antes da técnica avançada');

// Culinária e alfaiataria deixam de ser skills mortas quando técnica/material estão presentes.
s2.technology.setKnown(s2.npcs,j,9,-1,s2.tick);s2.technology.setKnown(s2.npcs,j,20,-1,s2.tick);s2.npcs.inventory[j][RESOURCE.MEAT]=1;s2.npcs.inventory[j][RESOURCE.LEATHER]=1;const fire=s2.world.addBuilding(BUILDING.CAMPFIRE,s2.npcs.x[j],s2.npcs.y[j],true,s2.npcs.uid[j]);fire.lit=true;fire.fuel=180;p=perceive(s2,j);scores=scoreActions(s2,j,p);assert.ok(scores.some(([a,v])=>a===ACTION.COOK&&v>0),'culinária precisa ter utilidade real');assert.ok(scores.some(([a,v])=>a===ACTION.TAILOR&&v>0),'alfaiataria precisa ter utilidade real');

// Fogo afasta predador próximo.
const wolf=s2.animals.spawn(ANIMAL.WOLF,fire.x+3,fire.y,false,{age:3,hunger:.9});const wi=s2.animals.indexById(wolf.id);const d0=Math.hypot(s2.animals.x[wi]-fire.x,s2.animals.y[wi]-fire.y);s2.animals.individualTick(s2,wi,1);const d1=Math.hypot(s2.animals.x[wi]-fire.x,s2.animals.y[wi]-fire.y);assert.ok(d1>d0,'predador deve se afastar de fogueira acesa');

// Domesticação: seleção por mansidão + alimentação, não botão mágico.
s2.technology.setKnown(s2.npcs,j,17,-1,s2.tick);s2.npcs.inventory[j][RESOURCE.GRAIN]=2;const goat=s2.animals.spawn(ANIMAL.GOAT,s2.npcs.x[j]+1,s2.npcs.y[j],false,{age:1,tameness:.71,captive:true});s2.animals.domesticationTick(s2);assert.equal(goat.domestic,true,'animal cativo/alimentado e manso deve cruzar limiar de domesticação');assert.ok(s2.animals.domesticationStats().domesticTameness>s2.animals.domesticationStats().wildTameness,'mansidão doméstica deve divergir da selvagem');

assert.equal(DISEASES[4]?.key,'zoonosis','zoonose precisa integrar o sistema de doenças');assert.equal(DISEASES[4]?.immune,true,'zoonose precisa produzir imunidade nos sobreviventes');

// Persistência: formato compacto deve restaurar população e mansidão sem trocar a arquitetura.
const saved=s2.animals.serialize(),restored=AnimalSystem.hydrate(JSON.parse(JSON.stringify(saved)),new RNG(99),s2.world);assert.equal(restored.liveCount(),s2.animals.liveCount(),'round-trip da fauna perdeu indivíduos');assert.ok(restored.species instanceof Uint8Array,'hydrate precisa preservar TypedArrays');assert.equal(restored.byId(goat.id)?.domestic,true,'domesticação deve sobreviver ao save/load');

console.log(`OK Phase E: fauna ${initial} -> ${after300}; TypedArrays, ecologia, caça/pesca, domesticação, fogo e zoonose ativos`);
