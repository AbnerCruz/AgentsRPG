import {ACTION,RESOURCE,NEED,BUILDING,TOOL,ARMOR,NUTRITION,NPC_STATE,TILE_TYPE} from '../core/constants.js';
import {
 finishIntent,actionSkill,arrivalDistance,stateForAction,taskDurationFor,
 readTargetProgress,writeTargetProgress,clearTargetProgress
} from './actions.js';
import {socialLine} from '../narrative/templates.js';

const workActions=new Set([
 ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FARM,ACTION.FISH,ACTION.HUNT,
 ACTION.COOK,ACTION.TAILOR,ACTION.FORGE,ACTION.CARE,ACTION.SOCIAL,ACTION.BUILD,ACTION.DUNGEON,ACTION.FIGHT
]);
const analyticActions=new Set([
 ACTION.RETURN,ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FARM,ACTION.FISH,
 ACTION.COOK,ACTION.TAILOR,ACTION.FORGE,ACTION.BUILD,ACTION.EXPLORE,ACTION.DUNGEON
]);

export function executeTick(sim,i,dt=1){
 const n=sim.npcs,w=sim.world,int=n.intent[i];
 if(!int){n.state[i]=NPC_STATE.IDLE;return}
 dt=Math.max(1,dt|0);
 if(n.taskTimeout[i]&&sim.tick>=n.taskTimeout[i])return timeoutTask(sim,i);
 if(!n.taskDuration[i])n.taskDuration[i]=taskDurationFor(sim,i,int.action,int);

 const a=int.action;
 if(a===ACTION.DUNGEON)consumeTravelSupplies(sim,i);
 if(dynamicTarget(sim,i,int)===false){finishIntent(sim,i,false);return}

 const distance=Math.hypot(int.targetX-n.x[i],int.targetY-n.y[i]);
 if(distance>arrivalDistance(a)){
  n.state[i]=NPC_STATE.MOVING;
  moveAlongRoute(sim,i,int,dt);
  return;
 }

 if(n.state[i]===NPC_STATE.MOVING){
  n.state[i]=stateForAction(a);
  n.clearRoute(i);
  w.pathfinder.cancel?.(i);
 }
 n.moving[i]=0;

 if(a===ACTION.EAT)return eat(sim,i);
 if(a===ACTION.DRINK)return drink(sim,i);
 if(a===ACTION.IDLE){finishIntent(sim,i,true);return}
 if(a===ACTION.SLEEP)return sleep(sim,i,dt);
 if(a===ACTION.WARM)return warm(sim,i,dt);
 if(a===ACTION.FLEE){n.setNeed(i,NEED.SAFETY,n.need(i,NEED.SAFETY)-.35);finishIntent(sim,i,true);return}
 if(a===ACTION.EXPLORE||a===ACTION.RETURN){finishIntent(sim,i,true);return}

 progressWork(sim,i,int,dt);
}

export function executeDistant(sim,i){
 const n=sim.npcs,int=n.intent[i];
 if(!int){n.state[i]=NPC_STATE.IDLE;return}
 if(n.taskTimeout[i]&&sim.tick>=n.taskTimeout[i])return timeoutTask(sim,i);

 // Moving targets and survival actions stay coarse-grained rather than being guessed analytically.
 if(!analyticActions.has(int.action)){
  const last=int.lastExecTick??int.started,elapsed=Math.max(0,sim.tick-last);
  if(elapsed>=8){int.lastExecTick=sim.tick;executeTick(sim,i,Math.min(12,elapsed))}
  return;
 }

 if(!n.taskDuration[i])n.taskDuration[i]=taskDurationFor(sim,i,int.action,int);
 const targetChanged=int.analytic&&Math.hypot(int.analytic.targetX-int.targetX,int.analytic.targetY-int.targetY)>.75;
 if(!int.analytic||targetChanged){
  const dist=sim.world.pathfinder.estimateDistance(n.x[i],n.y[i],int.targetX,int.targetY);
  const travelTicks=Math.max(0,Math.ceil(Math.max(0,dist-arrivalDistance(int.action))/Math.max(.012,movementSpeed(sim,i))));
  const startProgress=Math.max(n.taskProgress[i],readTargetProgress(sim,i,int));
  const workTicks=Math.max(1,Math.ceil((1-startProgress)*n.taskDuration[i]));
  int.analytic={
   started:sim.tick,fromX:n.x[i],fromY:n.y[i],targetX:int.targetX,targetY:int.targetY,
   arrivalTick:sim.tick+travelTicks,finishTick:sim.tick+travelTicks+workTicks,
   workTicks,startProgress
  };
 }

 const a=int.analytic;
 if(sim.tick<a.arrivalTick){
  n.state[i]=NPC_STATE.MOVING;
  return;
 }

 if(n.state[i]===NPC_STATE.MOVING){
  n.x[i]=int.targetX;
  n.y[i]=int.targetY;
  n.prevX[i]=n.x[i];n.prevY[i]=n.y[i];
  n.taskTargetX[i]=int.targetX;
  n.taskTargetY[i]=int.targetY;
  n.state[i]=stateForAction(int.action);
  n.clearRoute(i);
 }

 if(sim.tick<a.finishTick){
  const span=Math.max(1,a.finishTick-a.arrivalTick),f=Math.max(0,Math.min(1,(sim.tick-a.arrivalTick)/span));
  n.taskProgress[i]=a.startProgress+(1-a.startProgress)*f;
  writeTargetProgress(sim,i,int,n.taskProgress[i]);
  return;
 }

 n.taskProgress[i]=a.startProgress;
 delete int.analytic;
 if(int.action===ACTION.DUNGEON)consumeTravelSupplies(sim,i);
 if(int.action===ACTION.EXPLORE||int.action===ACTION.RETURN){finishIntent(sim,i,true);return}
 progressWork(sim,i,int,a.workTicks);
}

function progressWork(sim,i,int,dt){
 const n=sim.npcs,a=int.action;
 if(!validateWorkTarget(sim,i,int)){finishIntent(sim,i,false);return}

 const shared=readTargetProgress(sim,i,int);
 if(shared>n.taskProgress[i])n.taskProgress[i]=shared;

 const sk=actionSkill(a),skill=sk==null?0:n.skill(i,sk);
 n.taskProgress[i]=Math.min(1,n.taskProgress[i]+dt/Math.max(1,n.taskDuration[i]));

 if(workActions.has(a)){
  n.stamina[i]=Math.max(0,n.stamina[i]-.0008*dt*(1.1-skill*.25));
  if(sk!=null)n.addSkill(i,sk,.00013*dt);
  n.advanceWorkAnimation(i,dt);
 }
 writeTargetProgress(sim,i,int,n.taskProgress[i]);
 if(n.taskProgress[i]<1)return;
 resolveWork(sim,i,int);
}

function timeoutTask(sim,i){
 const int=sim.npcs.intent[i];
 if(int)sim.memory.remember(i,{
  type:'falha',text:`Desisti de ${int.action} porque a tarefa demorou além do esperado.`,
  tick:sim.tick,valence:-1,importance:.2,reflectionKey:'timeout de tarefa'
 });
 finishIntent(sim,i,false);
}

function validateWorkTarget(sim,i,int){
 const w=sim.world,a=int.action;
 if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){
  return !!resourceTarget(sim,int);
 }
 if(a===ACTION.BUILD){
  const bp=w.blueprints[int.meta.blueprint],p=bp?.pieces[int.meta.pieceIndex];
  return !!p&&!p.done;
 }
 if(a===ACTION.FARM)return !!w.buildings.find(b=>b.id===int.targetId&&b.finished);
 if(a===ACTION.FORGE||a===ACTION.COOK||a===ACTION.TAILOR)return int.targetId<0||!!w.buildings.find(b=>b.id===int.targetId&&b.finished);
 return true;
}

function dynamicTarget(sim,i,int){
 const n=sim.npcs;
 let x=int.targetX,y=int.targetY;
 if(int.action===ACTION.SOCIAL||int.action===ACTION.CARE){
  if(int.targetId<0||!n.alive[int.targetId])return false;
  x=n.x[int.targetId];y=n.y[int.targetId];
 }else if(int.action===ACTION.HUNT){
  const a=sim.animals.byId(int.targetId);
  if(!a)return false;
  x=a.x;y=a.y;
 }else if(int.action===ACTION.FIGHT){
  const t=int.meta.targetType==='animal'?sim.animals.byId(int.targetId):sim.world.monsters.find(m=>m.id===int.targetId&&m.hp>0);
  if(!t)return false;
  x=t.x;y=t.y;
 }
 if(Math.hypot(x-int.targetX,y-int.targetY)>.7){
  int.targetX=x;int.targetY=y;
  n.taskTargetX[i]=x;n.taskTargetY[i]=y;
  n.clearRoute(i);
  int.pathReady=false;
  sim.world.pathfinder.cancel?.(i);
  if(int.analytic)delete int.analytic;
 }else{
  int.targetX=x;int.targetY=y;
  n.taskTargetX[i]=x;n.taskTargetY[i]=y;
 }
 return true;
}

function moveAlongRoute(sim,i,int,dt){
 const n=sim.npcs,w=sim.world;
 let route=n.getRoute(i),ri=n.pathIndex[i];
 if(!route||ri*2>=route.length){
  route=w.pathfinder.request(i,n.x[i],n.y[i],int.targetX,int.targetY);
  if(route==null)return;
  n.setRoute(i,route);
  int.pathReady=true;
  ri=0;
  if(!route.length){
   const d=Math.hypot(int.targetX-n.x[i],int.targetY-n.y[i]);
   if(d>1.5){finishIntent(sim,i,false);return}
  }
 }

 let budget=movementSpeed(sim,i)*dt,moved=0;
 while(budget>.0001){
  route=n.getRoute(i);
  ri=n.pathIndex[i];
  let tx,ty;
  if(route&&ri*2<route.length){
   tx=route[ri*2]+.5;ty=route[ri*2+1]+.5;
  }else{
   tx=int.targetX;ty=int.targetY;
  }
  const dx=tx-n.x[i],dy=ty-n.y[i],d=Math.hypot(dx,dy);
  if(d<.08){
   if(route&&ri*2<route.length){n.pathIndex[i]++;continue}
   break;
  }
  const step=Math.min(budget,d);
  n.x[i]+=dx/d*step;n.y[i]+=dy/d*step;
  moved+=step;budget-=step;
  n.facing[i]=facingFromVector(dx,dy);
  if(step<d)break;
  if(route&&ri*2<route.length)n.pathIndex[i]++;
  else break;
 }

 if(moved>0){
  n.moving[i]=1;
  n.advanceWalkAnimation(i,moved);
  n.stamina[i]=Math.max(0,n.stamina[i]-.00008*dt);
  w.walkTile(n.x[i],n.y[i],Math.max(.004,moved*.36));
  sim.autoDeposit(i);
 }
 if(Math.hypot(int.targetX-n.x[i],int.targetY-n.y[i])<=arrivalDistance(int.action)){
  n.state[i]=stateForAction(int.action);
  n.clearRoute(i);
  w.pathfinder.cancel?.(i);
 }
}

export function movementSpeed(sim,i){
 const n=sim.npcs,w=sim.world,load=inventoryLoad(n.inventory[i]);
 const terrain=terrainFactor(w,n.x[i],n.y[i]);
 const burden=1-load*.3,stamina=.55+n.stamina[i]*.45,wound=1-n.wound[i]*.45;
 return Math.max(.008,.05*n.derived(i).speed*terrain*burden*stamina*wound);
}

function terrainFactor(w,x,y){
 const t=w.tile(x,y);
 return t===TILE_TYPE.ROAD?1.4:t===TILE_TYPE.TRAIL?1.18:t===TILE_TYPE.FOREST?.75:t===TILE_TYPE.MARSH?.5:t===TILE_TYPE.WATER?.35:(t===TILE_TYPE.STONE||t===TILE_TYPE.MOUNTAIN)?.6:1;
}

function facingFromVector(dx,dy){
 let oct=Math.round(Math.atan2(dx,-dy)/(Math.PI/4));
 if(oct<0)oct+=8;
 return oct&7;
}

function sleep(sim,i,dt){
 const n=sim.npcs;
 n.state[i]=NPC_STATE.SLEEPING;
 n.setNeed(i,NEED.SLEEP,n.need(i,NEED.SLEEP)-.006*dt);
 n.stamina[i]=Math.min(1,n.stamina[i]+.012*dt);
 n.hp[i]=Math.min(1,n.hp[i]+.0008*dt);
 n.taskProgress[i]=Math.min(1,n.taskProgress[i]+dt/Math.max(1,n.taskDuration[i]));
 n.advanceWorkAnimation(i,dt);
 if(n.need(i,NEED.SLEEP)<.16||n.taskProgress[i]>=1)finishIntent(sim,i,true);
}

function warm(sim,i,dt){
 const n=sim.npcs;
 n.setNeed(i,NEED.TEMP,n.need(i,NEED.TEMP)-.008*dt);
 n.taskProgress[i]=Math.min(1,n.taskProgress[i]+dt/Math.max(1,n.taskDuration[i]));
 n.advanceWorkAnimation(i,dt);
 if(n.need(i,NEED.TEMP)<.15||n.taskProgress[i]>=1)finishIntent(sim,i,true);
}

function eat(sim,i){
 const n=sim.npcs,w=sim.world;
 let food=null;
 for(const k of [RESOURCE.BERRY,RESOURCE.GRAIN,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.EGG,RESOURCE.MILK,RESOURCE.PRESERVED])if(n.inventory[i][k]>.1){
  const amount=Math.min(.14,n.inventory[i][k]);n.inventory[i][k]-=amount;food={kind:k,amount};break;
 }
 if(!food)food=w.consumeFood(sim.tick);
 if(!food){finishIntent(sim,i,false);return}
 n.setNeed(i,NEED.HUNGER,n.need(i,NEED.HUNGER)-.58);
 if(food.kind===RESOURCE.BERRY)n.addNutrition(i,NUTRITION.PLANT,.2);
 else if(food.kind===RESOURCE.GRAIN)n.addNutrition(i,NUTRITION.GRAIN,.2);
 else if([RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.EGG,RESOURCE.MILK].includes(food.kind))n.addNutrition(i,NUTRITION.PROTEIN,.22);
 else{n.addNutrition(i,NUTRITION.PROTEIN,.1);n.addNutrition(i,NUTRITION.PLANT,.08)}
 finishIntent(sim,i,true);
}

function drink(sim,i){
 const n=sim.npcs,w=sim.world;
 if(n.inventory[i][RESOURCE.WATER]>.08)n.inventory[i][RESOURCE.WATER]-=.09;
 else if(w.stock[RESOURCE.WATER]>.09)w.stock[RESOURCE.WATER]-=.09;
 else{finishIntent(sim,i,false);return}
 n.setNeed(i,NEED.THIRST,n.need(i,NEED.THIRST)-.72);
 finishIntent(sim,i,true);
}

function resolveWork(sim,i,int){
 const n=sim.npcs,w=sim.world,a=int.action;

 if([ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FISH].includes(a)){
  const r=resourceTarget(sim,int);
  if(!r){
   sim.memory.observe(i,w.idx(int.sourceX,int.sourceY),sim.tick,0,0,sim.memory.spatialCapacity(n,i));
   sim.memory.remember(i,{type:'erro de memória',text:'Fui até um recurso lembrado, mas ele já não estava lá.',tick:sim.tick,valence:-2,importance:.55,reflectionKey:'memória espacial'});
   finishIntent(sim,i,false);return;
  }
  clearTargetProgress(sim,int);
  let amount=a===ACTION.WATER?.7:a===ACTION.FISH?.32:.42+n.skill(i,actionSkill(a)??0)*.3;
  if(a===ACTION.WOOD&&n.tool[i]===TOOL.AXE)amount*=1.45;
  if((a===ACTION.STONE||a===ACTION.IRON)&&n.tool[i]===TOOL.PICK)amount*=1.45;
  const got=w.harvest(r,amount);
  n.inventory[i][int.targetKind]+=got;
  if(a===ACTION.FORAGE)sim.memory.remember(i,{type:'coleta',text:'Encontrei frutos silvestres nesta região.',tick:sim.tick,valence:1,importance:.3,reflectionKey:'comida'});
  finishIntent(sim,i,got>0);
  sim.autoDeposit(i,true);
  return;
 }

 if(a===ACTION.HUNT){
  const prey=sim.animals.byId(int.targetId);
  if(!prey){finishIntent(sim,i,false);return}
  const hit=.18+n.skill(i,3)*.22+(n.tool[i]===TOOL.BOW?.2:n.tool[i]===TOOL.KNIFE?.08:0);
  prey.hp-=hit;
  if(prey.hp<=0){
   sim.animals.killForLoot(sim,prey,i);finishIntent(sim,i,true);
  }else{
   n.taskProgress[i]=0;
   n.taskDuration[i]=taskDurationFor(sim,i,a,int);
   prey.state='fugir';
   int.targetX=prey.x;int.targetY=prey.y;
   n.taskTargetX[i]=prey.x;n.taskTargetY[i]=prey.y;
   n.state[i]=Math.hypot(prey.x-n.x[i],prey.y-n.y[i])>arrivalDistance(a)?NPC_STATE.MOVING:NPC_STATE.WORKING;
   int.pathReady=false;n.clearRoute(i);
  }
  return;
 }

 if(a===ACTION.FARM){
  const farm=w.buildings.find(b=>b.id===int.targetId);
  if(!farm){clearTargetProgress(sim,int);finishIntent(sim,i,false);return}
  farm.crop=farm.crop||{planted:0,ready:0};
  clearTargetProgress(sim,int);
  if(!farm.crop.planted){
   if(w.stock[RESOURCE.SEED]<.15){finishIntent(sim,i,false);return}
   w.stock[RESOURCE.SEED]-=.15;
   farm.crop.planted=sim.tick;farm.crop.ready=sim.tick+840*2;
   sim.addBubble(i,'fala','Plantamos agora. A terra precisa de tempo.',.55);
   finishIntent(sim,i,true);
  }else if(sim.tick>=farm.crop.ready){
   const yieldAmt=1.1+n.skill(i,2)*1.4;
   w.addFoodBatch(RESOURCE.GRAIN,yieldAmt,sim.tick);
   w.stock[RESOURCE.SEED]+=.28+n.skill(i,2)*.08;
   farm.crop={planted:0,ready:0};
   finishIntent(sim,i,true);
  }else finishIntent(sim,i,true);
  return;
 }

 if(a===ACTION.COOK){
  const k=w.stock[RESOURCE.MEAT]>.3?RESOURCE.MEAT:w.stock[RESOURCE.FISH]>.3?RESOURCE.FISH:null;
  clearTargetProgress(sim,int);
  if(k==null||w.stock[RESOURCE.LOG]<.08){finishIntent(sim,i,false);return}
  w.stock[k]-=.3;w.stock[RESOURCE.LOG]-=.08;w.addFoodBatch(RESOURCE.PRESERVED,.28,sim.tick);
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.TAILOR){
  clearTargetProgress(sim,int);
  if(n.armor[i]!==ARMOR.NONE){finishIntent(sim,i,true);return}
  if(w.stock[RESOURCE.LEATHER]>=.6){w.stock[RESOURCE.LEATHER]-=.6;n.armor[i]=ARMOR.LEATHER}
  else if(w.stock[RESOURCE.WOOL]>=.8){w.stock[RESOURCE.WOOL]-=.8;n.armor[i]=ARMOR.CLOTH}
  else{finishIntent(sim,i,false);return}
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.FORGE){
  clearTargetProgress(sim,int);
  if(w.stock[RESOURCE.IRON]<.65||w.stock[RESOURCE.LOG]<.15){finishIntent(sim,i,false);return}
  w.stock[RESOURCE.IRON]-=.65;w.stock[RESOURCE.LOG]-=.15;
  const order=[TOOL.AXE,TOOL.PICK,TOOL.HAMMER,TOOL.SWORD,TOOL.BOW,TOOL.KNIFE,TOOL.ROD],tool=order.sort((x,y)=>w.tools[x]-w.tools[y])[0];
  w.tools[tool]++;
  sim.log('produção',`${n.names[i]} forjou ${['','um machado','uma picareta','um martelo','uma faca','uma vara','um arco','uma espada'][tool]}.`,.6,i);
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.CARE){
  const j=int.targetId;
  if(j<0||!n.alive[j]){finishIntent(sim,i,false);return}
  n.wound[j]=Math.max(0,n.wound[j]-.24-n.skill(i,12)*.2);
  n.infection[j]=Math.max(0,n.infection[j]-.18);
  n.hp[j]=Math.min(1,n.hp[j]+.035);
  sim.memory.adjust(j,i,{trust:.05,affection:.03,debt:.04});
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.SOCIAL){
  const j=int.targetId;
  if(j<0||!n.alive[j]){finishIntent(sim,i,false);return}
  const warmth=.012+n.gene(i,21)*.016;
  sim.memory.adjust(i,j,{affection:warmth,trust:warmth*.65});
  sim.memory.adjust(j,i,{affection:warmth*.75,trust:warmth*.45});
  const shared=sim.rng.chance(1-n.gene(i,18)*.5)?sim.memory.shareSpatial(i,j,sim.rng,sim.tick,sim.memory.spatialCapacity(n,j)):null;
  const belief=(sim.memory.beliefs.get(i)||[]).filter(b=>String(b.key).startsWith('dungeon:')).sort((x,y)=>Math.abs(y.valence)-Math.abs(x.valence))[0];
  if(belief&&sim.rng.chance(.35)){
   sim.memory.learn(j,{key:`rumor:${belief.key}`,text:belief.text,tick:sim.tick,confidence:.5});
   sim.memory.remember(j,{type:'rumor',text:`${n.names[i]} compartilhou uma crença sobre uma dungeon.`,tick:sim.tick,valence:belief.valence*.5,importance:.55,reflectionKey:belief.key});
  }
  const line=socialLine(sim,i,j,shared);
  sim.addBubble(i,'fala',line,.75);
  sim.memory.remember(i,{type:'conversa',text:`Conversei com ${n.names[j]}.`,tick:sim.tick,valence:2,importance:.38,reflectionKey:`pessoa:${j}`});
  sim.memory.remember(j,{type:'conversa',text:`${n.names[i]} conversou comigo.`,tick:sim.tick,valence:2,importance:.38,reflectionKey:`pessoa:${i}`});
  n.setNeed(i,NEED.SOCIAL,n.need(i,NEED.SOCIAL)-.5);
  n.setNeed(j,NEED.SOCIAL,n.need(j,NEED.SOCIAL)-.25);
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.BUILD){
  const bp=w.blueprints[int.meta.blueprint],p=bp?.pieces[int.meta.pieceIndex];
  if(!p||p.done){finishIntent(sim,i,false);return}
  p.progress=1;
  const built=w.completePiece(bp,p);
  if(built)sim.log('construção',`${n.names[i]} concluiu ${BUILDING.NAMES[built.type]}.`,.78,i);
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.DUNGEON){
  sim.dungeon.attempt(sim,i,int.targetId);
  finishIntent(sim,i,true);return;
 }

 if(a===ACTION.FIGHT){
  const t=int.meta.targetType==='animal'?sim.animals.byId(int.targetId):w.monsters.find(m=>m.id===int.targetId&&m.hp>0);
  if(!t){finishIntent(sim,i,true);return}
  const damage=.08+n.derived(i).strength*.06+n.skill(i,10)*.08+(n.tool[i]===TOOL.SWORD?.1:n.tool[i]===TOOL.BOW?.07:0);
  t.hp-=damage;
  if(t.hp<=0){
   if(int.meta.targetType==='animal')sim.animals.killForLoot(sim,t,i);
   else{n.prestige[i]+=2;sim.log('combate',`${n.names[i]} derrotou uma criatura noturna.`,.7,i)}
   finishIntent(sim,i,true);
  }else{
   n.taskProgress[i]=0;
   n.taskDuration[i]=taskDurationFor(sim,i,a,int);
   if(sim.rng.chance(.25)){
    n.wound[i]=Math.min(1,n.wound[i]+.05+(t.power||.2)*.05);
    n.hp[i]-=.008+(t.power||.2)*.015;
   }
  }
  return;
 }

 finishIntent(sim,i,true);
}

function resourceTarget(sim,int){
 const w=sim.world,byId=int.targetId>=0?w.resources[int.targetId]:null;
 if(byId&&byId.kind===int.targetKind&&byId.amount>.01)return byId;
 return w.findResourceAt(int.sourceX,int.sourceY,int.targetKind,1.2);
}

function consumeTravelSupplies(sim,i){
 const n=sim.npcs,inv=n.inventory[i];
 if(n.need(i,NEED.THIRST)>.58&&inv[RESOURCE.WATER]>.06){
  inv[RESOURCE.WATER]-=.06;n.setNeed(i,NEED.THIRST,n.need(i,NEED.THIRST)-.42);
 }
 if(n.need(i,NEED.HUNGER)>.58){
  for(const k of [RESOURCE.BERRY,RESOURCE.GRAIN,RESOURCE.PRESERVED,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.EGG])if(inv[k]>.06){
   inv[k]-=.06;n.setNeed(i,NEED.HUNGER,n.need(i,NEED.HUNGER)-.32);break;
  }
 }
}

function inventoryLoad(inv){
 let s=0;for(let k=0;k<inv.length;k++)s+=inv[k];
 return Math.min(1,s/5);
}
