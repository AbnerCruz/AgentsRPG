import {NEED,GENE,BUILDING} from '../core/constants.js';
import {isNight} from '../core/clock.js';
import {BALANCE} from '../calibration/balance.js';
import {survivalTick} from '../systems/survival.js';

export function updateNeeds(sim,i,threat=0){
 const n=sim.npcs,w=sim.world,g=x=>n.gene(i,x),need=x=>n.need(i,x),set=(x,v)=>n.setNeed(i,x,v),active=n.action[i]!=='dormir';
 set(NEED.HUNGER,need(NEED.HUNGER)+BALANCE.hungerRate*(.65+g(GENE.METABOLISM))*(active?1:.55));
 set(NEED.THIRST,need(NEED.THIRST)+BALANCE.thirstRate*(active?1:.52));
 set(NEED.SLEEP,need(NEED.SLEEP)+BALANCE.sleepRate*(active?1:-5));
 set(NEED.SAFETY,need(NEED.SAFETY)+threat*.012-(threat<.08?.0025:0));
 set(NEED.SOCIAL,need(NEED.SOCIAL)+.00034);
 set(NEED.PURPOSE,need(NEED.PURPOSE)+(n.action[i]==='observar'?.0007:-.00014));
 survivalTick(sim,i);
 if(need(NEED.HUNGER)>.96||need(NEED.THIRST)>.975)n.hp[i]=Math.max(0,n.hp[i]-BALANCE.starvationDamage);
 if(n.infection[i]>.6)n.hp[i]=Math.max(0,n.hp[i]-.0005*n.infection[i]);
 if(isNight(sim.tick)){const shelter=w.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER,3),fire=w.buildings.some(b=>b.finished&&b.type===BUILDING.CAMPFIRE&&b.lit&&Math.hypot(b.x-n.x[i],b.y-n.y[i])<5);if(!shelter&&!fire)set(NEED.SAFETY,need(NEED.SAFETY)+.00145);else if(fire)set(NEED.SAFETY,need(NEED.SAFETY)-.0011)}
}
