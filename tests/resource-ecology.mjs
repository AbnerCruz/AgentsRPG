import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {RESOURCE,DAY_TICKS} from '../src/core/constants.js';

const sim=new Simulation(515151),w=sim.world;
const one=k=>w.resources.find(r=>r.kind===k);
const berry=one(RESOURCE.BERRY),log=one(RESOURCE.LOG),stone=one(RESOURCE.STONE),iron=one(RESOURCE.IRON),fish=one(RESOURCE.FISH);
assert.ok(berry&&log&&stone&&iron&&fish,'seed precisa expor os recursos do contrato');
const close=(a,b,t=.00001)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(b));
assert.ok(close(berry.regen*DAY_TICKS,berry.max/14),'frutas devem repor capacidade em ~14 dias');
assert.ok(close(log.regen*DAY_TICKS,log.max/90),'toras devem repor capacidade em ~uma estação longa');
assert.equal(stone.regen,0,'pedra não regenera');assert.equal(iron.regen,0,'ferro não regenera');
const max0=fish.max,amount0=fish.amount;sim.animals.updateFish(sim);assert.ok(close(fish.max,max0),'capacidade de peixe não pode saltar no primeiro dia');assert.ok(fish.amount<=fish.max&&fish.amount<=Math.max(amount0,fish.max),'quantidade de peixe deve respeitar capacidade');assert.ok(close(fish.regen*DAY_TICKS,fish.max/18),'peixe deve usar reposição expressa por dia');
console.log(`OK resource ecology: frutas 14d, toras 90d, minério 0, peixe estável ${max0.toFixed(2)}`);
