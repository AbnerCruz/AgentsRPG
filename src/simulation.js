import {RNG} from './core/rng.js';
import {VERSION,DAY_TICKS,BUILDING,GENE,RESOURCE,ACTION,NPC_STATE,MAX_NPCS,TILE_TYPE,MAP_W,MAP_H,TRAVEL_ACTIONS} from './core/constants.js';
import {dayOf,dayPhase,season,isNight} from './core/clock.js';
import {World} from './world/world.js';
import {serializeWorldCompact,hydrateWorldCompact} from './world/persistence.js';
import {NPCStore} from './entities/npcs.js';
import {MemorySystem} from './ai/memory.js';
import {perceive} from './ai/perception.js';
import {updateNeeds} from './ai/drives.js';
import {scoreActions,chooseAction} from './ai/utility.js';
import {planFor} from './ai/planner.js';
import {prepareAction,taskDurationFor} from './systems/actions.js';
import {executeTick,executeDistant} from './systems/executor.js';
import {AnimalSystem} from './systems/animals.js';
import {socialTick,reproductionTick} from './systems/social.js';
import {lifecycleTick} from './systems/lifecycle.js';
import {updateProfessions} from './systems/professions.js';
import {Dungeon} from './dungeon/dungeon.js';
import {TechnologySystem,technologyFor} from './systems/technology.js';
import {SensorySystem} from './systems/senses.js';
import {diseaseTick} from './systems/disease.js';
import {ensureTaskPlanning,performAtomicNeeds,performAtomicAction,handleEmergency,emergencyKind,resumeSuspended,shouldSwitchTask,switchTask,serializeTaskPlanning,hydrateTaskPlanning,preflightLongGoal,pendingGoal,clearPendingGoal} from './systems/task-planning.js';
import './systems/civilization-unlock.js';
import './systems/construction-hardening.js';

const REVIEW_TICKS=120,TRAVEL_REVIEW_TICKS=480,NEAR_RADIUS=18,MEDIUM_RADIUS=NEAR_RADIUS*3;

export class Simulation{
 constructor(seed=1,generated=null){
  this.version=VERSION;this.seed=seed>>>0;this.rng=new RNG(this.seed);this.tick=0;
  this.world=new World(this.rng,this.seed,generated||null);this.npcs=new NPCStore();this.memory=new MemorySystem();
  this.technology=new TechnologySystem(this);this.senses=new SensorySystem();
  this.animals=new AnimalSystem(this.rng,this.world);this.dungeon=new Dungeon(this.rng,this.world);
  this.chronicle=[];this.populationHistory=[];this.geneHistory=[];this.bubbles=[];this.actionHistogram={};
  this.travel={started:0,completed:0,abandoned:0,byAction:{},completedByAction:{},abandonedByAction:{}};
  this.tasks={started:0,completed:0,failed:0,byAction:{},completedByAction:{},failedByAction:{}};
  this.lastPerception=Array(MAX_NPCS).fill(null);ensureTaskPlanning(this);this.initPopulation();const c=populationCenter(this);this.viewX=c.x;this.viewY=c.y;
 }
 initPopulation(){seedPopulation(this,100);this.log('origem','Cem pessoas despertaram dispersas pelo continente sem vila, ferramentas ou conhecimento do mundo.',.98)}
 log(type,text,importance=.5,npc=-1){this.chronicle.push({type,text,importance,npc,tick:this.tick,day:dayOf(this.tick)});if(this.chronicle.length>1200)this.chronicle.shift()}
 addBubble(npc,type,text,importance=.5){this.bubbles.push({npc,type,text,importance,born:this.tick,until:this.tick+Math.round(70+importance*80)});this.bubbles=this.bubbles.filter(b=>b.until>this.tick).sort((a,b)=>b.importance-a.importance).slice(0,12)}
 nearestVisibleNPC(i,rad=8){const p=this.lastPerception[i];if(p?.humans?.length)return p.humans.find(x=>x.d<=rad)?.id??-1;return-1}
 nearestWounded(i,rad=8){const p=this.lastPerception[i];if(p?.wounded?.length)return p.wounded.find(x=>x.d<=rad)?.id??-1;return-1}
 executionLOD(i){const n=this.npcs,d=Math.hypot(n.x[i]-this.viewX,n.y[i]-this.viewY);return d<=NEAR_RADIUS?0:d<=MEDIUM_RADIUS?1:2}
 step(){
  this.tick++;const n=this.npcs;n.beginFrame();this.world.pathfinder.beginTick?.(3);this.world.tick(this.tick);this.senses.tick(this.tick);this.dungeon.tick(this);this.animals.step(this);this.handleMonsters();diseaseTick(this);
  for(const i of n.living()){
   const lod=this.executionLOD(i),senseEvery=lod===0?4:lod===1?8:16;let p=this.lastPerception[i];const shouldSense=!p||this.tick%senseEvery===i%senseEvery;if(shouldSense)p=this.lastPerception[i]=perceive(this,i);updateNeeds(this,i,p?.threat||0);
   if(n.age[i]<16){this.childStep(i);continue}
   performAtomicNeeds(this,i);
   let interrupted=false;
   if(n.intent[i])interrupted=handleEmergency(this,i,p);
   if(interrupted&&!n.intent[i])this.decide(i,p);
   if(n.intent[i]){const reviewEvery=TRAVEL_ACTIONS.has(n.intent[i].action)?TRAVEL_REVIEW_TICKS:REVIEW_TICKS;if(this.tick-(n.intent[i].lastReview??n.intent[i].started)>=reviewEvery)this.reviewTask(i,p)}
   if(n.intent[i])this.executeCurrentTask(i);
   if(!n.intent[i]&&!interrupted){if(!resumeSuspended(this,i))this.decide(i,p)}
   if(this.tick%(DAY_TICKS*2)===i%(DAY_TICKS*2))this.memory.reflect(i,this.tick);
   this.autoDeposit(i);
  }
  socialTick(this);reproductionTick(this);lifecycleTick(this);
  if(this.tick%DAY_TICKS===0){for(const i of n.living())updateProfessions(n,i);this.snapshotStats()}
  this.bubbles=this.bubbles.filter(b=>b.until>this.tick);
 }
 executeCurrentTask(i){const n=this.npcs,int=n.intent[i];if(!int)return;const lod=this.executionLOD(i);if(lod===2){executeDistant(this,i);return}if(int.analytic){delete int.analytic;int.lastExecTick=this.tick-(lod===1?4:1)}const last=int.lastExecTick??int.started,elapsed=Math.max(0,this.tick-last);if(lod===1){if(elapsed<4)return;int.lastExecTick=this.tick;executeTick(this,i,Math.min(8,elapsed));n.prevX[i]=n.x[i];n.prevY[i]=n.y[i]}else{int.lastExecTick=this.tick;executeTick(this,i,Math.max(1,Math.min(2,elapsed||1)))}}
 shouldInterrupt(i,p){return !!emergencyKind(this,i,p)}
 reviewTask(i,p){const n=this.npcs,int=n.intent[i];if(!int)return;int.lastReview=this.tick;const scores=scoreActions(this,i,p||{});n.scores[i]=scores.slice(0,5);let goal=chooseAction(this,i,scores);if(p?.threat>.5){const flee=scores.find(x=>x[0]===ACTION.FLEE)?.[1]||0,fight=scores.find(x=>x[0]===ACTION.FIGHT)?.[1]||0;goal=flee>fight?ACTION.FLEE:ACTION.FIGHT}if(goal===int.action||!shouldSwitchTask(this,i,scores,goal,p))return;switchTask(this,i,goal,p);n.plan[i]=planFor(this,i,goal);if(goal===ACTION.EAT||goal===ACTION.DRINK){if(performAtomicAction(this,i,goal)){resumeSuspended(this,i);return}const fallback=goal===ACTION.DRINK?ACTION.WATER:ACTION.FORAGE;if(!prepareAction(this,i,fallback,p||{}))resumeSuspended(this,i);return}const prep=preflightLongGoal(this,i,goal),actual=prep||goal;if(!prep)clearPendingGoal(this,i,goal);if(!prepareAction(this,i,actual,p||{})&&actual!==ACTION.EXPLORE){if(!resumeSuspended(this,i))prepareAction(this,i,ACTION.EXPLORE,p||{})}}
 decide(i,p){const n=this.npcs,scores=scoreActions(this,i,p||{});n.scores[i]=scores.slice(0,5);let goal=pendingGoal(this,i)||chooseAction(this,i,scores);if(!pendingGoal(this,i)&&p?.threat>.5){const flee=scores.find(x=>x[0]===ACTION.FLEE)?.[1]||0,fight=scores.find(x=>x[0]===ACTION.FIGHT)?.[1]||0;goal=flee>fight?ACTION.FLEE:ACTION.FIGHT}n.plan[i]=planFor(this,i,goal);if(goal===ACTION.EAT||goal===ACTION.DRINK){if(performAtomicAction(this,i,goal))return;const fallback=goal===ACTION.DRINK?ACTION.WATER:ACTION.FORAGE;prepareAction(this,i,fallback,p||{});return}const prep=preflightLongGoal(this,i,goal),actual=prep||goal;if(!prep)clearPendingGoal(this,i,goal);if(!prepareAction(this,i,actual,p||{})&&actual!==ACTION.EXPLORE){clearPendingGoal(this,i,goal);prepareAction(this,i,ACTION.EXPLORE,p||{})}}
 childStep(i){const n=this.npcs,p=n.parents[i];let guardian=-1;for(const uid of p||[]){const idx=n.indexByUid(uid);if(idx>=0&&n.alive[idx]){guardian=idx;break}}if(guardian<0){const near=this.lastPerception[i]?.humans?.find(x=>n.age[x.id]>=18);guardian=near?.id??-1}if(guardian>=0){const dx=n.x[guardian]-n.x[i],dy=n.y[guardian]-n.y[i],d=Math.hypot(dx,dy);if(d>2){const step=Math.min(.035,d);n.x[i]+=dx/d*step;n.y[i]+=dy/d*step;n.moving[i]=1;n.state[i]=NPC_STATE.MOVING;n.facing[i]=facingFromVector(dx,dy);n.advanceWalkAnimation(i,step)}else n.state[i]=NPC_STATE.INTERACTING;if(this.tick%120===i%120){this.memory.shareSpatial(guardian,i,this.rng,this.tick,this.memory.spatialCapacity(n,i));this.technology.inherit(this,guardian,i)}if(n.age[i]>=8&&this.rng.chance(.008)){let best=0;for(let s=1;s<14;s++)if(n.skill(guardian,s)>n.skill(guardian,best))best=s;n.addSkill(i,best,.0008)}if(n.need(i,0)>.62){for(const k of[RESOURCE.BERRY,RESOURCE.GRAIN,RESOURCE.PRESERVED,RESOURCE.MEAT,RESOURCE.FISH])if(n.inventory[guardian][k]>.05){n.inventory[guardian][k]-=.05;n.setNeed(i,0,n.need(i,0)-.42);break}}if(n.need(i,1)>.62&&n.inventory[guardian][RESOURCE.WATER]>.05){n.inventory[guardian][RESOURCE.WATER]-=.05;n.setNeed(i,1,n.need(i,1)-.55)}}else n.state[i]=NPC_STATE.IDLE;n.action[i]=n.age[i]<8?'brincando perto da família':'aprendendo com os adultos';if(n.need(i,2)>.62)n.setNeed(i,2,n.need(i,2)-.004)}
 autoDeposit(i){const n=this.npcs,w=this.world,inv=n.inventory[i],store=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.STORAGE,4,n.uid[i]);if(!store)return;for(let k=0;k<inv.length;k++){if(inv[k]<=.18)continue;const keep=k===RESOURCE.WATER?.25:.12,amt=Math.max(0,inv[k]-keep);if(!amt)continue;if([RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.GRAIN,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK].includes(k))w.addFoodBatch(k,amt,this.tick);else w.stock[k]+=amt;inv[k]-=amt}}
 handleMonsters(){const n=this.npcs,w=this.world,night=isNight(this.tick);for(const m of w.monsters)if(m.hp>0&&night){let best=-1,bd=9;for(const i of n.living()){const d=Math.hypot(n.x[i]-m.x,n.y[i]-m.y);if(d<bd){bd=d;best=i}}if(best>=0){if(bd>.7){m.x+=(n.x[best]-m.x)/(bd||1)*.055;m.y+=(n.y[best]-m.y)/(bd||1)*.055}else if(this.rng.chance(.035)){n.wound[best]=Math.min(1,n.wound[best]+.02+m.power*.025);n.pain[best]=Math.min(1,n.pain[best]+.04);n.hp[best]-=.002+m.power*.005;this.memory.remember(best,{type:'ataque',text:'Uma criatura noturna me atacou.',tick:this.tick,valence:-7,importance:.8,reflectionKey:`dungeon:${m.origin}`});this.senses.emitSound(n.x[best],n.y[best],22,'grito',best,this.tick)}}}}
 snapshotStats(){const alive=this.npcs.living();this.populationHistory.push({day:dayOf(this.tick),value:alive.length});const genes=[GENE.AGGRESSION,GENE.CAUTION,GENE.AMBITION,GENE.EMPATHY].map(g=>alive.length?alive.reduce((s,i)=>s+this.npcs.gene(i,g),0)/alive.length:0);this.geneHistory.push({day:dayOf(this.tick),values:genes});if(this.populationHistory.length>360)this.populationHistory.shift();if(this.geneHistory.length>360)this.geneHistory.shift()}
 meta(){return{day:dayOf(this.tick),phase:dayPhase(this.tick),season:season(this.tick)}}
 serialize(){return{version:VERSION,savedAt:Date.now(),seed:this.seed,rngState:this.rng.state,tick:this.tick,viewX:this.viewX,viewY:this.viewY,world:serializeWorldCompact(this.world),npcs:this.npcs.serialize(),memory:this.memory.serialize(),technology:this.technology.serialize(),senses:this.senses.serialize(),animals:this.animals.serialize(),dungeon:this.dungeon.serialize(),chronicle:this.chronicle,populationHistory:this.populationHistory,geneHistory:this.geneHistory,actionHistogram:this.actionHistogram,travel:this.travel,tasks:this.tasks,taskPlanning:serializeTaskPlanning(this),lastPerception:compactPerceptionCache(this.lastPerception)}}
 static hydrate(d){
  if(!d||!d.seed)return new Simulation(1);const s=Object.create(Simulation.prototype);s.version=VERSION;s.seed=d.seed>>>0;s.rng=new RNG(s.seed);s.rng.state=d.rngState??s.rng.state;s.tick=d.tick||0;s.world=hydrateWorldCompact(d.world||{},s.rng,s.seed);s.npcs=NPCStore.hydrate(d.npcs||{});s.memory=MemorySystem.hydrate(d.memory);for(const i of s.npcs.living())s.memory.ensure(i,s.memory.spatialCapacity(s.npcs,i));s.technology=TechnologySystem.hydrate(d.technology,s);s.senses=SensorySystem.hydrate(d.senses);s.animals=AnimalSystem.hydrate(d.animals,s.rng,s.world);if(!d.animals)s.animals=new AnimalSystem(s.rng,s.world);s.dungeon=Dungeon.hydrate(d.dungeon,s.rng,s.world);
  for(const i of s.npcs.living()){const int=s.npcs.intent[i];if(!int)continue;if(!s.npcs.taskDuration[i])s.npcs.taskDuration[i]=taskDurationFor(s,i,int.action,int);if(!s.npcs.taskTimeout[i])s.npcs.taskTimeout[i]=s.tick+Math.max(180,Math.ceil(s.npcs.taskDuration[i]*3)+240);if(!int.pathReady||s.npcs.state[i]!==NPC_STATE.MOVING||s.npcs.getRoute(i)?.length)continue;const points=s.world.pathfinder.find(s.npcs.x[i],s.npcs.y[i],int.targetX,int.targetY),flat=[];for(const p of points)flat.push(Math.floor(p[0]),Math.floor(p[1]));s.npcs.setRoute(i,Int16Array.from(flat))}
  if((d.version||1)<3)for(let i=0;i<s.npcs.count;i++){s.npcs.parents[i]=(s.npcs.parents[i]||[-1,-1]).map(x=>x>=0?x+1:0);s.npcs.children[i]=(s.npcs.children[i]||[]).map(x=>x+1)}
  s.chronicle=d.chronicle||[];s.populationHistory=d.populationHistory||[];s.geneHistory=d.geneHistory||[];s.bubbles=[];s.actionHistogram=d.actionHistogram||{};s.travel=d.travel||{started:0,completed:0,abandoned:0,byAction:{},completedByAction:{},abandonedByAction:{}};s.travel.completedByAction=s.travel.completedByAction||{};s.travel.abandonedByAction=s.travel.abandonedByAction||{};s.tasks=d.tasks||{started:0,completed:0,failed:0,byAction:{},completedByAction:{},failedByAction:{}};s.tasks.byAction=s.tasks.byAction||{};s.tasks.completedByAction=s.tasks.completedByAction||{};s.tasks.failedByAction=s.tasks.failedByAction||{};s.lastPerception=Array(MAX_NPCS).fill(null);const restored=compactPerceptionCache(d.lastPerception||[]);for(let i=0;i<Math.min(MAX_NPCS,restored.length);i++)s.lastPerception[i]=restored[i]||null;hydrateTaskPlanning(s,d.taskPlanning);const c=populationCenter(s);s.viewX=Number.isFinite(d.viewX)?d.viewX:c.x;s.viewY=Number.isFinite(d.viewY)?d.viewY:c.y;if(d.rngState!=null)s.rng.state=d.rngState;technologyFor(s);return s
 }
}

function seedPopulation(sim,count){const w=sim.world,n=sim.npcs,seeds=w.spawnSeeds?.length?w.spawnSeeds:[w.settlement];for(let k=0;k<count;k++){const base=seeds[k%seeds.length],p=nearbyLand(sim,base.x,base.y),i=n.create(sim.rng,p.x,p.y,{tool:0});if(i<0)break;sim.memory.ensure(i,sim.memory.spatialCapacity(n,i))}}
function nearbyLand(sim,x,y){const w=sim.world;for(let tries=0;tries<24;tries++){const a=sim.rng.range(0,Math.PI*2),r=tries<4?sim.rng.range(.2,2.2):sim.rng.range(.2,5.5),nx=Math.max(1.5,Math.min(MAP_W-1.5,x+Math.cos(a)*r)),ny=Math.max(1.5,Math.min(MAP_H-1.5,y+Math.sin(a)*r)),t=w.tile(nx,ny);if(t!==TILE_TYPE.WATER&&t!==TILE_TYPE.MOUNTAIN)return{x:nx,y:ny}}return{x,y}}
function populationCenter(sim){const alive=sim.npcs.living();if(!alive.length)return{x:sim.world.settlement.x,y:sim.world.settlement.y};let x=0,y=0;for(const i of alive){x+=sim.npcs.x[i];y+=sim.npcs.y[i]}return{x:x/alive.length,y:y/alive.length}}
function facingFromVector(dx,dy){let oct=Math.round(Math.atan2(dx,-dy)/(Math.PI/4));if(oct<0)oct+=8;return oct&7}
function compactPerception(p){if(!p)return null;const person=x=>({id:x.id,uid:x.uid,x:x.x,y:x.y,d:x.d,wound:x.wound,action:x.action}),target=p.target?{kind:p.target.kind,ref:{id:p.target.ref?.id??-1},x:p.target.x,y:p.target.y,d:p.target.d}:null;return{radius:p.radius,longRadius:p.longRadius,threat:p.threat||0,target,humans:(p.humans||[]).map(person),wounded:(p.wounded||[]).map(person),prey:(p.prey||[]).map(x=>({id:x.id,x:x.x,y:x.y,d:x.d})),buildings:(p.buildings||[]).map(x=>({id:x.id,type:x.type,x:x.x,y:x.y,d:x.d,owner:x.owner})),sounds:(p.sounds||[]).map(x=>({type:x.type,x:x.x,y:x.y,d:x.d,confidence:x.confidence,source:x.source}))}}
function compactPerceptionCache(cache){const out=[];for(const p of cache||[])out.push(compactPerception(p));return out}
