import {ACTION,ACTION_ID,RESOURCE,BUILDING,TOOL,TRAVEL_ACTIONS,TILE_TYPE,NPC_STATE,DAY_TICKS} from '../core/constants.js';
import {knownResource} from '../ai/perception.js';

const skillFor={
 [ACTION.WOOD]:1,[ACTION.STONE]:0,[ACTION.IRON]:0,[ACTION.FARM]:2,[ACTION.HUNT]:3,[ACTION.FISH]:4,
 [ACTION.COOK]:5,[ACTION.BUILD]:6,[ACTION.FORGE]:7,[ACTION.TAILOR]:9,[ACTION.FIGHT]:10,
 [ACTION.DUNGEON]:10,[ACTION.CARE]:12,[ACTION.SOCIAL]:13
};
const toolFor={
 [ACTION.WOOD]:TOOL.AXE,[ACTION.STONE]:TOOL.PICK,[ACTION.IRON]:TOOL.PICK,[ACTION.BUILD]:TOOL.HAMMER,
 [ACTION.FISH]:TOOL.ROD,[ACTION.HUNT]:TOOL.BOW,[ACTION.FIGHT]:TOOL.SWORD,[ACTION.COOK]:TOOL.KNIFE
};

const baseAt720={
 [ACTION.IDLE]:1,[ACTION.RETURN]:1,[ACTION.EAT]:1,[ACTION.DRINK]:1,[ACTION.SLEEP]:120,[ACTION.WARM]:40,[ACTION.FLEE]:1,
 [ACTION.FORAGE]:15,[ACTION.WATER]:12,[ACTION.WOOD]:60,[ACTION.STONE]:80,[ACTION.IRON]:110,[ACTION.FARM]:30,
 [ACTION.FISH]:38,[ACTION.HUNT]:42,[ACTION.COOK]:45,[ACTION.TAILOR]:70,[ACTION.FORGE]:90,[ACTION.CARE]:24,
 [ACTION.SOCIAL]:18,[ACTION.BUILD]:40,[ACTION.EXPLORE]:1,[ACTION.DUNGEON]:120,[ACTION.FIGHT]:20
};

const difficultyFor={
 [ACTION.WATER]:.9,[ACTION.WOOD]:1,[ACTION.STONE]:1.05,[ACTION.IRON]:1.15,[ACTION.FARM]:1,
 [ACTION.FISH]:1.05,[ACTION.HUNT]:1.15,[ACTION.COOK]:1,[ACTION.TAILOR]:1.1,[ACTION.FORGE]:1.15,
 [ACTION.CARE]:1,[ACTION.SOCIAL]:1,[ACTION.BUILD]:1,[ACTION.DUNGEON]:1.35,[ACTION.FIGHT]:1
};

export function prepareAction(sim,i,action,perception){
 const n=sim.npcs,w=sim.world;
 equip(sim,i,toolFor[action]);
 const intent={
  action,started:sim.tick,lastReview:sim.tick,lastExecTick:sim.tick,targetX:n.x[i],targetY:n.y[i],sourceX:n.x[i],sourceY:n.y[i],
  targetId:-1,targetKind:null,required:1,difficulty:difficultyFor[action]??1,pathReady:false,meta:{}
 };
 n.action[i]=action;
 n.taskKind[i]=ACTION_ID[action]??ACTION_ID[ACTION.IDLE];
 n.taskProgress[i]=0;
 n.taskDuration[i]=0;
 n.taskTimeout[i]=0;
 n.taskTargetRef[i]=-1;
 n.clearRoute(i);

 if(action===ACTION.IDLE){
  n.intent[i]=null;n.state[i]=NPC_STATE.IDLE;n.action[i]=ACTION.IDLE;
  sim.actionHistogram[action]=(sim.actionHistogram[action]||0)+1;
  return true;
 }

 if(action===ACTION.RETURN){
  intent.targetX=w.settlement.x;intent.targetY=w.settlement.y;
 }else if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(action)){
  const kind=action===ACTION.FORAGE?RESOURCE.BERRY:action===ACTION.WATER?RESOURCE.WATER:action===ACTION.WOOD?RESOURCE.LOG:action===ACTION.STONE?RESOURCE.STONE:action===ACTION.IRON?RESOURCE.IRON:RESOURCE.FISH;
  const k=knownResource(sim,i,kind);
  if(!k)return resetPrepared(n,i);
  intent.sourceX=k.x;intent.sourceY=k.y;intent.targetKind=kind;
  const ref=w.findResourceAt(k.x,k.y,kind,1.5);
  if(ref){intent.targetId=ref.id;n.taskTargetRef[i]=ref.id}
  const a=approach(w,k.x,k.y);
  intent.targetX=a.x;intent.targetY=a.y;
 }else if(action===ACTION.HUNT){
  const prey=sim.animals.nearestPrey(n.x[i],n.y[i],perception.radius);
  if(!prey)return resetPrepared(n,i);
  intent.targetId=prey.id;intent.targetX=prey.x;intent.targetY=prey.y;n.taskTargetRef[i]=prey.id;
 }else if(action===ACTION.SOCIAL){
  const j=sim.nearestVisibleNPC(i,perception.radius);
  if(j<0)return resetPrepared(n,i);
  intent.targetId=j;intent.targetX=n.x[j];intent.targetY=n.y[j];n.taskTargetRef[i]=j;
 }else if(action===ACTION.CARE){
  const j=sim.nearestWounded(i,perception.radius);
  if(j<0)return resetPrepared(n,i);
  intent.targetId=j;intent.targetX=n.x[j];intent.targetY=n.y[j];n.taskTargetRef[i]=j;
 }else if(action===ACTION.FIGHT){
  if(!perception.target)return resetPrepared(n,i);
  intent.meta.targetType=perception.target.kind;
  intent.targetId=perception.target.ref.id;
  intent.targetX=perception.target.x;intent.targetY=perception.target.y;n.taskTargetRef[i]=intent.targetId;
 }else if(action===ACTION.FLEE){
  const t=perception.target;
  if(!t)return resetPrepared(n,i);
  const dx=n.x[i]-t.x,dy=n.y[i]-t.y,d=Math.hypot(dx,dy)||1;
  const q=passablePoint(w,n.x[i]+dx/d*7,n.y[i]+dy/d*7);
  intent.targetX=q.x;intent.targetY=q.y;
 }else if(action===ACTION.SLEEP){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.SHELTER,14);
  if(b){intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id}
 }else if(action===ACTION.WARM){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.CAMPFIRE,14)||w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.SHELTER,14);
  if(b){intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id}
 }else if(action===ACTION.FARM){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FARM,14);
  if(!b)return resetPrepared(n,i);
  intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id;
 }else if(action===ACTION.FORGE){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FORGE,14);
  if(!b)return resetPrepared(n,i);
  intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id;
 }else if(action===ACTION.COOK){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.CAMPFIRE,14);
  if(!b)return resetPrepared(n,i);
  intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id;
 }else if(action===ACTION.TAILOR){
  const b=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.WORKSHOP,14)||w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.STORAGE,14);
  if(b){intent.targetX=b.x;intent.targetY=b.y;intent.targetId=b.id;n.taskTargetRef[i]=b.id}
 }else if(action===ACTION.BUILD){
  let x=w.nextBlueprintPiece();
  if(!x){
   const type=nextBuildingType(sim),pos=buildSpot(sim);
   w.createBlueprint(type,pos.x,pos.y);
   x=w.nextBlueprintPiece();
  }
  if(!x)return resetPrepared(n,i);
  if(!x.piece.reserved){
   if(w.stock[x.piece.material]<x.piece.cost)return resetPrepared(n,i);
   w.stock[x.piece.material]-=x.piece.cost;
   x.piece.reserved=true;
  }
  intent.meta.blueprint=x.bp.id;
  intent.meta.pieceIndex=x.bp.pieces.indexOf(x.piece);
  intent.targetX=x.piece.x;intent.targetY=x.piece.y;
  intent.targetId=x.bp.id;
  n.taskTargetRef[i]=x.bp.id;
 }else if(action===ACTION.EXPLORE){
  const q=exploreTarget(sim,i);intent.targetX=q.x;intent.targetY=q.y;
 }else if(action===ACTION.DUNGEON){
  const site=sim.dungeon.nearestKnownSite(sim,i);
  if(!site||w.stock[RESOURCE.WATER]<.35)return resetPrepared(n,i);
  intent.targetId=site.id;n.taskTargetRef[i]=site.id;
  const q=approach(w,site.x,site.y);
  intent.targetX=q.x;intent.targetY=q.y;intent.sourceX=site.x;intent.sourceY=site.y;
  w.stock[RESOURCE.WATER]-=.35;n.inventory[i][RESOURCE.WATER]+=.35;
  for(let qn=0;qn<2;qn++){const food=w.consumeFood(sim.tick);if(food)n.inventory[i][food.kind]+=food.amount}
 }

 n.intent[i]=intent;
 n.taskTargetX[i]=intent.targetX;
 n.taskTargetY[i]=intent.targetY;
 if(n.taskTargetRef[i]<0)n.taskTargetRef[i]=intent.targetId??-1;
 n.taskProgress[i]=readTargetProgress(sim,i,intent);
 n.taskDuration[i]=taskDurationFor(sim,i,action,intent);
 const distance=Math.hypot(intent.targetX-n.x[i],intent.targetY-n.y[i]);
 n.taskTimeout[i]=sim.tick+Math.max(180,Math.ceil(distance/.018)+Math.ceil(n.taskDuration[i]*3)+120);
 n.state[i]=distance>arrivalDistance(action)?NPC_STATE.MOVING:stateForAction(action);
 n.animFrame[i]=0;n.animTimer[i]=0;

 if(TRAVEL_ACTIONS.has(action)){
  sim.travel.started++;
  sim.travel.byAction[action]=(sim.travel.byAction[action]||0)+1;
 }
 sim.actionHistogram[action]=(sim.actionHistogram[action]||0)+1;
 if(sim.tasks){
  sim.tasks.started++;
  sim.tasks.byAction[action]=(sim.tasks.byAction[action]||0)+1;
 }
 return true;
}

function resetPrepared(n,i){
 n.action[i]=ACTION.IDLE;
 n.state[i]=NPC_STATE.IDLE;
 n.taskKind[i]=ACTION_ID[ACTION.IDLE];
 n.taskProgress[i]=0;
 n.taskDuration[i]=0;
 n.taskTimeout[i]=0;
 n.taskTargetRef[i]=-1;
 n.intent[i]=null;
 return false;
}

export function finishIntent(sim,i,success=true){
 const n=sim.npcs,int=n.intent[i];
 if(int&&TRAVEL_ACTIONS.has(int.action)){
  if(success){
   sim.travel.completed++;
   sim.travel.completedByAction[int.action]=(sim.travel.completedByAction[int.action]||0)+1;
  }else{
   sim.travel.abandoned++;
   sim.travel.abandonedByAction[int.action]=(sim.travel.abandonedByAction[int.action]||0)+1;
  }
 }
 if(int&&sim.tasks){
  if(success){
   sim.tasks.completed++;
   sim.tasks.completedByAction[int.action]=(sim.tasks.completedByAction[int.action]||0)+1;
  }else{
   sim.tasks.failed++;
   sim.tasks.failedByAction[int.action]=(sim.tasks.failedByAction[int.action]||0)+1;
  }
 }
 sim.world.pathfinder?.cancel?.(i);
 n.intent[i]=null;
 n.state[i]=NPC_STATE.IDLE;
 n.taskKind[i]=ACTION_ID[ACTION.IDLE];
 n.taskProgress[i]=0;
 n.taskDuration[i]=0;
 n.taskTimeout[i]=0;
 n.taskTargetX[i]=n.x[i];
 n.taskTargetY[i]=n.y[i];
 n.taskTargetRef[i]=-1;
 n.clearRoute(i);
 n.animFrame[i]=0;n.animTimer[i]=0;
 if(n.alive[i])n.action[i]=ACTION.IDLE;
}

export function abortIntent(sim,i,reason='interrompido'){
 const n=sim.npcs,int=n.intent[i];
 if(int){
  writeTargetProgress(sim,i,int,n.taskProgress[i]);
  sim.memory.remember(i,{type:'interrupção',text:`Interrompi ${int.action}: ${reason}.`,tick:sim.tick,valence:-1,importance:.28,reflectionKey:'interrupção'});
  finishIntent(sim,i,false);
 }
}

export function actionSkill(action){return skillFor[action]}

export function arrivalDistance(action){
 return action===ACTION.FIGHT||action===ACTION.HUNT?.75:action===ACTION.SOCIAL||action===ACTION.CARE?1.05:.72;
}

export function stateForAction(action){
 if(action===ACTION.SLEEP)return NPC_STATE.SLEEPING;
 if([ACTION.SOCIAL,ACTION.CARE,ACTION.FIGHT].includes(action))return NPC_STATE.INTERACTING;
 return NPC_STATE.WORKING;
}

export function taskDurationFor(sim,i,action,intent=null){
 const n=sim.npcs;
 const base=(baseAt720[action]??30)*(DAY_TICKS/720);
 const sk=actionSkill(action),skill=sk==null?0:n.skill(i,sk);
 const toolBonus=toolDurationBonus(n.tool[i],action);
 const fatiguePenalty=(1-n.stamina[i])*.8;
 const difficulty=Math.max(.45,intent?.difficulty??difficultyFor[action]??1);
 return Math.max(1,Math.round(base/(.4+skill*.9)/(1+toolBonus)*(1+fatiguePenalty)*difficulty));
}

function toolDurationBonus(tool,action){
 if(action===ACTION.WOOD)return tool===TOOL.AXE?.8:0;
 if(action===ACTION.STONE||action===ACTION.IRON)return tool===TOOL.PICK?.8:0;
 if(action===ACTION.BUILD)return tool===TOOL.HAMMER?.55:0;
 if(action===ACTION.FISH)return tool===TOOL.ROD?.7:0;
 if(action===ACTION.HUNT)return tool===TOOL.BOW?.45:tool===TOOL.KNIFE?.15:0;
 if(action===ACTION.FIGHT)return tool===TOOL.SWORD?.35:tool===TOOL.BOW?.2:0;
 if(action===ACTION.COOK)return tool===TOOL.KNIFE?.2:0;
 return 0;
}

export function readTargetProgress(sim,i,int=sim.npcs.intent[i]){
 if(!int)return 0;
 const w=sim.world,a=int.action;
 if(a===ACTION.BUILD){
  const bp=w.blueprints[int.meta.blueprint],p=bp?.pieces[int.meta.pieceIndex];
  return p?.done?1:(p?.progress||0);
 }
 if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){
  const r=resourceTarget(sim,int);
  return r?.workProgress||0;
 }
 if([ACTION.FARM,ACTION.FORGE,ACTION.COOK,ACTION.TAILOR].includes(a)){
  const b=w.buildings.find(x=>x.id===int.targetId);
  return b?.workProgress?.[a]||0;
 }
 return 0;
}

export function writeTargetProgress(sim,i,int=sim.npcs.intent[i],value=sim.npcs.taskProgress[i]){
 if(!int)return;
 const w=sim.world,a=int.action,v=Math.max(0,Math.min(1,value||0));
 if(a===ACTION.BUILD){
  const bp=w.blueprints[int.meta.blueprint],p=bp?.pieces[int.meta.pieceIndex];
  if(p&&!p.done)p.progress=Math.max(p.progress||0,v);
  return;
 }
 if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){
  const r=resourceTarget(sim,int);
  if(r)r.workProgress=Math.max(r.workProgress||0,v);
  return;
 }
 if([ACTION.FARM,ACTION.FORGE,ACTION.COOK,ACTION.TAILOR].includes(a)){
  const b=w.buildings.find(x=>x.id===int.targetId);
  if(b){
   b.workProgress=b.workProgress||{};
   b.workProgress[a]=Math.max(b.workProgress[a]||0,v);
  }
 }
}

export function clearTargetProgress(sim,int){
 if(!int)return;
 const w=sim.world,a=int.action;
 if(a===ACTION.BUILD){
  const bp=w.blueprints[int.meta.blueprint],p=bp?.pieces[int.meta.pieceIndex];
  if(p&&!p.done)p.progress=0;
  return;
 }
 if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){
  const r=resourceTarget(sim,int);
  if(r)r.workProgress=0;
  return;
 }
 if([ACTION.FARM,ACTION.FORGE,ACTION.COOK,ACTION.TAILOR].includes(a)){
  const b=w.buildings.find(x=>x.id===int.targetId);
  if(b?.workProgress)b.workProgress[a]=0;
 }
}

function resourceTarget(sim,int){
 const w=sim.world;
 const byId=int.targetId>=0?w.resources[int.targetId]:null;
 if(byId&&byId.kind===int.targetKind)return byId;
 return w.findResourceAt(int.sourceX,int.sourceY,int.targetKind,1.4);
}

function equip(sim,i,tool){
 if(!tool)return;
 const n=sim.npcs,w=sim.world;
 if(n.tool[i]===tool)return;
 if(w.tools[tool]>0){
  if(n.tool[i])w.tools[n.tool[i]]++;
  w.tools[tool]--;
  n.tool[i]=tool;
 }
}

function passablePoint(w,x,y){
 x=Math.max(1,Math.min(78,x));y=Math.max(1,Math.min(78,y));
 if(w.tile(x,y)!==TILE_TYPE.WATER&&w.tile(x,y)!==TILE_TYPE.MOUNTAIN)return{x,y};
 for(let r=1;r<5;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const nx=Math.floor(x)+dx+.5,ny=Math.floor(y)+dy+.5,t=w.tile(nx,ny);
  if(t!==TILE_TYPE.WATER&&t!==TILE_TYPE.MOUNTAIN)return{x:nx,y:ny};
 }
 return{x:w.settlement.x,y:w.settlement.y};
}

function approach(w,x,y){
 const t=w.tile(x,y);
 if(t!==TILE_TYPE.WATER&&t!==TILE_TYPE.MOUNTAIN)return{x,y};
 for(let r=1;r<=2;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  const nx=Math.floor(x)+dx+.5,ny=Math.floor(y)+dy+.5,tt=w.tile(nx,ny);
  if(tt!==TILE_TYPE.WATER&&tt!==TILE_TYPE.MOUNTAIN)return{x:nx,y:ny};
 }
 return{x:w.settlement.x,y:w.settlement.y};
}

function exploreTarget(sim,i){
 const n=sim.npcs,w=sim.world,m=sim.memory,s=m.spatial.get(i);
 for(let tries=0;tries<24;tries++){
  const a=sim.rng.range(0,Math.PI*2),d=sim.rng.range(7,16),x=n.x[i]+Math.cos(a)*d,y=n.y[i]+Math.sin(a)*d;
  if(!w.inside(x,y))continue;
  const t=w.idx(x,y);let known=false;
  if(s)for(let k=0;k<s.count;k++)if(s.tiles[k]===t){known=true;break}
  if(!known)return passablePoint(w,x,y);
 }
 const a=sim.rng.range(0,Math.PI*2);
 return passablePoint(w,n.x[i]+Math.cos(a)*10,n.y[i]+Math.sin(a)*10);
}

function nextBuildingType(sim){
 const w=sim.world;
 if(!w.buildings.some(b=>b.type===BUILDING.FARM))return BUILDING.FARM;
 if(!w.buildings.some(b=>b.type===BUILDING.FORGE))return BUILDING.FORGE;
 if(!w.buildings.some(b=>b.type===BUILDING.WORKSHOP))return BUILDING.WORKSHOP;
 if(!w.buildings.some(b=>b.type===BUILDING.COOP))return BUILDING.COOP;
 return BUILDING.SHELTER;
}

function buildSpot(sim){
 const w=sim.world;
 for(let k=0;k<30;k++){
  const a=sim.rng.range(0,Math.PI*2),d=sim.rng.range(5,12),x=Math.round(w.settlement.x+Math.cos(a)*d),y=Math.round(w.settlement.y+Math.sin(a)*d);
  if(w.tile(x,y)===TILE_TYPE.GRASS||w.tile(x,y)===TILE_TYPE.TRAIL)return{x,y};
 }
 return{x:Math.round(w.settlement.x+6),y:Math.round(w.settlement.y+6)};
}
