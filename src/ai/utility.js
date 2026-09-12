import {NEED,GENE,RESOURCE,ACTION,BUILDING} from '../core/constants.js';
const C=x=>Math.max(0,Math.min(1,x));
function distCost(d){return 1/(1+d*.08)}
export function scoreActions(sim,i){const n=sim.npcs,g=(x)=>n.gene(i,x),need=(x)=>n.need(i,x),inv=n.inventory[i],w=sim.world,m=sim.memory;const nearest=(kind)=>w.nearestResource(n.x[i],n.y[i],kind);const shelter=w.nearestBuilding(n.x[i],n.y[i],BUILDING.SHELTER);const food=nearest(RESOURCE.FOOD),water=nearest(RESOURCE.WATER),wood=nearest(RESOURCE.WOOD),stone=nearest(RESOURCE.STONE),iron=nearest(RESOURCE.IRON);const localThreat=w.threatAt(n.x[i],n.y[i]);const hasForge=w.buildings.some(b=>b.type===BUILDING.FORGE);const communityIron=w.stock[RESOURCE.IRON]<20?1:.25;const socialTarget=sim.nearestNPC(i);const rel=socialTarget>=0?m.relation(i,socialTarget):null;const scores=[
 [ACTION.EAT,Math.pow(need(NEED.HUNGER),3)*((inv[RESOURCE.FOOD]>.1||w.stock[RESOURCE.FOOD]>.12)?1:.05)],
 [ACTION.DRINK,Math.pow(need(NEED.THIRST),3)*((inv[RESOURCE.WATER]>.1||w.stock[RESOURCE.WATER]>.1)?1:.05)],
 [ACTION.SLEEP,Math.pow(need(NEED.SLEEP),3)*(w.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER)?1:.45)],
 [ACTION.WARM,Math.pow(need(NEED.TEMP),3)*distCost(shelter?.d??20)*1.4],
 [ACTION.FORAGE,Math.pow(need(NEED.HUNGER),2)*distCost(food?.d??20)*(.7+g(GENE.CURIOSITY)*.5)],
 [ACTION.WATER,Math.pow(need(NEED.THIRST),2)*distCost(water?.d??20)],
 [ACTION.WOOD,(.15+need(NEED.PURPOSE)*.35)*distCost(wood?.d??20)*(.5+n.skill(i,1))],
 [ACTION.STONE,(.12+need(NEED.PURPOSE)*.28)*distCost(stone?.d??20)*(.45+n.skill(i,0))],
 [ACTION.IRON,communityIron*distCost(iron?.d??30)*(.3+n.skill(i,0))*(hasForge?1:.45)*m.dangerModifier(i,'caverna')],
 [ACTION.FARM,(w.stock[RESOURCE.FOOD]<60?.58:.12)*(.35+n.skill(i,2))],
 [ACTION.SOCIAL,Math.pow(need(NEED.SOCIAL),2)*(.4+g(GENE.SOCIABILITY))*(rel?1+C(rel.affection+.5):.7)],
 [ACTION.BUILD,(w.buildings.length<5?.48:.08)*(.45+n.skill(i,6))*(.5+g(GENE.AMBITION))],
 [ACTION.EXPLORE,(.08+need(NEED.PURPOSE)*.25)*(.4+g(GENE.CURIOSITY))*(1-g(GENE.CAUTION)*.35)],
 [ACTION.FIGHT,localThreat*(.95+g(GENE.AGGRESSION))*(1-g(GENE.CAUTION)*.3)*(.65+n.skill(i,10))],
 [ACTION.DUNGEON,sim.dungeon.pressure*(.22+g(GENE.AMBITION)*.8+n.prestige[i]*.002)*(1-g(GENE.CAUTION)*.62)*sim.dungeon.readiness(sim,i)*(n.skill(i,10)>.15?1:.15)*(sim.dungeon.pressure>.25?1:.2)*m.dangerModifier(i,'dungeon')]
 ];
 scores.sort((a,b)=>b[1]-a[1]);return scores;
}
export function chooseAction(sim,i,scores){const top=scores.slice(0,3);const picked=sim.rng.weighted(top,x=>Math.pow(Math.max(.0001,x[1]),2));return picked?.[0]||ACTION.IDLE}
