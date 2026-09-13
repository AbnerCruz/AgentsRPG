import {MemorySystem} from '../ai/memory.js';
import {World} from '../world/world.js';
import {ACTION,RESOURCE,MAP_W,NEED} from '../core/constants.js';

const TARGET_COOLDOWN=2400,ACTION_COOLDOWN=3000,FAILURE_LIMIT=3,STREAK_WINDOW=6000;
const KIND_ACTION={
 [RESOURCE.BERRY]:ACTION.FORAGE,[RESOURCE.WATER]:ACTION.WATER,[RESOURCE.LOG]:ACTION.WOOD,
 [RESOURCE.STONE]:ACTION.STONE,[RESOURCE.IRON]:ACTION.IRON,[RESOURCE.FISH]:ACTION.FISH
};

function state(memory){return memory._failureGuard||(memory._failureGuard={targets:{},actions:{},reconciled:0})}
function npcTargets(memory,i){const g=state(memory);return g.targets[i]||(g.targets[i]={})}
function npcActions(memory,i){const g=state(memory);return g.actions[i]||(g.actions[i]={})}
function tileFor(world,int){const x=Number.isFinite(int?.sourceX)?int.sourceX:int?.targetX,y=Number.isFinite(int?.sourceY)?int.sourceY:int?.targetY;return world?.inside?.(x,y)?world.idx(x,y):-1}

export function isActionSuppressed(sim,i,action){const s=state(sim.memory).actions?.[i]?.[action];return !!s?.until&&s.until>sim.tick}
export function isTargetCooling(sim,i,action,x,y){if(!sim.world.inside(x,y))return false;const tile=sim.world.idx(x,y),until=state(sim.memory).targets?.[i]?.[`${action}:${tile}`]||0;return until>sim.tick}
export function recordTaskOutcome(sim,i,int,success,reason=null){
 if(!int?.action)return;const memory=sim.memory,actions=npcActions(memory,i),prev=actions[int.action]||{count:0,last:0,until:0};
 if(success){actions[int.action]={count:0,last:sim.tick,until:0};return}
 sim.npcs.setNeed(i,NEED.PURPOSE,sim.npcs.need(i,NEED.PURPOSE)+.035);
 const tile=tileFor(sim.world,int);if(tile>=0)npcTargets(memory,i)[`${int.action}:${tile}`]=sim.tick+TARGET_COOLDOWN;
 if(sim.tick-prev.last>STREAK_WINDOW)prev.count=0;prev.count++;prev.last=sim.tick;
 if(prev.count>=FAILURE_LIMIT){prev.count=0;prev.until=sim.tick+ACTION_COOLDOWN;memory.remember(i,{type:'frustração',text:`Falhei repetidamente em ${int.action}; vou tentar outra coisa por um tempo.`,tick:sim.tick,valence:-2,importance:.5,reflectionKey:`falha:${int.action}`})}
 actions[int.action]=prev;
}

if(!MemorySystem.prototype.__failureGuardInstalled){
 const baseRecall=MemorySystem.prototype.recallNearest,baseSerialize=MemorySystem.prototype.serialize,baseHydrate=MemorySystem.hydrate;
 MemorySystem.prototype.recallNearest=function(i,x,y,kind,tick,maxAge){
  const action=KIND_ACTION[kind],a=state(this).actions?.[i]?.[action];if(action&&a?.until>tick)return null;
  const s=this.spatial.get(i);if(!s)return null;const bit=1<<kind,cool=state(this).targets?.[i]||{};let best=null,score=-Infinity;
  for(let k=0;k<s.count;k++){if(s.tiles[k]<0||!(s.resource[k]&bit))continue;if(action&&(cool[`${action}:${s.tiles[k]}`]||0)>tick)continue;const conf=this.effectiveConfidence(s,k,tick,maxAge);if(conf<=0)continue;const tx=s.tiles[k]%MAP_W,ty=Math.floor(s.tiles[k]/MAP_W),d=Math.hypot(tx+.5-x,ty+.5-y),q=conf/(1+d*.05);if(q>score){score=q;best={x:tx+.5,y:ty+.5,d,tile:s.tiles[k],seen:s.seen[k],confidence:conf,quantity:s.quantity[k],sourceUid:s.source[k],slot:k}}}
  return best;
 };
 MemorySystem.prototype.serialize=function(){const out=baseSerialize.call(this),g=state(this);out.failureGuard=JSON.parse(JSON.stringify(g));return out};
 MemorySystem.hydrate=function(d){const m=baseHydrate.call(MemorySystem,d);m._failureGuard=d?.failureGuard||{targets:{},actions:{},reconciled:0};return m};
 Object.defineProperty(MemorySystem.prototype,'__failureGuardInstalled',{value:true});
}

if(!World.prototype.__visibleAbsenceReconciliation){
 const baseNear=World.prototype.resourcesNear;
 World.prototype.resourcesNear=function(x,y,rad=8,kind=null){
  const out=baseNear.call(this,x,y,rad,kind);if(kind!=null||!this._constructionSim)return out;
  const sim=this._constructionSim,n=sim.npcs,m=sim.memory;let who=-1;
  for(const i of n.living())if(Math.abs(n.x[i]-x)<1e-6&&Math.abs(n.y[i]-y)<1e-6){who=i;break}if(who<0)return out;
  const active=new Map();for(const r of out){const tile=this.idx(r.x,r.y);active.set(tile,(active.get(tile)||0)|(1<<r.kind))}
  const s=m.spatial.get(who);if(!s)return out;for(let k=0;k<s.count;k++){const tile=s.tiles[k];if(tile<0||!s.resource[k])continue;const tx=tile%MAP_W,ty=Math.floor(tile/MAP_W);if(Math.hypot(tx+.5-x,ty+.5-y)>rad)continue;const stale=s.resource[k]&~(active.get(tile)||0);if(!stale)continue;s.resource[k]&=~stale;s.seen[k]=sim.tick;if(!s.resource[k]){s.quantity[k]=0;if(!s.flags[k])s.confidence[k]=0}else s.confidence[k]=Math.min(s.confidence[k]||1,.35);state(m).reconciled++}
  return out;
 };
 Object.defineProperty(World.prototype,'__visibleAbsenceReconciliation',{value:true});
}
