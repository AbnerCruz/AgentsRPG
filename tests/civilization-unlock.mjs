import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RESOURCE,ACTION} from '../src/core/constants.js';
import {blockedMaterialPressure} from '../src/ai/utility.js';
import {serializeTaskPlanning,hydrateTaskPlanning} from '../src/systems/task-planning.js';

const seeds=[42,7919,1337,9001,2026,555];let pebbleCount=0,worst=0;
for(const seed of seeds){
 const sim=new Simulation(seed),w=sim.world;
 for(const s of w.spawnSeeds){const stones=w.resources.filter(r=>r.kind===RESOURCE.STONE&&r.amount>.01),d=Math.min(...stones.map(r=>Math.hypot(r.x-s.x,r.y-s.y)));worst=Math.max(worst,d);assert.ok(d<=9,`seed ${seed}: origem humana ficou ${d.toFixed(1)} tiles da pedra`)}
 for(const r of w.resources)if(r.pebble){pebbleCount++;assert.equal(r.regen,0,'seixo mineral não deve regenerar');assert.ok(r.max<=1.81,'depósito de margem deve permanecer pequeno')}
}
assert.ok(pebbleCount>0,'garantia de margem precisa ser exercitada nas seeds de contrato');

const sim=new Simulation(606060),n=sim.npcs,i=n.living().find(x=>n.age[x]>=16)??n.living()[0];n.inventory[i][RESOURCE.STONE]=0;const before=blockedMaterialPressure(sim,i);n.inventory[i][RESOURCE.STONE]=1;const after=blockedMaterialPressure(sim,i);assert.ok(before>after+.3,`pedra desconhecida precisa pressionar exploração: ${before} -> ${after}`);

sim.pendingGoals[i]=ACTION.EXPLORE;const packed=serializeTaskPlanning(sim),restored=new Simulation(606061);hydrateTaskPlanning(restored,JSON.parse(JSON.stringify(packed)));assert.equal(restored.pendingGoals[i],ACTION.EXPLORE,'objetivo após preparo precisa sobreviver ao save/load');
console.log(`OK civilization unlock: ${seeds.length} seeds, ${pebbleCount} depósitos de margem, pior distância ${worst.toFixed(1)}, pressão ${before.toFixed(2)} -> ${after.toFixed(2)}`);
