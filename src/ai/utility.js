import {NEED,GENE,RESOURCE,ACTION,BUILDING,TOOL} from '../core/constants.js';
import {knownResource,knownDungeons} from './perception.js';
const C=x=>Math.max(0,Math.min(1,x));
const distCost=d=>1/(1+(d??30)*.055);
const foodKinds=[RESOURCE.GRAIN,RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK];
function personalFood(n,i){let s=0;for(const k of foodKinds)s+=n.inventory[i][k];return s}
export function scoreActions(sim,i,perception){
 const n=sim.npcs,w=sim.world,m=sim.memory,g=x=>n.gene(i,x),need=x=>n.need(i,x),known=k=>knownResource(sim,i,k),inv=n.inventory[i];
 const food=known(RESOURCE.BERRY),water=known(RESOURCE.WATER),wood=known(RESOURCE.LOG),stone=known(RESOURCE.STONE),iron=known(RESOURCE.IRON),fish=known(RESOURCE.FISH);
 const localShelter=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.SHELTER,12),localFire=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.CAMPFIRE,12),localFarm=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FARM,12),localForge=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FORGE,12),dungeons=knownDungeons(sim,i);
 const socialTarget=sim.nearestVisibleNPC(i,perception.radius),rel=socialTarget>=0?m.relation(i,socialTarget):null,sp=m.spatial.get(i),coverage=sp?sp.count/sp.capacity:0;
 const ownFood=personalFood(n,i),ownWater=inv[RESOURCE.WATER],woodDemand=C((5-inv[RESOURCE.LOG])/5),stoneDemand=C((2-inv[RESOURCE.STONE])/2),ironDemand=C((1.5-inv[RESOURCE.IRON])/1.5),wounded=sim.nearestWounded(i,perception.radius),prey=sim.animals?.nearestPrey(n.x[i],n.y[i],perception.radius),dangerBelief=m.dangerModifier(i,'dungeon'),night=sim.meta().phase==='noite'||sim.meta().phase==='madrugada',scoutDrive=dungeons.length===0&&g(GENE.CURIOSITY)>.68?.45+(g(GENE.CURIOSITY)-.68)*1.2:0;
 const scores=[
  [ACTION.EAT,Math.pow(need(NEED.HUNGER),3)*(ownFood>.06?1:.03)],
  [ACTION.DRINK,Math.pow(need(NEED.THIRST),3)*((ownWater>.06||water)?1:.02)],
  [ACTION.SLEEP,Math.pow(need(NEED.SLEEP),3)*(localShelter?1:.48)],
  [ACTION.WARM,localFire||localShelter?Math.pow(need(NEED.TEMP),3):0],
  [ACTION.RETURN,0],
  [ACTION.FLEE,perception.threat*(.35+g(GENE.CAUTION)*1.35)*(1-g(GENE.AGGRESSION)*.45)+need(NEED.SAFETY)*.45],
  [ACTION.FIGHT,perception.threat*(.28+g(GENE.AGGRESSION)*1.28)*(1-g(GENE.CAUTION)*.62)*(.55+n.skill(i,10))],
  [ACTION.FORAGE,(need(NEED.HUNGER)*.62+(ownFood<.35?.42:.04))*distCost(food?.d)*(food?.confidence??0)],
  [ACTION.WATER,(need(NEED.THIRST)*.72+(ownWater<.25?.52:.03))*distCost(water?.d)*(water?.confidence??0)],
  [ACTION.WOOD,(.08+woodDemand*.72)*distCost(wood?.d)*(wood?.confidence??0)*(.5+n.skill(i,1))],
  [ACTION.STONE,(.12+stoneDemand*.58)*distCost(stone?.d)*(stone?.confidence??0)*(.45+n.skill(i,0))],
  [ACTION.IRON,(.03+ironDemand*.42)*distCost(iron?.d)*(iron?.confidence??0)*(.35+n.skill(i,0))*m.dangerModifier(i,'mineração')],
  [ACTION.FARM,localFarm?(.16+(ownFood<1?.5:.06))*(.5+n.skill(i,2)):0],
  [ACTION.FISH,fish?(.1+(ownFood<.8?.35:.03))*distCost(fish.d)*(.45+n.skill(i,4)):0],
  [ACTION.HUNT,prey?(.08+(ownFood<.6?.38:.04))*(.4+n.skill(i,3))*(1-g(GENE.CAUTION)*.2):0],
  [ACTION.COOK,localFire&&(inv[RESOURCE.MEAT]+inv[RESOURCE.FISH]>.2)?(.3*(.5+n.skill(i,5))):0],
  [ACTION.TAILOR,(inv[RESOURCE.LEATHER]+inv[RESOURCE.WOOL]>.6&&n.armor[i]===0?.2:0)*(.45+n.skill(i,9))],
  [ACTION.FORGE,localForge&&inv[RESOURCE.IRON]>.6?.18+ironDemand*.12:0],
  [ACTION.CARE,wounded>=0?(.18+g(GENE.EMPATHY)*.35+n.skill(i,12)*.3):0],
  [ACTION.SOCIAL,Math.pow(need(NEED.SOCIAL),2)*(.35+g(GENE.SOCIABILITY))*(rel?1+C(rel.affection+.4):.65)],
  [ACTION.BUILD,0],
  [ACTION.EXPLORE,(.06+(1-coverage)*.28+scoutDrive+need(NEED.PURPOSE)*.12)*(.18+g(GENE.CURIOSITY)*g(GENE.CURIOSITY)*.9)*(1-g(GENE.CAUTION)*.25)*(1-need(NEED.HUNGER)*.65)*(1-need(NEED.THIRST)*.68)*(night?.72:1)],
  [ACTION.DUNGEON,dungeons.length&&ownWater>.2&&ownFood>.2&&need(NEED.HUNGER)<.48&&need(NEED.THIRST)<.48&&n.stamina[i]>.42?(.1+g(GENE.AMBITION)*.5+n.prestige[i]*.001)*(1-g(GENE.CAUTION)*.58)*(.38+n.skill(i,10))*dangerBelief:0]
 ];
 for(const row of scores)if(sim.technology&&!sim.technology.canAction(i,row[0]))row[1]=0;
 scores.sort((a,b)=>b[1]-a[1]);return scores;
}
export function chooseAction(sim,i,scores){const top=scores.filter(x=>x[1]>0).slice(0,3);if(!top.length)return ACTION.IDLE;const picked=sim.rng.weighted(top,x=>Math.pow(Math.max(.0001,x[1]),2));return picked?.[0]||ACTION.IDLE}
