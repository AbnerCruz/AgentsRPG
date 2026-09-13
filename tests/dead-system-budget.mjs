import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,DAY_TICKS,NEED} from '../src/core/constants.js';
import {scoreActions} from '../src/ai/utility.js';

const sim=new Simulation(7070),days=40,total=days*DAY_TICKS;
// This is a systems test, not a near-camera animation test. Keep every NPC in
// analytic LOD so 40 simulated days stay cheap while decisions/needs/memory/
// construction still execute through the real Simulation.step() path.
sim.viewX=-999;sim.viewY=-999;
const needPeak=new Float64Array(NEED.COUNT),actions=[ACTION.SLEEP,ACTION.WARM,ACTION.RETURN,ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.BUILD,ACTION.EXPLORE,ACTION.SOCIAL],scorePeak=Object.fromEntries(actions.map(a=>[a,0]));
for(let t=0;t<total;t++){
 sim.step();
 if(sim.tick<DAY_TICKS*5||sim.tick%280!==0)continue;
 const living=sim.npcs.living();for(const i of living)for(let k=0;k<NEED.COUNT;k++)needPeak[k]=Math.max(needPeak[k],sim.npcs.need(i,k));
 for(const i of living.slice(0,12)){const scores=scoreActions(sim,i,sim.lastPerception[i]||{});for(const [a,v] of scores)if(a in scorePeak)scorePeak[a]=Math.max(scorePeak[a],v||0)}
}
const living=sim.npcs.living();assert.ok(living.length>0,'simulação extinguiu antes do orçamento de 40 dias');
assert.ok(sim.world.buildings.some(b=>b.finished),'40 dias sem nenhuma world.buildings.finished indica ciclo de construção quebrado');
assert.ok(needPeak[NEED.SAFETY]>.08,`SAFETY permaneceu inerte: pico ${needPeak[NEED.SAFETY].toFixed(3)}`);
assert.ok(needPeak[NEED.PURPOSE]>.08,`PURPOSE permaneceu inerte: pico ${needPeak[NEED.PURPOSE].toFixed(3)}`);
for(const a of actions)assert.ok(scorePeak[a]>0,`${a} teve pontuação máxima zero durante 35 dias observados`);
console.log(`OK dead-system budget: ${living.length} vivos, ${sim.world.buildings.filter(b=>b.finished).length} construções, SAFETY ${needPeak[NEED.SAFETY].toFixed(2)}, PURPOSE ${needPeak[NEED.PURPOSE].toFixed(2)}`);
