import {World} from '../world/world.js';
import {BUILDING} from '../core/constants.js';
import './construction.js';

// Reconcile the semantic building identity with the physical Phase G shell.
// Older/broken saves may contain a completed blueprint/piece shell while
// world.buildings is empty. The pieces remain authoritative; this only restores
// the lightweight building record consumed by shelter/fire/farm systems.
if(!World.prototype.__realityReconciliationInstalled){
 const baseComplete=World.prototype.completePiece;
 World.prototype.completePiece=function(bp,p){
  const built=baseComplete.call(this,bp,p);
  return built||ensureBlueprintBuilding(this,bp);
 };
 const baseHydrate=World.hydrate;
 World.hydrate=function(d,rng,seed=1){
  const w=baseHydrate.call(World,d,rng,seed);
  reconcileBlueprintBuildings(w);
  return w;
 };
 Object.defineProperty(World.prototype,'__realityReconciliationInstalled',{value:true});
}

export function reconcileBlueprintBuildings(w){
 for(const bp of w.blueprints||[])ensureBlueprintBuilding(w,bp);
 return w.buildings?.length||0;
}

function ensureBlueprintBuilding(w,bp){
 if(!bp||bp.type==null||bp.type<0)return null;
 const pieces=bp.pieces||[];
 const shell=pieces.filter(p=>p.layer!=='fixture');
 const shellReady=shell.length>0&&shell.every(p=>p.done);
 const complete=!!bp.done||(pieces.length>0&&pieces.every(p=>p.done));
 if(!shellReady&&!complete)return null;
 let b=(w.buildings||[]).find(x=>x.finished&&x.type===bp.type&&x.owner===bp.owner&&Math.hypot(x.x-bp.cx,x.y-bp.cy)<.25);
 if(!b){
  b=w.addBuilding(bp.type,bp.cx,bp.cy,false,bp.owner);
  b.finished=true;
  b.phaseG=true;
  b.group=bp.group;
  b.shellOnly=!complete;
 }
 bp.shellDone=shellReady||complete;
 bp.shellBuildingId=b.id;
 if(complete)b.shellOnly=false;
 return b;
}
