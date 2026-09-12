import {RESOURCE,ACTION} from '../core/constants.js';
const prereq={
 [ACTION.EAT]:[{test:(s,i)=>s.npcs.inventory[i][RESOURCE.FOOD]>.2,action:ACTION.FORAGE}],
 [ACTION.IRON]:[{test:(s)=>s.world.buildings.some(b=>b.type===2),action:ACTION.BUILD}],
 [ACTION.DUNGEON]:[{test:(s,i)=>s.npcs.prof[i]===5||s.npcs.skill(i,10)>.2,action:ACTION.FIGHT}]
};
export function planFor(sim,i,goal){const chain=[goal],seen=new Set(chain);let current=goal;for(let depth=0;depth<5;depth++){const ps=prereq[current]||[];const miss=ps.find(p=>!p.test(sim,i));if(!miss)break;if(seen.has(miss.action))break;chain.unshift(miss.action);seen.add(miss.action);current=miss.action}return chain}
