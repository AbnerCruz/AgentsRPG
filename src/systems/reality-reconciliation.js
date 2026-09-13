import {World} from '../world/world.js';
import {MemorySystem} from '../ai/memory.js';
import {ACTION} from '../core/constants.js';
import './construction.js';

const RESOURCE_ACTIONS=new Set([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH]);

if(!MemorySystem.prototype.invalidateResource){
 MemorySystem.prototype.invalidateResource=function(i,slot,kind,tick,sourceIndex=-1){
  const s=this.spatial.get(i);if(!s||slot<0||slot>=s.count||kind==null)return false;
  const bit=(1<<kind)>>>0;if(!(s.resource[slot]&bit))return false;
  const alreadyInvalidated=s.seen[slot]===tick&&s.confidence[slot]<.3;
  s.resource[slot]=(s.resource[slot]&~bit)>>>0;s.quantity[slot]=0;s.seen[slot]=tick;
  s.confidence[slot]=(s.resource[slot]||s.flags[slot])?Math.min(s.confidence[slot]||1,.25):0;
  if(!alreadyInvalidated){
   if(sourceIndex>=0){
    this.adjust(i,sourceIndex,{trust:-.08,respect:-.025});
    this.remember(i,{type:'informação errada',text:'Cheguei ao local indicado, mas o recurso não estava mais ali.',tick,valence:-3,importance:.72,reflectionKey:`pessoa:${sourceIndex}`});
   }else this.remember(i,{type:'erro de memória',text:'Cheguei ao lugar lembrado, mas o recurso não estava mais ali. Corrigi minha lembrança.',tick,valence:-2,importance:.64,reflectionKey:'memória espacial'});
  }
  return true;
 };
}

if(!World.prototype.__realityReconciliationInstalled){
 const baseComplete=World.prototype.completePiece;
 World.prototype.completePiece=function(bp,p){const built=baseComplete.call(this,bp,p);return ensureBlueprintBuilding(this,bp,built)};
 const baseTick=World.prototype.tick;
 World.prototype.tick=function(tick){
  const out=baseTick.call(this,tick),sim=this._constructionSim;
  if(sim)reconcileResourceIntents(sim);
  if(tick%120===0)for(const bp of this.blueprints||[])if(bp?.done||shellReady(bp))ensureBlueprintBuilding(this,bp,null);
  return out;
 };
 Object.defineProperty(World.prototype,'__realityReconciliationInstalled',{value:true});
}

function reconcileResourceIntents(sim){
 const n=sim.npcs,w=sim.world;
 for(let i=0;i<n.count;i++){
  if(!n.alive[i])continue;const int=n.intent[i];if(!int||!RESOURCE_ACTIONS.has(int.action)||int.targetKind==null)continue;
  const sourceX=Number.isFinite(int.sourceX)?int.sourceX:int.targetX,sourceY=Number.isFinite(int.sourceY)?int.sourceY:int.targetY;
  const atSite=Math.hypot(n.x[i]-sourceX,n.y[i]-sourceY)<=1.8||Math.hypot(n.x[i]-int.targetX,n.y[i]-int.targetY)<=.9;if(!atSite)continue;
  const byId=int.targetId>=0?w.resources[int.targetId]:null,actual=byId&&byId.kind===int.targetKind&&byId.amount>.01?byId:w.findResourceAt(sourceX,sourceY,int.targetKind,1.5);
  if(actual?.amount>.01)continue;
  const source=sourceIndex(n,int.meta?.sourceUid);
  sim.memory.invalidateResource?.(i,int.meta?.memorySlot??-1,int.targetKind,sim.tick,source);
 }
}

function sourceIndex(n,source){if(source==null||source<0)return-1;const byUid=n.indexByUid?.(source)??-1;if(byUid>=0)return byUid;return source<n.count?source:-1}
function shellReady(bp){const shell=bp?.pieces?.filter(x=>x.layer!=='fixture')||[];return shell.length>0&&shell.every(x=>x.done)}
function ensureBlueprintBuilding(w,bp,built=null){
 if(!bp||bp.type==null||bp.type<0||(!bp.done&&!shellReady(bp)))return built;
 let existing=bp.shellBuildingId!=null?w.buildings.find(b=>b.id===bp.shellBuildingId):null;
 if(!existing)existing=w.buildings.find(b=>b.phaseG&&b.type===bp.type&&b.owner===bp.owner&&Math.hypot(b.x-bp.cx,b.y-bp.cy)<.1);
 if(!existing){existing=w.addBuilding(bp.type,bp.cx,bp.cy,false,bp.owner);existing.finished=true;existing.phaseG=true;existing.group=bp.group;existing.shellOnly=!bp.done;bp.shellBuildingId=existing.id}
 else{existing.finished=true;existing.phaseG=true;existing.group=bp.group;if(bp.done)existing.shellOnly=false}
 bp.shellDone=true;if(bp.done)existing.shellOnly=false;
 return built||existing;
}
