import {NEED,GENE,RESOURCE,ACTION,BUILDING,TECH_COUNT} from '../core/constants.js';
import {knownResource,knownDungeons} from './perception.js';
import {perceivedNeed} from '../systems/senses.js';
import {technologyFor} from '../systems/technology.js';
const C=x=>Math.max(0,Math.min(1,x)),distCost=d=>1/(1+(d??30)*.055),foodKinds=[RESOURCE.GRAIN,RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK];
function personalFood(n,i){let s=0;for(const k of foodKinds)s+=n.inventory[i][k];return s}
function visibleBuilding(p,type){return(p.buildings||[]).find(b=>b.type===type)||null}
function personalShelter(sim,i){const n=sim.npcs;return sim.world.buildings.find(b=>b.finished&&b.type===BUILDING.SHELTER&&b.owner===n.uid[i])||null}
function teachable(tech,n,a,b){let c=0;for(let t=0;t<TECH_COUNT;t++)if(tech.knows(n,a,t)&&!tech.knows(n,b,t)&&tech.prerequisites(n,b,t))c++;return c}
function localGroup(perception,i){const ids=[i];for(const h of perception.humans||[])if(h.d<=9&&!ids.includes(h.id))ids.push(h.id);return ids}
function localQty(n,ids,kind){let s=0;for(const i of ids)s+=n.inventory[i]?.[kind]||0;return s}
function specialization(n,i,ids,profession){if(!profession)return 1;if(n.prof[i]===profession)return 1.12;let peers=0,adults=0;for(const j of ids){if(j===i||n.age[j]<16)continue;adults++;if(n.prof[j]===profession)peers++}if(!peers)return 1.05;return 1/(1+peers/Math.max(2,adults*.7))}
export function scoreActions(sim,i,perception={}){
 const n=sim.npcs,m=sim.memory,g=x=>n.gene(i,x),need=x=>perceivedNeed(sim,i,x),known=k=>knownResource(sim,i,k),inv=n.inventory[i],tech=technologyFor(sim);
 const food=known(RESOURCE.BERRY),water=known(RESOURCE.WATER),wood=known(RESOURCE.LOG),stone=known(RESOURCE.STONE),iron=known(RESOURCE.IRON),fish=known(RESOURCE.FISH),dungeons=knownDungeons(sim,i);
 const shelter=visibleBuilding(perception,BUILDING.SHELTER),homeShelter=personalShelter(sim,i),fire=visibleBuilding(perception,BUILDING.CAMPFIRE),farm=visibleBuilding(perception,BUILDING.FARM),forge=visibleBuilding(perception,BUILDING.FORGE),human=perception.humans?.[0],rel=human?m.relation(i,human.id):null,wounded=perception.wounded?.[0],prey=perception.prey?.[0];
 const ids=localGroup(perception,i),groupSize=Math.max(1,ids.length),ownFood=personalFood(n,i),ownWater=inv[RESOURCE.WATER],woodDemand=C((5*groupSize-localQty(n,ids,RESOURCE.LOG))/(5*groupSize)),stoneDemand=C((2*groupSize-localQty(n,ids,RESOURCE.STONE))/(2*groupSize)),ironDemand=C((1.5*groupSize-localQty(n,ids,RESOURCE.IRON))/(1.5*groupSize)),coverage=m.coverageRatio(i),night=sim.meta().phase==='noite'||sim.meta().phase==='madrugada',homeDist=homeShelter?Math.hypot(n.x[i]-homeShelter.x,n.y[i]-homeShelter.y):0,injury=(n.wound[i]||0)+(n.pain?.[i]||0),ignorance=(need(NEED.HUNGER)>.45&&!food?.4:0)+(need(NEED.THIRST)>.42&&!water?.55:0)+(woodDemand>.6&&!wood?.18:0)+(stoneDemand>.6&&!stone?.15:0),teacherTarget=human?teachable(tech,n,i,human.id):0;
 const spec=p=>specialization(n,i,ids,p);
 const scores=[
  [ACTION.EAT,Math.pow(need(NEED.HUNGER),3)*(ownFood>.06?1:.02)],
  [ACTION.DRINK,Math.pow(need(NEED.THIRST),3)*((ownWater>.06||water)?1:.02)],
  [ACTION.SLEEP,Math.pow(need(NEED.SLEEP),3)*(shelter?1:.5)],
  [ACTION.WARM,(fire||shelter)?Math.pow(need(NEED.TEMP),3):0],
  [ACTION.RETURN,homeShelter&&homeDist>12?(.05+Math.min(.65,(homeDist-12)*.025))*(night?1.8:1):0],
  [ACTION.FLEE,(perception.threat||0)*(.35+g(GENE.CAUTION)*1.35)*(1-g(GENE.AGGRESSION)*.45)+need(NEED.SAFETY)*.45],
  [ACTION.FIGHT,(perception.threat||0)*(.28+g(GENE.AGGRESSION)*1.28)*(1-g(GENE.CAUTION)*.62)*(.55+n.skill(i,10))*spec(5)],
  [ACTION.FORAGE,(need(NEED.HUNGER)*.62+(ownFood<.35?.42:.04))*distCost(food?.d)*(food?.confidence??0)],
  [ACTION.WATER,(need(NEED.THIRST)*.72+(ownWater<.25?.52:.03))*distCost(water?.d)*(water?.confidence??0)],
  [ACTION.WOOD,(.08+woodDemand*.72)*distCost(wood?.d)*(wood?.confidence??0)*(.5+n.skill(i,1))*spec(2)],
  [ACTION.STONE,(.12+stoneDemand*.58)*distCost(stone?.d)*(stone?.confidence??0)*(.45+n.skill(i,0))*spec(3)],
  [ACTION.IRON,(.03+ironDemand*.42)*distCost(iron?.d)*(iron?.confidence??0)*(.35+n.skill(i,0))*m.dangerModifier(i,'mineração')*spec(3)],
  [ACTION.FARM,farm?(.16+(ownFood<1?.5:.06))*(.5+n.skill(i,2))*spec(1):0],
  [ACTION.FISH,fish?(.1+(ownFood<.8?.35:.03))*distCost(fish.d)*(.45+n.skill(i,4))*spec(7):0],
  [ACTION.HUNT,prey?(.08+(ownFood<.6?.38:.04))*(.4+n.skill(i,3))*(1-g(GENE.CAUTION)*.2)*spec(6):0],
  [ACTION.COOK,fire&&(inv[RESOURCE.MEAT]+inv[RESOURCE.FISH]>.2)?(.3*(.5+n.skill(i,5))*spec(8)):0],
  [ACTION.TAILOR,(inv[RESOURCE.LEATHER]+inv[RESOURCE.WOOL]>.6&&n.armor[i]===0?.2:0)*(.45+n.skill(i,9))*spec(10)],
  [ACTION.FORGE,forge&&inv[RESOURCE.IRON]>.6?(.18+ironDemand*.12)*spec(4):0],
  [ACTION.CARE,wounded?(.18+g(GENE.EMPATHY)*.35+n.skill(i,12)*.3)*spec(11):0],
  [ACTION.SOCIAL,human?Math.pow(need(NEED.SOCIAL),2)*(.35+g(GENE.SOCIABILITY))*(rel?1+C(rel.affection+.4):.65):0],
  [ACTION.TEACH,human&&teacherTarget?(.035+teacherTarget*.015+g(GENE.LOYALTY)*.08+(rel?.affection||0)*.06-g(GENE.GREED)*.055):0],
  [ACTION.BUILD,(inv[RESOURCE.LOG]>.8||inv[RESOURCE.STONE]>1.2)?(.08+need(NEED.SAFETY)*.22+need(NEED.TEMP)*.16+g(GENE.AMBITION)*.12)*spec(9):0],
  [ACTION.EXPLORE,(.05+(1-coverage)*.3+ignorance+need(NEED.PURPOSE)*.12)*(.2+g(GENE.CURIOSITY)*g(GENE.CURIOSITY)*.9)*(1-g(GENE.CAUTION)*.28)*(1-need(NEED.HUNGER)*.72)*(1-need(NEED.THIRST)*.74)*(1-Math.min(.7,injury*.45))*(night?.48:1)],
  [ACTION.DUNGEON,dungeons.length&&ownWater>.2&&ownFood>.2&&need(NEED.HUNGER)<.48&&need(NEED.THIRST)<.48&&n.stamina[i]>.42?(.1+g(GENE.AMBITION)*.5+n.prestige[i]*.001)*(1-g(GENE.CAUTION)*.58)*(.38+n.skill(i,10))*m.dangerModifier(i,'dungeon'):0]
 ];
 const available=scores.filter(row=>tech.canAction(i,row[0],sim));available.sort((a,b)=>b[1]-a[1]);return available;
}
export function chooseAction(sim,i,scores){const top=scores.filter(x=>x[1]>0).slice(0,3);if(!top.length)return ACTION.IDLE;const picked=sim.rng.weighted(top,x=>Math.pow(Math.max(.0001,x[1]),2));return picked?.[0]||ACTION.IDLE}