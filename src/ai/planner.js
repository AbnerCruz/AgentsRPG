import {RESOURCE,ACTION,BUILDING} from '../core/constants.js';
const prereq={
 [ACTION.EAT]:[{test:(s,i)=>s.npcs.inventory[i][RESOURCE.FOOD]>.1||(s.world.stock[RESOURCE.FOOD]>.12&&s.world.nearBuilding(s.npcs.x[i],s.npcs.y[i],BUILDING.STORAGE,4)),action:ACTION.FORAGE}],
 [ACTION.DRINK]:[{test:(s,i)=>s.npcs.inventory[i][RESOURCE.WATER]>.08||(s.world.stock[RESOURCE.WATER]>.1&&s.world.nearBuilding(s.npcs.x[i],s.npcs.y[i],BUILDING.STORAGE,4)),action:ACTION.WATER}],
 [ACTION.IRON]:[{test:(s)=>s.world.buildings.some(b=>b.type===BUILDING.FORGE),action:ACTION.BUILD}],
 [ACTION.CRAFT]:[{test:(s)=>s.world.buildings.some(b=>b.type===BUILDING.FORGE),action:ACTION.BUILD}]
};
export function planFor(sim,i,goal){const chain=[goal],seen=new Set(chain);let current=goal;for(let depth=0;depth<5;depth++){const ps=prereq[current]||[];const miss=ps.find(p=>!p.test(sim,i));if(!miss||seen.has(miss.action))break;chain.unshift(miss.action);seen.add(miss.action);current=miss.action}return chain}
