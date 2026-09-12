import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {GENE} from '../src/core/constants.js';
const seeds=[42,7919,1337,2026,9001,31415,2718,8080,123456,654321];
const days=300,results=[];
for(const seed of seeds){
 const sim=new Simulation(seed);let bossBy250=false;
 for(let i=0;i<days*240;i++){sim.step();if(i+1===250*240)bossBy250=!sim.dungeon.boss.alive}
 const live=sim.npcs.living();assert.ok(live.length>0,`seed ${seed} não pode extinguir em ${days} dias`);
 const temper=[GENE.AGGRESSION,GENE.CAUTION,GENE.AMBITION,GENE.EMPATHY];let geneStd=0;
 for(const g of temper){const vals=live.map(i=>sim.npcs.gene(i,g)),mean=vals.reduce((a,b)=>a+b,0)/vals.length;geneStd+=Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length)}geneStd/=temper.length;
 const restored=Simulation.hydrate(sim.serialize());restored.step();assert.equal(restored.tick,sim.tick+1,'save/load deve preservar o tick');
 results.push({seed,alive:live.length,bossBy250,deepest:sim.dungeon.deepest,geneStd,save:JSON.stringify(sim.serialize()).length,travel:sim.metrics});
}
const bossKills=results.filter(x=>x.bossBy250).length;assert.ok(bossKills>=4,`chefe deve morrer em >=40% das seeds até o dia 250; ocorreu ${bossKills}/${seeds.length}`);
const pops=results.map(x=>x.alive).sort((a,b)=>a-b),median=(pops[4]+pops[5])/2;assert.ok(median>=2&&median<=70,`mediana populacional fora do contrato: ${median}`);
const completion=results.reduce((s,x)=>s+x.travel.travelCompleted,0),started=results.reduce((s,x)=>s+x.travel.travelStarted,0);assert.ok(completion/Math.max(1,started)>.45,`viagens concluídas devem superar 45%; ${(completion/Math.max(1,started)*100).toFixed(1)}%`);
const avgStd=results.reduce((s,x)=>s+x.geneStd,0)/results.length;assert.ok(avgStd>.05,`variância genética caiu demais: ${avgStd.toFixed(3)}`);
console.table(results.map(({travel,...x})=>({...x,geneStd:+x.geneStd.toFixed(3),saveKB:+(x.save/1024).toFixed(1)})));
console.log(`OK: 0 extinções/10 em 300 dias; ${bossKills}/10 chefes mortos até D250; viagens ${(completion/started*100).toFixed(1)}%; gene σ ${avgStd.toFixed(3)}.`);
