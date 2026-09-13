import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DAY_TICKS,ACTION} from '../src/core/constants.js';
const sim=new Simulation(7919);for(let i=0;i<DAY_TICKS*60;i++)sim.step();const started=sim.travel.byAction[ACTION.WATER]||0,done=sim.travel.completedByAction[ACTION.WATER]||0,ratio=started?done/started:1;assert.ok(started>5,'o teste precisa observar viagens de água');assert.ok(ratio>.55,`viagens de água concluídas: ${(ratio*100).toFixed(1)}%`);assert.ok((sim.actionHistogram[ACTION.WOOD]||0)>0,'lenha não pode voltar a zero');console.log(`OK travel: água ${(ratio*100).toFixed(1)}% (${done}/${started}), geral ${(sim.travel.completed/Math.max(1,sim.travel.started)*100).toFixed(1)}%`);
