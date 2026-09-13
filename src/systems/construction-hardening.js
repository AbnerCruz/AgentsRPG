import {World} from '../world/world.js';
import {BUILDING} from '../core/constants.js';
import {ensureConstruction} from './construction.js';

// A physical shell becomes useful as soon as floor/walls/door/roof are complete.
// Furniture and work fixtures remain optional follow-up tasks and never block shelter.
if(!World.prototype.__phaseGShellHardening){
 const baseComplete=World.prototype.completePiece;
 World.prototype.completePiece=function(bp,p){
  const existing=bp?.shellBuildingId!=null?this.buildings.find(b=>b.id===bp.shellBuildingId):null;
  const before=this.buildings.length;
  let built=baseComplete.call(this,bp,p);
  if(!bp||bp.type==null||bp.type<0)return built;
  const shell=bp.pieces.filter(x=>x.layer!=='fixture');
  const shellReady=shell.length>0&&shell.every(x=>x.done);
  if(shellReady&&!bp.shellDone){
   bp.shellDone=true;
   if(built){bp.shellBuildingId=built.id}
   else{
    built=this.addBuilding(bp.type,bp.cx,bp.cy,false,bp.owner);
    built.finished=true;built.phaseG=true;built.group=bp.group;built.shellOnly=true;
    bp.shellBuildingId=built.id;
    const sim=this._constructionSim,idx=sim?.npcs?.indexByUid?.(bp.owner)??-1;
    if(sim)sim.log?.('construção',`${idx>=0?sim.npcs.names[idx]:'Um grupo'} fechou a estrutura de ${BUILDING.NAMES[bp.type]}.`,.78,idx);
   }
  }else if(existing&&built&&built.id!==existing.id){
   // The core completion path may create a second legacy building when the last
   // optional fixture finishes. Keep the shell building as the single identity.
   const duplicate=built;this.buildings=this.buildings.filter(b=>b!==duplicate);built=existing;
   existing.shellOnly=false;
  }
  if(bp.pieces.every(x=>x.done)&&bp.shellBuildingId!=null){const b=this.buildings.find(x=>x.id===bp.shellBuildingId);if(b)b.shellOnly=false}
  if(this.buildings.length>before+1)dedupeBuildings(this,bp);
  return built;
 };
 const baseTick=World.prototype.tick;
 World.prototype.tick=function(tick){const r=baseTick.call(this,tick);cleanupLegacyBlocks(this);return r};
 const baseHydrate=World.hydrate;
 World.hydrate=function(d,rng,seed=1){const w=baseHydrate.call(World,d,rng,seed);cleanupLegacyBlocks(w,true);repairShellLinks(w);return w};
 Object.defineProperty(World.prototype,'__phaseGShellHardening',{value:true});
}

function dedupeBuildings(w,bp){const matches=w.buildings.filter(b=>b.phaseG&&b.type===bp.type&&b.owner===bp.owner&&Math.hypot(b.x-bp.cx,b.y-bp.cy)<.1);if(matches.length<2)return;const keep=matches.find(b=>b.id===bp.shellBuildingId)||matches[0];w.buildings=w.buildings.filter(b=>!matches.includes(b)||b===keep);bp.shellBuildingId=keep.id}

function cleanupLegacyBlocks(w,force=false){
 if(w._phaseGLegacyCleaned&&!force)return;ensureConstruction(w);
 const phase=new Map();for(const b of w.blocks||[])if(b.phaseGId!=null)phase.set(`${b.x}:${b.y}:${b.type}`,b);
 if(phase.size)w.blocks=(w.blocks||[]).filter(b=>b.phaseGId!=null||!phase.has(`${b.x}:${b.y}:${b.type}`));
 w._phaseGLegacyCleaned=true;
}
function repairShellLinks(w){
 for(const bp of w.blueprints||[]){if(bp.type==null||bp.type<0)continue;const shell=bp.pieces?.filter(x=>x.layer!=='fixture')||[];if(!shell.length||!shell.every(x=>x.done))continue;bp.shellDone=true;const b=w.buildings.find(x=>x.phaseG&&x.type===bp.type&&x.owner===bp.owner&&Math.hypot(x.x-bp.cx,x.y-bp.cy)<.1);if(b)bp.shellBuildingId=b.id}
}
