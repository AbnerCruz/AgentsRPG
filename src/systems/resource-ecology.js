import {World} from '../world/world.js';
import {AnimalSystem} from './animals.js';
import {RESOURCE,DAY_TICKS} from '../core/constants.js';
import {season} from '../core/clock.js';

const REFILL_DAYS={
 [RESOURCE.BERRY]:14,
 [RESOURCE.LOG]:90,
 [RESOURCE.CLAY]:45
};
const FISH_REFILL_DAYS=18;
const SEASONAL_FISH={primavera:1.3,verão:1.05,outono:.9,inverno:.48};

function rateFor(r){const days=REFILL_DAYS[r.kind];if(days)return r.max/(days*DAY_TICKS);if(r.kind===RESOURCE.WATER)return r.max/DAY_TICKS;if([RESOURCE.STONE,RESOURCE.IRON,RESOURCE.SALT].includes(r.kind))return 0;return r.regen||0}
function normalizeRates(w,{newWorld=false}={}){for(const r of w.resources||[]){if(r.kind===RESOURCE.FISH){if(newWorld&&!Number.isFinite(r.fishBaseMax)){r.fishBaseMax=r.max;r.max=r.fishBaseMax*SEASONAL_FISH.primavera;r.amount=Math.min(r.max,r.amount*SEASONAL_FISH.primavera)}r.regenDays=FISH_REFILL_DAYS;r.regen=r.max/(FISH_REFILL_DAYS*DAY_TICKS);continue}const days=REFILL_DAYS[r.kind];if(days)r.regenDays=days;else if([RESOURCE.STONE,RESOURCE.IRON,RESOURCE.SALT].includes(r.kind))r.regenDays=0;r.regen=rateFor(r)}}

if(!World.prototype.__dailyResourceRecoveryInstalled){
 const basePlace=World.prototype.placeResources,baseHydrate=World.hydrate;
 World.prototype.placeResources=function(){basePlace.call(this);normalizeRates(this,{newWorld:true})};
 World.hydrate=function(d,rng,seed=1){const w=baseHydrate.call(World,d,rng,seed);normalizeRates(w,{newWorld:false});return w};
 Object.defineProperty(World.prototype,'__dailyResourceRecoveryInstalled',{value:true});
}

if(!AnimalSystem.prototype.__dailyFishRecoveryInstalled){
 AnimalSystem.prototype.updateFish=function(sim){const mult=SEASONAL_FISH[season(sim.tick)]??1;for(const r of sim.world.resources)if(r.kind===RESOURCE.FISH){if(!Number.isFinite(r.fishBaseMax))r.fishBaseMax=r.max/Math.max(.01,mult);r.max=Math.max(.6,r.fishBaseMax*mult);r.regenDays=FISH_REFILL_DAYS;r.regen=r.max/(FISH_REFILL_DAYS*DAY_TICKS);if(r.amount>r.max)r.amount=r.max}};
 Object.defineProperty(AnimalSystem.prototype,'__dailyFishRecoveryInstalled',{value:true});
}

export function resourceRecoveryProfile(world){const out={};for(const r of world.resources||[]){if(!out[r.kind])out[r.kind]={count:0,regenPerDay:0,max:0};const x=out[r.kind];x.count++;x.regenPerDay+=r.regen*DAY_TICKS;x.max+=r.max}return out}
