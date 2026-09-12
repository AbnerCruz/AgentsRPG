import {RNG} from './core/rng.js';
import {dayOf,dayPhase,season,isNight} from './core/clock.js';
import {World} from './world/world.js';
import {NPCStore} from './entities/npcs.js';
import {MemorySystem} from './ai/memory.js';
import {updateNeeds} from './ai/drives.js';
import {scoreActions,chooseAction} from './ai/utility.js';
import {planFor} from './ai/planner.js';
import {executeAction} from './systems/actions.js';
import {socialTick,reproductionTick} from './systems/social.js';
import {lifecycleTick} from './systems/lifecycle.js';
import {updateProfessions} from './systems/professions.js';
import {Dungeon} from './dungeon/dungeon.js';
import {BUILDING,GENE,RESOURCE} from './core/constants.js';
export class Simulation{
 constructor(seed=1){this.seed=seed;this.rng=new RNG(seed);this.tick=0;this.world=new World(this.rng);this.npcs=new NPCStore();this.memory=new MemorySystem();this.dungeon=new Dungeon(this.rng);this.chronicle=[];this.populationHistory=[];this.geneHistory=[];this.initPopulation()}
 initPopulation(){for(let k=0;k<12;k++){const i=this.npcs.create(this.rng,36+this.rng.range(-5,5),36+this.rng.range(-5,5));this.memory.ensure(i);this.memory.learn(i,{key:'vila',text:'A vila é um lugar relativamente seguro.',tick:0,confidence:.7});this.memory.learn(i,{key:'rio',text:'Há água no rio a oeste.',tick:0,confidence:.7})}this.log('fundação','Doze pessoas despertaram no vale sem ordens e sem um destino comum.',.9)}
 nearestNPC(i){const n=this.npcs;let best=-1,d=9;for(const j of n.living())if(j!==i){const dd=Math.hypot(n.x[j]-n.x[i],n.y[j]-n.y[i]);if(dd<d){d=dd;best=j}}return best}
 log(type,text,importance=.5,npc=-1){this.chronicle.push({type,text,importance,npc,tick:this.tick,day:dayOf(this.tick)});if(this.chronicle.length>800)this.chronicle.shift()}
 step(){this.tick++;this.world.tick();this.dungeon.tick(this);const n=this.npcs;for(const i of n.living()){const threat=this.world.threatAt(n.x[i],n.y[i]);updateNeeds(n,i,{night:isNight(this.tick),season:season(this.tick),threat,nearShelter:this.world.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER)});if(n.age[i]<16){this.childStep(i);continue}if(this.tick%((i%3)+2)===0){const scores=scoreActions(this,i);n.scores[i]=scores.slice(0,5);const goal=threat>.28?'lutar':chooseAction(this,i,scores);n.plan[i]=planFor(this,i,goal);executeAction(this,i,n.plan[i][0]||goal);updateProfessions(n,i)}if(this.tick%480===i%480)this.memory.reflect(i,this.tick);this.deposit(i)}socialTick(this);reproductionTick(this);lifecycleTick(this);this.handleMonsters();if(this.tick%240===0)this.snapshotStats();if(this.tick%1200===0)this.applyScarcity()}
 deposit(i){const inv=this.npcs.inventory[i];for(const k of [RESOURCE.WOOD,RESOURCE.STONE,RESOURCE.IRON,RESOURCE.WHEAT,RESOURCE.LEATHER])if(inv[k]>.75){const d=inv[k]-.35;this.world.stock[k]+=d;inv[k]-=d}}

 childStep(i){const n=this.npcs,p=n.parents[i];let guardian=p?.find(x=>x>=0&&n.alive[x]);if(guardian==null||guardian<0){guardian=n.living().find(x=>x!==i&&n.age[x]>=18)??-1}if(guardian>=0){const d=Math.hypot(n.x[guardian]-n.x[i],n.y[guardian]-n.y[i]);if(d>2){n.x[i]+=(n.x[guardian]-n.x[i])/d*.22;n.y[i]+=(n.y[guardian]-n.y[i])/d*.22}if(n.age[i]>=8&&this.rng.chance(.05)){let best=0;for(let sk=1;sk<14;sk++)if(n.skill(guardian,sk)>n.skill(guardian,best))best=sk;n.addSkill(i,best,.0012)}}n.action[i]=n.age[i]<8?'brincando perto da família':'aprendendo com os adultos';if(n.need(i,0)>.55&&this.world.stock[RESOURCE.FOOD]>.1){this.world.stock[RESOURCE.FOOD]-=.08;n.setNeed(i,0,n.need(i,0)-.35)}if(n.need(i,1)>.55&&this.world.stock[RESOURCE.WATER]>.08){this.world.stock[RESOURCE.WATER]-=.07;n.setNeed(i,1,n.need(i,1)-.45)}if(n.need(i,2)>.6)n.setNeed(i,2,n.need(i,2)-.05)}
 handleMonsters(){const n=this.npcs;for(const m of this.world.monsters)if(m.hp>0){let best=-1,d=99;for(const i of n.living()){const dd=Math.hypot(n.x[i]-m.x,n.y[i]-m.y);if(dd<d){d=dd;best=i}}if(best>=0&&d>1){m.x+=(n.x[best]-m.x)/d*.12;m.y+=(n.y[best]-m.y)/d*.12}else if(best>=0&&d<=1&&this.rng.chance(.025)){n.hp[best]-=.008+m.power*.012;this.memory.remember(best,{type:'ataque',text:'Uma criatura da dungeon me atacou perto da vila.',tick:this.tick,valence:-7,importance:.85,reflectionKey:'monstros'})}}this.world.monsters=this.world.monsters.filter(m=>m.hp>0&&this.tick-(m.born||this.tick)<720);if(this.world.monsters.length>50)this.world.monsters=this.world.monsters.slice(-50)}
 snapshotStats(){const alive=this.npcs.living();this.populationHistory.push({day:dayOf(this.tick),value:alive.length});const genes=[GENE.AGGRESSION,GENE.CAUTION,GENE.AMBITION,GENE.EMPATHY].map(g=>alive.length?alive.reduce((s,i)=>s+this.npcs.gene(i,g),0)/alive.length:0);this.geneHistory.push({day:dayOf(this.tick),values:genes});if(this.populationHistory.length>200)this.populationHistory.shift();if(this.geneHistory.length>200)this.geneHistory.shift()}
 applyScarcity(){for(const r of this.world.resources)if(r.kind===RESOURCE.FOOD&&this.rng.chance(.15))r.amount*=.75}
 meta(){return{day:dayOf(this.tick),phase:dayPhase(this.tick),season:season(this.tick)}}
 serialize(){return{version:1,savedAt:Date.now(),seed:this.seed,rngState:this.rng.state,tick:this.tick,world:this.world.serialize(),npcs:this.npcs.serialize(),memory:this.memory.serialize(),dungeon:this.dungeon.serialize(),chronicle:this.chronicle,populationHistory:this.populationHistory,geneHistory:this.geneHistory}}
 static hydrate(d){const s=Object.create(Simulation.prototype);s.seed=d.seed;s.rng=new RNG(d.seed);s.rng.state=d.rngState;s.tick=d.tick;s.world=World.hydrate(d.world,s.rng);s.npcs=NPCStore.hydrate(d.npcs);s.memory=MemorySystem.hydrate(d.memory);s.dungeon=Dungeon.hydrate(d.dungeon,s.rng);s.chronicle=d.chronicle||[];s.populationHistory=d.populationHistory||[];s.geneHistory=d.geneHistory||[];return s}
}
