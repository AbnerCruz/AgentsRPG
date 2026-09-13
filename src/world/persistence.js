import {World} from './world.js';

const EPS=1e-5;

export function serializeWorldCompact(world){
 const data=world.serialize();
 const resourceDeltas=[];
 for(const r of world.resources){
  const durability=r.durability??1,maxDurability=r.maxDurability??1,work=r.workProgress||0;
  if(Math.abs((r.amount??0)-(r.max??0))>EPS||Math.abs(durability-maxDurability)>EPS||work>EPS){
   resourceDeltas.push([r.id,r.amount,durability,work]);
  }
 }
 delete data.resources;
 data.resourceDeltas=resourceDeltas;
 return data;
}

export function hydrateWorldCompact(data,rng,seed=1){
 const world=World.hydrate(data||{},rng,seed);
 if(!data?.resources&&Array.isArray(data?.resourceDeltas)){
  for(const row of data.resourceDeltas){
   const [id,amount,durability,workProgress]=row||[],r=world.resources[id];
   if(!r)continue;
   r.amount=Number.isFinite(amount)?amount:r.amount;
   r.durability=Number.isFinite(durability)?durability:r.durability;
   r.workProgress=Number.isFinite(workProgress)?workProgress:0;
  }
  world.rebuildResourceIndex();
 }
 return world;
}
