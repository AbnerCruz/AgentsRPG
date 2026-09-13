import {RNG} from './core/rng.js';
import {VERSION,DAY_TICKS,BUILDING,GENE,RESOURCE,ACTION,TOOL,NPC_STATE,MAX_NPCS} from './core/constants.js';
import {dayOf,dayPhase,season,isNight} from './core/clock.js';
import {World} from './world/world.js';
import {NPCStore} from './entities/npcs.js';
import {MemorySystem} from './ai/memory.js';
import {perceive} from './ai/perception.js';
import {updateNeeds} from './ai/drives.js';
import {scoreActions,chooseAction} from './ai/utility.js';
import {planFor} from './ai/planner.js';
import {prepareAction,abortIntent,taskDurationFor} from './systems/actions.js';
import {executeTick,executeDistant} from './systems/executor.js';
import {AnimalSystem} from './systems/animals.js';
import {socialTick,reproductionTick} from './systems/social.js';
import {lifecycleTick} from './systems/lifecycle.js';
import {updateProfessions} from './systems/professions.js';
import {Dungeon} from './dungeon/dungeon.js';

const REVIEW_TICKS=120;
const NEAR_RADIUS=18;
const MEDIUM_RADIUS=NEAR_RADIUS*3;

export class Simulation{
 constructor(seed=1){
  this.version=VERSION;
  this.seed=seed>>>0;
  this.rng=new RNG(this.seed);
  this.tick=0;
  this.world=new World(this.rng,this.seed);
  this.npcs=new NPCStore();
  this.memory=new MemorySystem();
  this.animals=new AnimalSystem(this.rng,this.world);
  this.dungeon=new Dungeon(this.rng,this.world);
  this.chronicle=[];
  this.populationHistory=[];
  this.geneHistory=[];
  this.bubbles=[];
  this.actionHistogram={};
  this.travel={started:0,completed:0,abandoned:0,byAction:{},completedByAction:{},abandonedByAction:{}};
  this.tasks={started:0,completed:0,failed:0,byAction:{},completedByAction:{},failedByAction:{}};
  this.lastPerception=Array(MAX_NPCS).fill(null);
  this.viewX=this.world.settlement.x;
  this.viewY=this.world.settlement.y;
  this.initPopulation();
 }

 initPopulation(){
  const{x,y}=this.world.settlement;
  for(let k=0;k<12;k++){
   const tool=k<2?TOOL.AXE:k<4?TOOL.PICK:k===4?TOOL.HAMMER:TOOL.NONE;
   const i=this.npcs.create(this.rng,x+this.rng.range(-3,3),y+this.rng.range(-3,3),{tool});
   this.memory.ensure(i,this.memory.spatialCapacity(this.npcs,i));
   this.memory.learn(i,{key:'vila',text:'Nosso assentamento é o ponto de encontro da comunidade.',tick:0,confidence:.9});
  }
  this.log('fundação','Doze pessoas ergueram um acampamento onde água, madeira e pedra estavam ao alcance.',.95);
 }

 log(type,text,importance=.5,npc=-1){
  this.chronicle.push({type,text,importance,npc,tick:this.tick,day:dayOf(this.tick)});
  if(this.chronicle.length>1000)this.chronicle.shift();
 }

 addBubble(npc,type,text,importance=.5){
  this.bubbles.push({npc,type,text,importance,born:this.tick,until:this.tick+Math.round(70+importance*80)});
  this.bubbles=this.bubbles.filter(b=>b.until>this.tick).sort((a,b)=>b.importance-a.importance).slice(0,12);
 }

 nearestVisibleNPC(i,rad=8){
  const n=this.npcs;let best=-1,bd=rad;
  for(const j of n.living())if(j!==i){
   const d=Math.hypot(n.x[j]-n.x[i],n.y[j]-n.y[i]);
   if(d<bd){bd=d;best=j}
  }
  return best;
 }

 nearestWounded(i,rad=8){
  const n=this.npcs;let best=-1,bd=rad;
  for(const j of n.living())if(j!==i&&n.wound[j]>.12){
   const d=Math.hypot(n.x[j]-n.x[i],n.y[j]-n.y[i]);
   if(d<bd){bd=d;best=j}
  }
  return best;
 }

 executionLOD(i){
  const n=this.npcs,d=Math.hypot(n.x[i]-this.viewX,n.y[i]-this.viewY);
  return d<=NEAR_RADIUS?0:d<=MEDIUM_RADIUS?1:2;
 }

 step(){
  this.tick++;
  const n=this.npcs;
  n.beginFrame();
  this.world.pathfinder.beginTick?.(3);
  this.world.tick(this.tick);
  this.dungeon.tick(this);
  this.animals.step(this);
  this.handleMonsters();

  for(const i of n.living()){
   let p=this.lastPerception[i];
   const shouldSense=!p||n.state[i]===NPC_STATE.IDLE||this.tick%4===i%4;
   if(shouldSense)p=this.lastPerception[i]=perceive(this,i);
   updateNeeds(this,i,p?.threat||0);

   if(n.age[i]<16){
    this.childStep(i);
    continue;
   }

   const hadTask=!!n.intent[i];
   let deferDecision=false;
   if(n.intent[i]&&this.shouldInterrupt(i,p)){abortIntent(this,i,'emergência imediata');deferDecision=true}

   if(n.intent[i]&&this.tick-(n.intent[i].lastReview??n.intent[i].started)>=REVIEW_TICKS){
    this.reviewTask(i,p);
   }

   if(n.intent[i]){
    this.executeCurrentTask(i);
    if(hadTask&&!n.intent[i])deferDecision=true;
   }

   if(!n.intent[i]&&!deferDecision)this.decide(i,p);

   if(this.tick%(DAY_TICKS*2)===i%(DAY_TICKS*2))this.memory.reflect(i,this.tick);
   this.autoDeposit(i);
  }

  socialTick(this);
  reproductionTick(this);
  lifecycleTick(this);
  if(this.tick%DAY_TICKS===0){
   for(const i of n.living())updateProfessions(n,i);
   this.snapshotStats();
  }
  this.bubbles=this.bubbles.filter(b=>b.until>this.tick);
 }

 executeCurrentTask(i){
  const n=this.npcs,int=n.intent[i];
  if(!int)return;
  const lod=this.executionLOD(i);

  if(lod===2){
   executeDistant(this,i);
   return;
  }

  if(int.analytic){
   delete int.analytic;
   int.lastExecTick=this.tick-(lod===1?4:1);
  }

  const last=int.lastExecTick??int.started;
  const elapsed=Math.max(0,this.tick-last);
  if(lod===1){
   if(elapsed<4)return;
   int.lastExecTick=this.tick;
   executeTick(this,i,Math.min(8,elapsed));
   n.prevX[i]=n.x[i];n.prevY[i]=n.y[i];
  }else{
   int.lastExecTick=this.tick;
   executeTick(this,i,Math.max(1,Math.min(2,elapsed||1)));
  }
 }

 shouldInterrupt(i,p){
  const n=this.npcs,int=n.intent[i];
  if(!int)return false;
  const thirst=n.need(i,1),hunger=n.need(i,0);
  const committedSurvival=[ACTION.WATER,ACTION.FORAGE,ACTION.EAT,ACTION.DRINK].includes(int.action);
  if(!committedSurvival&&thirst>.88&&![ACTION.DRINK,ACTION.WATER].includes(int.action))return true;
  if(!committedSurvival&&hunger>.91&&![ACTION.EAT,ACTION.FORAGE].includes(int.action))return true;
  if(!p?.target||int.action===ACTION.FIGHT||int.action===ACTION.FLEE)return false;
  const survival=[ACTION.EAT,ACTION.DRINK,ACTION.WATER,ACTION.FORAGE,ACTION.SLEEP].includes(int.action);
  const threshold=(survival?.92:.48)+n.gene(i,GENE.STUBBORN)*.18-n.gene(i,GENE.CAUTION)*.12;
  return p.threat>threshold;
 }

 reviewTask(i,p){
  const n=this.npcs,int=n.intent[i];
  if(!int)return;
  int.lastReview=this.tick;
  const scores=scoreActions(this,i,p||{radius:6,threat:0,target:null});
  const current=scores.find(x=>x[0]===int.action);
  if(current){
   const inertia=1+n.gene(i,GENE.STUBBORN)*.55+n.taskProgress[i]*.9;
   current[1]*=inertia;
   scores.sort((a,b)=>b[1]-a[1]);
  }
  n.scores[i]=scores.slice(0,5);
  let goal=chooseAction(this,i,scores);
  if(p?.threat>.5){
   const flee=scores.find(x=>x[0]===ACTION.FLEE)?.[1]||0;
   const fight=scores.find(x=>x[0]===ACTION.FIGHT)?.[1]||0;
   goal=flee>fight?ACTION.FLEE:ACTION.FIGHT;
  }
  if(goal===int.action)return;
  abortIntent(this,i,'reavaliação de tarefa longa');
  n.plan[i]=planFor(this,i,goal);
  if(!prepareAction(this,i,goal,p||{radius:6,threat:0,target:null})&&goal!==ACTION.EXPLORE){
   prepareAction(this,i,ACTION.EXPLORE,p||{radius:6,threat:0,target:null});
  }
 }

 decide(i,p){
  const n=this.npcs,scores=scoreActions(this,i,p||{radius:6,threat:0,target:null});
  n.scores[i]=scores.slice(0,5);
  let goal=chooseAction(this,i,scores);
  if(p?.threat>.5){
   const flee=scores.find(x=>x[0]===ACTION.FLEE)?.[1]||0;
   const fight=scores.find(x=>x[0]===ACTION.FIGHT)?.[1]||0;
   goal=flee>fight?ACTION.FLEE:ACTION.FIGHT;
  }
  n.plan[i]=planFor(this,i,goal);
  if(!prepareAction(this,i,goal,p||{radius:6,threat:0,target:null})&&goal!==ACTION.EXPLORE){
   prepareAction(this,i,ACTION.EXPLORE,p||{radius:6,threat:0,target:null});
  }
 }

 childStep(i){
  const n=this.npcs,p=n.parents[i];let guardian=-1;
  for(const uid of p||[]){
   const idx=n.indexByUid(uid);
   if(idx>=0&&n.alive[idx]){guardian=idx;break}
  }
  if(guardian<0)guardian=n.living().find(x=>x!==i&&n.age[x]>=18)??-1;
  if(guardian>=0){
   const dx=n.x[guardian]-n.x[i],dy=n.y[guardian]-n.y[i],d=Math.hypot(dx,dy);
   if(d>2){
    const step=Math.min(.035,d);
    n.x[i]+=dx/d*step;n.y[i]+=dy/d*step;n.moving[i]=1;n.state[i]=NPC_STATE.MOVING;
    n.facing[i]=facingFromVector(dx,dy);n.advanceWalkAnimation(i,step);
   }else n.state[i]=NPC_STATE.INTERACTING;
   if(this.tick%60===i%60)this.memory.shareSpatial(guardian,i,this.rng,this.tick,this.memory.spatialCapacity(n,i));
   if(n.age[i]>=8&&this.rng.chance(.008)){
    let best=0;for(let s=1;s<14;s++)if(n.skill(guardian,s)>n.skill(guardian,best))best=s;
    n.addSkill(i,best,.0008);
   }
  }else n.state[i]=NPC_STATE.IDLE;
  n.action[i]=n.age[i]<8?'brincando perto da família':'aprendendo com os adultos';
  if(n.need(i,0)>.62){const f=this.world.consumeFood(this.tick);if(f)n.setNeed(i,0,n.need(i,0)-.55)}
  if(n.need(i,1)>.62&&this.world.stock[RESOURCE.WATER]>.08){this.world.stock[RESOURCE.WATER]-=.07;n.setNeed(i,1,n.need(i,1)-.65)}
  if(n.need(i,2)>.62)n.setNeed(i,2,n.need(i,2)-.004);
 }

 autoDeposit(i,force=false){
  const n=this.npcs,w=this.world,inv=n.inventory[i];
  const near=w.nearBuilding(n.x[i],n.y[i],BUILDING.STORAGE,4)||Math.hypot(n.x[i]-w.settlement.x,n.y[i]-w.settlement.y)<4;
  if(!near&&!force)return;
  for(let k=0;k<inv.length;k++){
   if(inv[k]<=.01)continue;
   if([RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.GRAIN,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK].includes(k)){
    if(near&&inv[k]>.12){const amt=inv[k]-.08;w.addFoodBatch(k,amt,this.tick);inv[k]-=amt}
   }else if(k===RESOURCE.WATER){
    if(near&&inv[k]>.3){const amt=inv[k]-.15;w.stock[k]+=amt;inv[k]-=amt}
   }else if(near&&inv[k]>.18){const amt=inv[k]-.08;w.stock[k]+=amt;inv[k]-=amt}
  }
 }

 handleMonsters(){
  const n=this.npcs,w=this.world,night=isNight(this.tick);
  for(const m of w.monsters)if(m.hp>0&&night){
   let best=-1,bd=9;
   for(const i of n.living()){
    const d=Math.hypot(n.x[i]-m.x,n.y[i]-m.y);
    if(d<bd){bd=d;best=i}
   }
   if(best>=0){
    if(bd>.7){m.x+=(n.x[best]-m.x)/(bd||1)*.055;m.y+=(n.y[best]-m.y)/(bd||1)*.055}
    else if(this.rng.chance(.035)){
     n.wound[best]=Math.min(1,n.wound[best]+.02+m.power*.025);
     n.hp[best]-=.002+m.power*.005;
     this.memory.remember(best,{type:'ataque',text:'Uma criatura noturna me atacou.',tick:this.tick,valence:-7,importance:.8,reflectionKey:`dungeon:${m.origin}`});
    }
   }
  }
 }

 snapshotStats(){
  const alive=this.npcs.living();
  this.populationHistory.push({day:dayOf(this.tick),value:alive.length});
  const genes=[GENE.AGGRESSION,GENE.CAUTION,GENE.AMBITION,GENE.EMPATHY].map(g=>alive.length?alive.reduce((s,i)=>s+this.npcs.gene(i,g),0)/alive.length:0);
  this.geneHistory.push({day:dayOf(this.tick),values:genes});
  if(this.populationHistory.length>360)this.populationHistory.shift();
  if(this.geneHistory.length>360)this.geneHistory.shift();
 }

 meta(){return{day:dayOf(this.tick),phase:dayPhase(this.tick),season:season(this.tick)}}

 serialize(){
  return{
   version:VERSION,savedAt:Date.now(),seed:this.seed,rngState:this.rng.state,tick:this.tick,
   world:this.world.serialize(),npcs:this.npcs.serialize(),memory:this.memory.serialize(),animals:this.animals.serialize(),
   dungeon:this.dungeon.serialize(),chronicle:this.chronicle,populationHistory:this.populationHistory,geneHistory:this.geneHistory,
   actionHistogram:this.actionHistogram,travel:this.travel,tasks:this.tasks
  };
 }

 static hydrate(d){
  if(!d||!d.seed)return new Simulation(1);
  const s=Object.create(Simulation.prototype);
  s.version=VERSION;s.seed=d.seed>>>0;s.rng=new RNG(s.seed);s.rng.state=d.rngState??s.rng.state;s.tick=d.tick||0;
  s.world=World.hydrate(d.world||{},s.rng,s.seed);
  s.npcs=NPCStore.hydrate(d.npcs||{});
  // Routes are ephemeral: rebuild only routes that were already acquired when the save was made.
  for(const i of s.npcs.living()){
   const int=s.npcs.intent[i];
   if(!int)continue;
   if(!s.npcs.taskDuration[i])s.npcs.taskDuration[i]=taskDurationFor(s,i,int.action,int);
   if(!s.npcs.taskTimeout[i])s.npcs.taskTimeout[i]=s.tick+Math.max(180,Math.ceil(s.npcs.taskDuration[i]*3)+240);
   if(!int.pathReady||s.npcs.state[i]!==NPC_STATE.MOVING)continue;
   const points=s.world.pathfinder.find(s.npcs.x[i],s.npcs.y[i],int.targetX,int.targetY),flat=[];
   for(const p of points)flat.push(Math.floor(p[0]),Math.floor(p[1]));
   s.npcs.setRoute(i,Int16Array.from(flat));
  }
  if((d.version||1)<3){
   for(let i=0;i<s.npcs.count;i++){
    s.npcs.parents[i]=(s.npcs.parents[i]||[-1,-1]).map(x=>x>=0?x+1:0);
    s.npcs.children[i]=(s.npcs.children[i]||[]).map(x=>x+1);
   }
  }
  s.memory=MemorySystem.hydrate(d.memory);
  for(const i of s.npcs.living())s.memory.ensure(i,s.memory.spatialCapacity(s.npcs,i));
  s.animals=AnimalSystem.hydrate(d.animals,s.rng,s.world);
  if(!d.animals)s.animals=new AnimalSystem(s.rng,s.world);
  s.dungeon=Dungeon.hydrate(d.dungeon,s.rng,s.world);
  s.chronicle=d.chronicle||[];s.populationHistory=d.populationHistory||[];s.geneHistory=d.geneHistory||[];s.bubbles=[];
  s.actionHistogram=d.actionHistogram||{};
  s.travel=d.travel||{started:0,completed:0,abandoned:0,byAction:{},completedByAction:{},abandonedByAction:{}};
  s.travel.completedByAction=s.travel.completedByAction||{};s.travel.abandonedByAction=s.travel.abandonedByAction||{};
  s.tasks=d.tasks||{started:0,completed:0,failed:0,byAction:{},completedByAction:{},failedByAction:{}};
  s.tasks.byAction=s.tasks.byAction||{};s.tasks.completedByAction=s.tasks.completedByAction||{};s.tasks.failedByAction=s.tasks.failedByAction||{};
  s.lastPerception=Array(MAX_NPCS).fill(null);
  s.viewX=s.world.settlement.x;s.viewY=s.world.settlement.y;
  if(d.rngState!=null)s.rng.state=d.rngState;
  return s;
 }
}

function facingFromVector(dx,dy){
 let oct=Math.round(Math.atan2(dx,-dy)/(Math.PI/4));
 if(oct<0)oct+=8;
 return oct&7;
}
