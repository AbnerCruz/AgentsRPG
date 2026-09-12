import {Simulation} from '../src/simulation.js';
import {ACTION} from '../src/core/constants.js';
const s=new Simulation(7919);for(let i=0;i<200*240;i++)s.step();const all=s.metrics,water=all.byAction?.[ACTION.WATER]||{started:0,completed:0,abandoned:0};console.log({all:{started:all.travelStarted,completed:all.travelCompleted,abandoned:all.travelAbandoned,completionRate:(all.travelCompleted/Math.max(1,all.travelStarted)*100).toFixed(1)+'%'},water:{...water,completionRate:(water.completed/Math.max(1,water.started)*100).toFixed(1)+'%'}});
