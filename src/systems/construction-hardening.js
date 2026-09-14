import {World} from '../world/world.js';
import {BUILDING} from '../core/constants.js';
import {ensureConstruction,PIECE,placementPreservesAccess} from './construction.js';
import {technologyFor} from './technology.js';

const COMMUNITY_RADIUS=40;

// Harden Phase G without replacing the construction core: the first shelter is a
// genuinely primitive shell, nearby people converge on the same oldest project,
// and new sites are capped while a community already has work in progress.
if(!World.prototype.__phaseGShellHardening){
 const baseCreate=World.prototype.createBlueprint,baseNext=World.prototype.nextBlueprintPiece,baseComplete=World.prototype.completePiece;
 World.prototype.createBlueprint=function(type,cx,cy,owner=-1){
  ensureConstruction(this);
  if(type>=0&&owner>0&&this._constructionSim){const active=communityProjects(this,owner);const cap=communityHasShelter(this,owner)?2:1;if(active.length>=cap)return null}
  const bp=baseCreate.call(this,type,cx,cy,owner);
  if(bp&&type===BUILDING.SHELTER&&owner>0&&!communityHasShelter(this,owner))makePrimitiveShelter(bp);
  return bp;
 };
 World.prototype.nextBlueprintPiece=function(ownerUid=null){
  const own=baseNext.call(this,ownerUid),shared=bestCommunityTask(this,ownerUid);
  if(!shared)return own;if(!own)return shared;
  return taskPriority(this,ownerUid,shared)>taskPriority(this,ownerUid,own)?shared:own;
 };
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

function communityAnchor(w,ownerUid){const sim=w._constructionSim,n=sim?.npcs,i=n?.indexByUid?.(ownerUid)??-1;return i>=0?{x:n.homeX[i]||n.x[i],y:n.homeY[i]||n.y[i]}:null}
function communityProjects(w,ownerUid){const a=communityAnchor(w,ownerUid);if(!a)return[];return(w.blueprints||[]).filter(bp=>!bp.done&&!bp.abandoned&&bp.type>=0&&Math.hypot(bp.cx-a.x,bp.cy-a.y)<=COMMUNITY_RADIUS).sort((x,y)=>(x.createdTick||0)-(y.createdTick||0)||x.id-y.id)}
function communityHasShelter(w,ownerUid){const a=communityAnchor(w,ownerUid);if(!a)return false;return(w.buildings||[]).some(b=>b.finished&&b.type===BUILDING.SHELTER&&Math.hypot(b.x-a.x,b.y-a.y)<=COMMUNITY_RADIUS)}
function makePrimitiveShelter(bp){
 const at=(type,dx,dy)=>bp.pieces.find(p=>p.pieceType===type&&p.x===bp.cx+dx&&p.y===bp.cy+dy),pieces=[at(PIECE.FLOOR,0,0),at(PIECE.WALL,0,-2),at(PIECE.WALL,-2,0),at(PIECE.WALL,2,0),at(PIECE.DOOR,0,2),at(PIECE.ROOF,0,-1)].filter(Boolean);
 if(pieces.length<5)return;
 for(const p of pieces){p.cost=p.pieceType===PIECE.FLOOR?.08:p.pieceType===PIECE.ROOF?.10:p.pieceType===PIECE.DOOR?.12:.14;p.work=p.pieceType===PIECE.ROOF?14:12;p.primitive=true}
 bp.pieces=pieces;bp.primitive=true;
}
function bestCommunityTask(w,ownerUid){
 const sim=w._constructionSim,n=sim?.npcs,i=n?.indexByUid?.(ownerUid)??-1;if(i<0)return null;const projects=communityProjects(w,ownerUid);if(!projects.length)return null;let best=null,score=-Infinity;
 for(const bp of projects)for(let pi=0;pi<bp.pieces.length;pi++){const p=bp.pieces[pi];if(p.done||p.reserved||!supportReady(w,p))continue;if(p.tech!=null&&!technologyFor(sim).knows(n,i,p.tech))continue;if(p.tool&&n.tool[i]!==p.tool&&(w.tools?.[p.tool]||0)<=0)continue;if(isBlocking(p)&&!placementPreservesAccess(sim,p))continue;const candidate={bp,piece:p,pieceIndex:pi},s=taskPriority(w,ownerUid,candidate);if(s>score){score=s;best=candidate}}
 if(best)best.bp.lastTouched=sim.tick;return best;
}
function taskPriority(w,ownerUid,task){const sim=w._constructionSim,n=sim?.npcs,i=n?.indexByUid?.(ownerUid)??-1;if(i<0||!task?.bp||!task?.piece)return-Infinity;const projects=communityProjects(w,ownerUid),focus=projects[0],p=task.piece,bp=task.bp,d=Math.hypot(n.x[i]-p.x,n.y[i]-p.y),owner=n.indexByUid(bp.owner),rel=owner<0||owner===i?1:relationFactor(sim,i,owner);return 1/(1+d*.08)+rel*.22+n.skill(i,6)*.18+(focus?.id===bp.id ? .95 : 0)+(p.repairId ? .45 : 0)}
function relationFactor(sim,i,j){const r=sim.memory.relation(i,j);return Math.max(0,Math.min(1,.45+(r.affection||0)*.35+(r.trust||0)*.35))}
function supportReady(w,p){if(p.repairId)return true;if(p.layer==='roof'){for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[0,0]]){const id=w.inside(p.x+dx,p.y+dy)?w.structure[w.idx(p.x+dx,p.y+dy)]:0,q=w.pieceStore[id];if(q&&[PIECE.WALL,PIECE.PILLAR,PIECE.DOOR].includes(q.type))return true}return false}if(p.layer==='fixture'&&![PIECE.FIRE,PIECE.WELL,PIECE.GARDEN,PIECE.PEN].includes(p.pieceType))return w.pieceStore.some(q=>q&&q.type===PIECE.FLOOR&&q.x===p.x&&q.y===p.y&&q.durability>0);return true}
function isBlocking(p){return p.layer==='ground'&&[PIECE.WALL,PIECE.PILLAR,PIECE.FENCE,PIECE.BRANCH_SHELTER].includes(p.pieceType)}

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
