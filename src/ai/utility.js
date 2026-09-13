import {NEED,GENE,RESOURCE,ACTION,BUILDING,TOOL} from '../core/constants.js';
import {knownResource,knownDungeons} from './perception.js';
const C=x=>Math.max(0,Math.min(1,x));
const distCost=d=>1/(1+(d??30)*.055);
function foodAvailable(w){return w.stock[RESOURCE.GRAIN]+w.stock[RESOURCE.BERRY]+w.stock[RESOURCE.MEAT]+w.stock[RESOURCE.FISH]+w.stock[RESOURCE.PRESERVED]+w.stock[RESOURCE.EGG]+w.stock[RESOURCE.MILK]}
export function scoreActions(sim,i,perception){const n=sim.npcs,w=sim.world,m=sim.memory,g=x=>n.gene(i,x),need=x=>n.need(i,x),known=k=>knownResource(sim,i,k);const food=known(RESOURCE.BERRY),water=known(RESOURCE.WATER),wood=known(RESOURCE.LOG),stone=known(RESOURCE.STONE),iron=known(RESOURCE.IRON),fish=known(RESOURCE.FISH);const localShelter=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.SHELTER,12),localFarm=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FARM,12),localForge=w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.FORGE,12),dungeons=knownDungeons(sim,i);const socialTarget=sim.nearestVisibleNPC(i,perception.radius),rel=socialTarget>=0?m.relation(i,socialTarget):null;const spatial=m.spatial.get(i),coverage=spatial?spatial.count/spatial.capacity:0;const stockFood=foodAvailable(w),woodDemand=C((28-w.stock[RESOURCE.LOG])/28),stoneDemand=C((18-w.stock[RESOURCE.STONE])/18),ironDemand=C((12-w.stock[RESOURCE.IRON])/12);const wounded=sim.nearestWounded(i,perception.radius);const prey=sim.animals?.nearestPrey(n.x[i],n.y[i],perception.radius);const dangerBelief=m.dangerModifier(i,'dungeon');const hasHammer=n.tool[i]===TOOL.HAMMER||w.tools[TOOL.HAMMER]>0;const homeDist=Math.hypot(n.x[i]-w.settlement.x,n.y[i]-w.settlement.y),night=sim.meta().phase==='noite'||sim.meta().phase==='madrugada',scoutDrive=dungeons.length===0&&g(GENE.CURIOSITY)>.68?.55+(g(GENE.CURIOSITY)-.68)*1.4:0;const scores=[
 [ACTION.EAT,Math.pow(need(NEED.HUNGER),3)*(stockFood>.08?1:.03)],
 [ACTION.DRINK,Math.pow(need(NEED.THIRST),3)*((w.stock[RESOURCE.WATER]>.08||water)?1:.02)],
 [ACTION.SLEEP,Math.pow(need(NEED.SLEEP),3)*(localShelter?1:.5)],
 [ACTION.WARM,Math.pow(need(NEED.TEMP),3)*(w.nearestBuildingLocal(n.x[i],n.y[i],BUILDING.CAMPFIRE,12)||localShelter?1:.35)],
 [ACTION.RETURN,(homeDist>9?((night?.82:.08)+Math.max(0,homeDist-18)*.035+need(NEED.SAFETY)*.18):0)*(1-g(GENE.CURIOSITY)*.18)],
 [ACTION.FLEE,perception.threat*(.35+g(GENE.CAUTION)*1.35)*(1-g(GENE.AGGRESSION)*.45)+need(NEED.SAFETY)*.45],
 [ACTION.FIGHT,perception.threat*(.28+g(GENE.AGGRESSION)*1.28)*(1-g(GENE.CAUTION)*.62)*(.55+n.skill(i,10))],
 [ACTION.FORAGE,(need(NEED.HUNGER)*.45+(.35* (stockFood<8)))*distCost(food?.d)*(food?.confidence??0)],
 [ACTION.WATER,(need(NEED.THIRST)*.58+(.42*(w.stock[RESOURCE.WATER]<10)))*distCost(water?.d)*(water?.confidence??0)],
 [ACTION.WOOD,(.12+woodDemand*.76)*distCost(wood?.d)*(wood?.confidence??0)*(.5+n.skill(i,1))],
 [ACTION.STONE,(.08+stoneDemand*.48)*distCost(stone?.d)*(stone?.confidence??0)*(.45+n.skill(i,0))],
 [ACTION.IRON,(.05+ironDemand*.42)*distCost(iron?.d)*(iron?.confidence??0)*(.35+n.skill(i,0))*m.dangerModifier(i,'mineração')],
 [ACTION.FARM,(localFarm?(.18+(stockFood<18?.6:.08))*(.5+n.skill(i,2)):0)],
 [ACTION.FISH,fish?(.12+(stockFood<16?.35:.04))*distCost(fish.d)*(.45+n.skill(i,4)):0],
 [ACTION.HUNT,prey?(.09+(stockFood<12?.4:.05))*(.4+n.skill(i,3))*(1-g(GENE.CAUTION)*.2):0],
 [ACTION.COOK,(w.stock[RESOURCE.MEAT]+w.stock[RESOURCE.FISH]>.5?.34:0)*(.5+n.skill(i,5))],
 [ACTION.TAILOR,(w.stock[RESOURCE.LEATHER]+w.stock[RESOURCE.WOOL]>.7&&n.armor[i]===0?.22:0)*(.45+n.skill(i,9))],
 [ACTION.FORGE,(localForge&&w.stock[RESOURCE.IRON]>.8?.2+ironDemand*.15:0)*(.45+n.skill(i,7))],
 [ACTION.CARE,wounded>=0?(.18+n.gene(i,GENE.EMPATHY)*.35+n.skill(i,12)*.3):0],
 [ACTION.SOCIAL,Math.pow(need(NEED.SOCIAL),2)*(.35+g(GENE.SOCIABILITY))*(rel?1+C(rel.affection+.4):.65)],
 [ACTION.BUILD,(w.blueprints.some(b=>!b.done)?.58:(!w.buildings.some(b=>b.type===BUILDING.FARM)?.66:(w.buildings.length<10?.22:.04)))*(.45+n.skill(i,6))*(.5+g(GENE.AMBITION))*(hasHammer?1:.25)],
 [ACTION.EXPLORE,(.04+(1-coverage)*.25+scoutDrive+need(NEED.PURPOSE)*.12)*(.18+g(GENE.CURIOSITY)*g(GENE.CURIOSITY)*.9)*(1-g(GENE.CAUTION)*.3)*(1-need(NEED.HUNGER)*.7)*(1-need(NEED.THIRST)*.7)*(homeDist<24?1:.2)],
 [ACTION.DUNGEON,dungeons.length&&need(NEED.HUNGER)<.48&&need(NEED.THIRST)<.48&&n.stamina[i]>.42?(.16+g(GENE.AMBITION)*.68+n.prestige[i]*.0015)*(1-g(GENE.CAUTION)*.58)*(.38+n.skill(i,10))*(.42+sim.dungeon.pressureForKnown(sim,i)*.75)*dangerBelief:0]
 ];scores.sort((a,b)=>b[1]-a[1]);return scores}
export function chooseAction(sim,i,scores){const top=scores.slice(0,3);const picked=sim.rng.weighted(top,x=>Math.pow(Math.max(.0001,x[1]),2));return picked?.[0]||ACTION.IDLE}
