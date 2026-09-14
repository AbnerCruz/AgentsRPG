import {World} from '../world/world.js';
import {ACTION,BUILDING,RESOURCE,BLOCK,TOOL} from '../core/constants.js';
import {ensureConstruction,PIECE,MATERIAL,groupForNpc} from './construction.js';
import {technologyFor} from './technology.js';

// A physical shell becomes useful as soon as floor/walls/door/roof are complete.
// Furniture and work fixtures remain optional follow-up tasks and never block shelter.
if(!World.prototype.__phaseGShellHardening){
 const baseCreate=World.prototype.createBlueprint;
 World.prototype.createBlueprint=function(type,cx,cy,owner=-1){
  ensureConstruction(this);const sim=this._constructionSim,n=sim?.npcs,oi=n?.indexByUid?.(owner)??-1;
  if(sim&&oi>=0){
   const group=groupForNpc(sim,oi),active=this.blueprints.some(b=>!b.done&&!b.abandoned&&!b.shellDone&&b.repairTarget==null&&b.group===group);
   if(active)return null;
   const autonomous=n.action?.[oi]===ACTION.BUILD;if(autonomous)type=nextGroupProjectType(sim,oi,group);
   const bp=baseCreate.call(this,type,cx,cy,owner);
   if(bp&&autonomous&&type===BUILDING.SHELTER&&!technologyFor(sim).knows(n,oi,8))makePrimitiveShelter(bp);
   return bp;
  }
  return baseCreate.call(this,type,cx,cy,owner);
 };
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
   if(built)built.primitive=!!bp.primitive;
  }else if(existing&&built&&built.id!==existing.id){
   // The core completion path may create a second legacy building when the last
   // optional fixture finishes. Keep the shell building as the single identity.
   const duplicate=built;this.buildings=this.buildings.filter(b=>b!==duplicate);built=existing;
   existing.shellOnly=false;
  }
  if(bp.pieces.every(x=>x.done)&&bp.shellBuildingId!=null){const b=this.buildings.find(x=>x.id===bp.shellBuildingId);if(b){b.shellOnly=false;if(bp.primitive)b.primitive=true}}
  if(this.buildings.length>before+1)dedupeBuildings(this,bp);
  return built;
 };
 const baseTick=World.prototype.tick;
 World.prototype.tick=function(tick){const r=baseTick.call(this,tick);cleanupLegacyBlocks(this);return r};
 const baseHydrate=World.hydrate;
 World.hydrate=function(d,rng,seed=1){const w=baseHydrate.call(World,d,rng,seed);cleanupLegacyBlocks(w,true);repairShellLinks(w);return w};
 Object.defineProperty(World.prototype,'__phaseGShellHardening',{value:true});
}

function nextGroupProjectType(sim,i,group){
 const w=sim.world,n=sim.npcs,t=technologyFor(sim),sameGroup=x=>x?.group===group||(x?.owner>0&&(()=>{const j=n.indexByUid(x.owner);return j>=0&&groupForNpc(sim,j)===group})()),has=type=>w.buildings.some(b=>b.finished&&b.type===type&&sameGroup(b))||w.blueprints.some(b=>!b.abandoned&&b.type===type&&sameGroup(b)&&(!b.done||b.shellDone));
 if(t.knows(n,i,3)&&!has(BUILDING.CAMPFIRE))return BUILDING.CAMPFIRE;
 if(!has(BUILDING.SHELTER))return BUILDING.SHELTER;
 if(t.knows(n,i,16)&&!has(BUILDING.FARM))return BUILDING.FARM;
 if(t.knows(n,i,24)&&!has(BUILDING.FORGE))return BUILDING.FORGE;
 if(t.knows(n,i,20)&&!has(BUILDING.WORKSHOP))return BUILDING.WORKSHOP;
 return BUILDING.STORAGE;
}

function makePrimitiveShelter(bp){
 const piece=(dx,dy,pieceType,cost,work,block)=>({x:bp.cx+dx,y:bp.cy+dy,block,pieceType,material:RESOURCE.LOG,cost,tool:TOOL.NONE,tech:1,work,materialStyle:MATERIAL.WOOD,layer:'ground',progress:0,done:false,reserved:false,ownerUid:bp.owner,group:bp.group,repairId:null});
 bp.style=MATERIAL.WOOD;bp.primitive=true;bp.pieces=[
  piece(0,0,PIECE.FLOOR,.06,8,BLOCK.FLOOR),piece(0,1,PIECE.FLOOR,.06,8,BLOCK.FLOOR),
  piece(-1,0,PIECE.BRANCH_SHELTER,.12,12,BLOCK.WALL),piece(1,0,PIECE.BRANCH_SHELTER,.12,12,BLOCK.WALL),
  piece(-1,1,PIECE.BRANCH_SHELTER,.12,12,BLOCK.WALL),piece(1,1,PIECE.BRANCH_SHELTER,.12,12,BLOCK.WALL)
 ];
}

function dedupeBuildings(w,bp){const matches=w.buildings.filter(b=>b.phaseG&&b.type===bp.type&&b.owner===bp.owner&&Math.hypot(b.x-bp.cx,b.y-bp.cy)<.1);if(matches.length<2)return;const keep=matches.find(b=>b.id===bp.shellBuildingId)||matches[0];w.buildings=w.buildings.filter(b=>!matches.includes(b)||b===keep);bp.shellBuildingId=keep.id}

function cleanupLegacyBlocks(w,force=false){
 if(w._phaseGLegacyCleaned&&!force)return;ensureConstruction(w);
 const phase=new Map();for(const b of w.blocks||[])if(b.phaseGId!=null)phase.set(`${b.x}:${b.y}:${b.type}`,b);
 if(phase.size)w.blocks=(w.blocks||[]).filter(b=>b.phaseGId!=null||!phase.has(`${b.x}:${b.y}:${b.type}`));
 w._phaseGLegacyCleaned=true;
}
function repairShellLinks(w){
 for(const bp of w.blueprints||[]){if(bp.type==null||bp.type<0)continue;const shell=bp.pieces?.filter(x=>x.layer!=='fixture')||[];if(!shell.length||!shell.every(x=>x.done))continue;bp.shellDone=true;const b=w.buildings.find(x=>x.phaseG&&x.type===bp.type&&x.owner===bp.owner&&Math.hypot(x.x-bp.cx,x.y-bp.cy)<.1);if(b){bp.shellBuildingId=b.id;if(bp.primitive)b.primitive=true}}
}
