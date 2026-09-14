import {NEED,GENE,BUILDING,ACTION} from '../core/constants.js';
import {isNight} from '../core/clock.js';
import {BALANCE} from '../calibration/balance.js';
import {survivalTick} from '../systems/survival.js';

export function updateNeeds(sim,i,threat=0){
 const n=sim.npcs,w=sim.world,g=x=>n.gene(i,x),need=x=>n.need(i,x),set=(x,v)=>n.setNeed(i,x,v),active=n.action[i]!==ACTION.SLEEP;
 set(NEED.HUNGER,need(NEED.HUNGER)+BALANCE.hungerRate*(.65+g(GENE.METABOLISM))*(active?1:.55));
 set(NEED.THIRST,need(NEED.THIRST)+BALANCE.thirstRate*(active?1:.52));
 set(NEED.SLEEP,need(NEED.SLEEP)+BALANCE.sleepRate*(active?1:-5));
 const night=isNight(sim.tick),shelter=w.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER,3),fire=w.buildings.some(b=>b.finished&&b.type===BUILDING.CAMPFIRE&&b.lit&&Math.hypot(b.x-n.x[i],b.y-n.y[i])<5);let safetyDelta=threat*.012;if(night&&!shelter&&!fire)safetyDelta+=.0032;else if(threat<.08&&(shelter||fire))safetyDelta-=.0018;if(fire)safetyDelta-=.0007;set(NEED.SAFETY,need(NEED.SAFETY)+safetyDelta);
 set(NEED.SOCIAL,need(NEED.SOCIAL)+.00034);
 const idle=!n.intent[i]||n.action[i]===ACTION.IDLE,meaningful=n.action[i]===ACTION.EXPLORE||n.action[i]===ACTION.BUILD||n.action[i]===ACTION.TEACH||n.action[i]===ACTION.DUNGEON;set(NEED.PURPOSE,need(NEED.PURPOSE)+(idle?.0007:meaningful?-.00022:.00005));
 survivalTick(sim,i);
 if(need(NEED.HUNGER)>.96||need(NEED.THIRST)>.975)n.hp[i]=Math.max(0,n.hp[i]-BALANCE.starvationDamage);
 if(n.infection[i]>.6)n.hp[i]=Math.max(0,n.hp[i]-.0005*n.infection[i]);
}
