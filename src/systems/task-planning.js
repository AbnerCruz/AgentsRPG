import {ACTION,ACTION_ID,RESOURCE,NUTRITION,NPC_STATE,GENE,TRAVEL_ACTIONS} from '../core/constants.js';
import {arrivalDistance,stateForAction,taskDurationFor,taskTimeoutFor,readTargetProgress,writeTargetProgress} from './actions.js';
import {foodExposure,waterExposure} from './disease.js';
import {technologyFor} from './technology.js';

const MAX_STACK=3;
const RESUMABLE=new Set([ACTION.RETURN,ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FARM,ACTION.FISH,ACTION.HUNT,ACTION.COOK,ACTION.TAILOR,ACTION.FORGE,ACTION.BUILD,ACTION.EXPLORE,ACTION.DUNGEON]);
const DISCARDABLE=new Set([ACTION.SOCIAL,ACTION.TEACH,ACTION.SLEEP,ACTION.WARM,ACTION.IDLE]);
const URGENT=new Set([ACTION.FLEE,ACTION.FIGHT,ACTION.CARE]);
const ATOMIC=new Set([ACTION.EAT,ACTION.DRINK]);
const FOOD=[RESOURCE.BERRY,RESOURCE.GRAIN,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.EGG,RESOURCE.MILK,RESOURCE.PRESERVED];
const cloneIntent=int=>int?JSON.parse(JSON.stringify(int)):null;

export function ensureTaskPlanning(sim){
 if(!sim.taskStacks)sim.taskStacks=Array.from({length:sim.npcs?.alive?.length||512},()=>[]);
 if(!sim.taskPlanning)sim.taskPlanning={suspended:0,resumed:0,invalidated:0,discarded:0,atomic:0,opportunistic:0};
 return sim.taskStacks;
}
export function interruptClass(action){if(ATOMIC.has(action))return'atomic';if(URGENT.has(action))return'urgent';if(RESUMABLE.has(action))return'resumable';return DISCARDABLE.has(action)?'discardable':'discardable'}
export function stackFor(sim,i){ensureTaskPlanning(sim);return sim.taskStacks[i]||(sim.taskStacks[i]=[])}
export function stackSummary(sim,i){return stackFor(sim,i).map(x=>({action:x.intent?.action,reason:x.reason,progress:x.progress,suspendedAt:x.suspendedAt,targetX:x.intent?.targetX,targetY:x.intent?.targetY}))}

export function performAtomicNeeds(sim,i){
 const n=sim.npcs;if(!n.alive[i])return false;
 const thirst=n.need(i,1),hunger=n.need(i,0),water=n.inventory[i][RESOURCE.WATER]||0,food=personalFood(n,i);
 if(thirst>.58&&water>.08)return performAtomicAction(sim,i,ACTION.DRINK);
 if(hunger>.62&&food>.04)return performAtomicAction(sim,i,ACTION.EAT);
 return false;
}
export function performAtomicAction(sim,i,action){
 if(!ATOMIC.has(action))return false;ensureTaskPlanning(sim);const n=sim.npcs,w=sim.world,tech=technologyFor(sim);let ok=false;
 if(action===ACTION.DRINK){if((n.inventory[i][RESOURCE.WATER]||0)>.08){n.inventory[i][RESOURCE.WATER]-=.09;n.setNeed(i,1,n.need(i,1)-.72);waterExposure(sim,i);ok=true}}
 else if(action===ACTION.EAT){let food=null;for(const k of FOOD)if((n.inventory[i][k]||0)>.04){const amount=Math.min(.14,n.inventory[i][k]);n.inventory[i][k]-=amount;food={kind:k,amount,raw:k!==RESOURCE.PRESERVED};break}if(food){n.setNeed(i,0,n.need(i,0)-.58);if(food.kind===RESOURCE.BERRY)n.addNutrition(i,NUTRITION.PLANT,.2);else if(food.kind===RESOURCE.GRAIN)n.addNutrition(i,NUTRITION.GRAIN,.2);else if([RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.EGG,RESOURCE.MILK].includes(food.kind))n.addNutrition(i,NUTRITION.PROTEIN,.22);else{n.addNutrition(i,NUTRITION.PROTEIN,.1);n.addNutrition(i,NUTRITION.PLANT,.08)}foodExposure(sim,i,food.kind,food.raw!==false);ok=true}}
 if(ok){sim.actionHistogram[action]=(sim.actionHistogram[action]||0)+1;sim.taskPlanning.atomic++;if(n.intent[i])sim.taskPlanning.opportunistic++;return true}return false;
}
function personalFood(n,i){let s=0;for(const k of FOOD)s+=n.inventory[i][k]||0;return s}

export function emergencyKind(sim,i,p={}){
 const n=sim.npcs,int=n.intent[i];if(!int||URGENT.has(int.action))return null;
 const wounds=n.phaseF?.wounds?.[i]||[];if(wounds.some(w=>(w.bleeding||0)>.2))return'hemorragia';
 const committed=[ACTION.FORAGE,ACTION.WATER].includes(int.action);
 if(!committed&&n.need(i,1)>.9&&(n.inventory[i][RESOURCE.WATER]||0)<=.08)return'sede crítica';
 if(!committed&&n.need(i,0)>.93&&personalFood(n,i)<=.04)return'fome crítica';
 if(!p?.target)return null;const threshold=.5+n.gene(i,GENE.STUBBORN)*.2-n.gene(i,GENE.CAUTION)*.14;return(p.threat||0)>threshold?'ameaça imediata':null;
}
export function handleEmergency(sim,i,p={}){const reason=emergencyKind(sim,i,p);if(!reason)return false;return releaseCurrent(sim,i,reason,true)}
export function releaseCurrent(sim,i,reason='mudança de prioridade',preferSuspend=true){
 ensureTaskPlanning(sim);const n=sim.npcs,int=n.intent[i];if(!int)return false;const cls=interruptClass(int.action);
 if(preferSuspend&&cls==='resumable')return suspendCurrent(sim,i,reason);
 discardCurrent(sim,i,reason);return true;
}
export function suspendCurrent(sim,i,reason='interrompido'){
 ensureTaskPlanning(sim);const n=sim.npcs,int=n.intent[i];if(!int||interruptClass(int.action)!=='resumable')return false;writeTargetProgress(sim,i,int,n.taskProgress[i]);
 const stack=stackFor(sim,i);if(stack.length>=MAX_STACK){const old=stack.shift();sim.taskPlanning.invalidated++;sim.memory?.remember?.(i,{type:'plano',text:`Abandonei ${old.intent?.action||'um plano'} depois de interrupções sucessivas.`,tick:sim.tick,valence:-1,importance:.35,reflectionKey:'planejamento'})}
 stack.push({intent:cloneIntent(int),progress:n.taskProgress[i],duration:n.taskDuration[i],reason,suspendedAt:sim.tick});sim.taskPlanning.suspended++;sim.memory?.remember?.(i,{type:'suspensão',text:`Suspendi ${int.action} por ${reason}; pretendo retomar.`,tick:sim.tick,valence:0,importance:.34,reflectionKey:'planejamento'});clearSlot(sim,i);return true;
}
export function discardCurrent(sim,i,reason='descartável'){
 ensureTaskPlanning(sim);const n=sim.npcs,int=n.intent[i];if(!int)return false;writeTargetProgress(sim,i,int,n.taskProgress[i]);sim.taskPlanning.discarded++;sim.tasks.cancelled=(sim.tasks.cancelled||0)+1;sim.tasks.cancelledByAction=sim.tasks.cancelledByAction||{};sim.tasks.cancelledByAction[int.action]=(sim.tasks.cancelledByAction[int.action]||0)+1;sim.memory?.remember?.(i,{type:'plano',text:`Deixei ${int.action}: ${reason}.`,tick:sim.tick,valence:0,importance:.18,reflectionKey:'planejamento'});clearSlot(sim,i);return true;
}
function clearSlot(sim,i){const n=sim.npcs;sim.world.pathfinder?.cancel?.(i);n.intent[i]=null;n.state[i]=NPC_STATE.IDLE;n.action[i]=ACTION.IDLE;n.taskKind[i]=ACTION_ID[ACTION.IDLE];n.taskProgress[i]=0;n.taskDuration[i]=0;n.taskTimeout[i]=0;n.taskTargetRef[i]=-1;n.taskTargetX[i]=n.x[i];n.taskTargetY[i]=n.y[i];n.clearRoute(i)}

export function resumeSuspended(sim,i){
 ensureTaskPlanning(sim);const n=sim.npcs,stack=stackFor(sim,i);while(stack.length){const frame=stack.pop(),reason=invalidReason(sim,i,frame.intent);if(reason){sim.taskPlanning.invalidated++;sim.memory?.remember?.(i,{type:'plano',text:`Não pude retomar ${frame.intent?.action||'a tarefa'}: ${reason}.`,tick:sim.tick,valence:-1,importance:.42,reflectionKey:'planejamento'});continue}const int=cloneIntent(frame.intent);delete int.analytic;int.lastReview=sim.tick;int.lastExecTick=sim.tick;int.pathReady=false;n.intent[i]=int;n.action[i]=int.action;n.taskKind[i]=ACTION_ID[int.action]??ACTION_ID[ACTION.IDLE];n.taskProgress[i]=Math.max(frame.progress||0,readTargetProgress(sim,i,int));n.taskDuration[i]=frame.duration||taskDurationFor(sim,i,int.action,int);const d=Math.hypot(int.targetX-n.x[i],int.targetY-n.y[i]);n.taskTimeout[i]=sim.tick+taskTimeoutFor(d,n.taskDuration[i]);n.taskTargetX[i]=int.targetX;n.taskTargetY[i]=int.targetY;n.taskTargetRef[i]=int.targetId??-1;n.state[i]=d>arrivalDistance(int.action)?NPC_STATE.MOVING:stateForAction(int.action);n.clearRoute(i);sim.taskPlanning.resumed++;sim.memory?.remember?.(i,{type:'retomada',text:`Retomei ${int.action} depois de ${frame.reason}.`,tick:sim.tick,valence:1,importance:.32,reflectionKey:'planejamento'});return true}return false;
}
function invalidReason(sim,i,int){if(!int)return'referência inválida';const w=sim.world,n=sim.npcs,a=int.action;if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){const byId=int.targetId>=0?w.resources[int.targetId]:null,near=w.findResourceAt?.(int.sourceX,int.sourceY,int.targetKind,1.5);const r=byId?.kind===int.targetKind?byId:near;if(!r)return'referência inválida';if((r.amount||0)<=.01)return'material esgotado na chegada'}if(a===ACTION.BUILD){const bp=w.blueprints[int.meta?.blueprint],p=bp?.pieces?.[int.meta?.pieceIndex];if(!bp||!p)return'alvo inexistente';if(p.done)return'peça já concluída por outra pessoa'}if([ACTION.SOCIAL,ACTION.CARE,ACTION.TEACH].includes(a)&&(int.targetId<0||!n.alive[int.targetId]))return'alvo inexistente';return null}

export function shouldSwitchTask(sim,i,scores,goal,p={}){
 const n=sim.npcs,int=n.intent[i];if(!int||goal===int.action)return false;if(ATOMIC.has(goal))return false;if(URGENT.has(goal)||p?.threat>.72)return true;
 const cur=scores.find(x=>x[0]===int.action)?.[1]||0,next=scores.find(x=>x[0]===goal)?.[1]||0,progress=Math.max(n.taskProgress[i]||0,readTargetProgress(sim,i,int)||0),margin=.35+progress*.95+n.gene(i,GENE.STUBBORN)*.45;
 return next>Math.max(.08,cur*(1+margin));
}
export function switchTask(sim,i,goal,p={}){const n=sim.npcs;if(!n.intent[i])return false;const cls=interruptClass(n.intent[i].action);if(cls==='resumable')suspendCurrent(sim,i,'prioridade claramente superior');else discardCurrent(sim,i,'prioridade claramente superior');return true}

export function serializeTaskPlanning(sim){ensureTaskPlanning(sim);return{stacks:sim.taskStacks.map(s=>s.map(x=>({...x,intent:cloneIntent(x.intent)}))),metrics:{...sim.taskPlanning}}}
export function hydrateTaskPlanning(sim,data){sim.taskStacks=Array.from({length:sim.npcs?.alive?.length||512},(_,i)=>(data?.stacks?.[i]||[]).slice(-MAX_STACK).map(x=>({...x,intent:cloneIntent(x.intent)})));sim.taskPlanning={suspended:0,resumed:0,invalidated:0,discarded:0,atomic:0,opportunistic:0,...(data?.metrics||{})};return sim.taskStacks}
