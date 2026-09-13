import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const sim=new Simulation(4242);
for(let t=0;t<1680;t++)sim.step();
const started=sim.tasks.byAction||{},failed=sim.tasks.failedByAction||{},violations=[];
for(const [action,count] of Object.entries(started)){
 if(count<40)continue;const rate=(failed[action]||0)/count;if(rate>.75)violations.push({action,count,failed:failed[action]||0,rate});
}
assert.equal(violations.length,0,`ações com falha excessiva: ${violations.map(v=>`${v.action} ${(v.rate*100).toFixed(1)}% (${v.failed}/${v.count})`).join(', ')}`);
console.log(`OK failure-rate budget: ${Object.keys(started).length} ações observadas, nenhuma acima de 75% com >=40 tentativas`);
