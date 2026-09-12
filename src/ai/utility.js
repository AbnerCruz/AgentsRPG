import {NEED,GENE,RESOURCE,ACTION,BUILDING} from '../core/constants.js';
const C=x=>Math.max(0,Math.min(1,x));
function distCost(d){return 1/(1+d*.08)}
function nearStore(w,n,i){return w.nearBuilding(n.x[i],n.y[i],BUILDING.STORAGE,4)}
export function scoreActions(sim,i){
 const n=sim.npcs,g=(x)=>n.gene(i,x),need=(x)=>n.need(i,x),inv=n.inventory[i],w=sim.world,m=sim.memory;
 const nearest=(kind)=>w.nearestResource(n.x[i],n.y[i],kind),shelter=w.nearestBuilding(n.x[i],n.y[i],BUILDING.SHELTER),well=w.nearestBuilding(n.x[i],n.y[i],BUILDING.WELL);
 const food=nearest(RESOURCE.FOOD),river=nearest(RESOURCE.WATER),water=well&&(!river||well.d<river.d)?well:river,wood=nearest(RESOURCE.WOOD),stone=nearest(RESOURCE.STONE),iron=nearest(RESOURCE.IRON);
 const localThreat=w.threatAt(n.x[i],n.y[i]),hasForge=w.buildings.some(b=>b.type===BUILDING.FORGE),farm=w.buildings.find(b=>b.type===BUILDING.FARM),store=nearStore(w,n,i);
 const communityIron=w.stock[RESOURCE.IRON]<18?1:.18,socialTarget=sim.nearestNPC(i),rel=socialTarget>=0?m.relation(i,socialTarget):null;
 const carrying=[RESOURCE.WOOD,RESOURCE.STONE,RESOURCE.IRON,RESOURCE.WHEAT,RESOURCE.WATER,RESOURCE.FOOD].reduce((s,k)=>s+inv[k],0);
 const equipNeed=1-(n.tool[i]+n.weapon[i])*.5;
 const farmReady=farm?(farm.ripe>.04||farm.seedReady>.02||((farm.planted||0)<(farm.capacity||2.5)&&w.stock[RESOURCE.WHEAT]>.04)):false;
 const scores=[
  [ACTION.EAT,Math.pow(need(NEED.HUNGER),3)*((inv[RESOURCE.FOOD]>.1||(store&&w.stock[RESOURCE.FOOD]>.12))?1:.04)],
  [ACTION.DRINK,Math.pow(need(NEED.THIRST),3)*((inv[RESOURCE.WATER]>.08||(store&&w.stock[RESOURCE.WATER]>.1))?1:.04)],
  [ACTION.SLEEP,Math.pow(need(NEED.SLEEP),3)*(w.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER)?1:.45)],
  [ACTION.WARM,Math.pow(need(NEED.TEMP),3)*distCost(shelter?.d??20)*1.4],
  [ACTION.FORAGE,Math.pow(need(NEED.HUNGER),2)*distCost(food?.d??20)*(.7+g(GENE.CURIOSITY)*.5)],
  [ACTION.WATER,Math.pow(need(NEED.THIRST),2)*distCost(water?.d??20)*1.25],
  [ACTION.DEPOSIT,carrying>.28?(.18+carrying*.45+(inv[RESOURCE.WATER]>.2?.32:0)+(inv[RESOURCE.FOOD]>.2?.2:0)):0],
  [ACTION.WOOD,(.15+need(NEED.PURPOSE)*.35)*distCost(wood?.d??20)*(.5+n.skill(i,1))],
  [ACTION.STONE,(w.stock[RESOURCE.STONE]<35?.2:.06)*(.6+need(NEED.PURPOSE)*.2)*distCost(stone?.d??20)*(.45+n.skill(i,0))],
  [ACTION.IRON,communityIron*distCost(iron?.d??30)*(.3+n.skill(i,0))*(hasForge?1:.45)*m.dangerModifier(i,'caverna')],
  [ACTION.FARM,farmReady?(w.stock[RESOURCE.FOOD]<55?.62:.16)*(.35+n.skill(i,2)):0],
  [ACTION.CRAFT,hasForge&&w.stock[RESOURCE.IRON]>.25&&w.stock[RESOURCE.WOOD]>.1?(.16+equipNeed*.35+need(NEED.PURPOSE)*.18)*(.45+n.skill(i,7)):0],
  [ACTION.SOCIAL,Math.pow(need(NEED.SOCIAL),2)*(.4+g(GENE.SOCIABILITY))*(rel?1+C(rel.affection+.5):.7)],
  [ACTION.BUILD,(w.buildings.length<7?.4:.06)*(.45+n.skill(i,6))*(.5+g(GENE.AMBITION))],
  [ACTION.EXPLORE,(.08+need(NEED.PURPOSE)*.25)*(.4+g(GENE.CURIOSITY))*(1-g(GENE.CAUTION)*.35)],
  [ACTION.FIGHT,localThreat*(.35+g(GENE.AGGRESSION)*1.25)*(1-g(GENE.CAUTION)*.55)*(.65+n.skill(i,10)+n.weapon[i]*.35)],
  [ACTION.FLEE,localThreat*(.45+g(GENE.CAUTION)*1.35)*(1-g(GENE.AGGRESSION)*.42)*(.65+need(NEED.SAFETY)*.7)],
  [ACTION.DUNGEON,sim.dungeon.pressure*(.22+g(GENE.AMBITION)*.8+n.prestige[i]*.002)*(1-g(GENE.CAUTION)*.62)*sim.dungeon.readiness(sim,i)*(.45+n.skill(i,10)*.8)*(sim.dungeon.pressure>.2?1:.2)*m.dangerModifier(i,'dungeon')]
 ];
 const current=n.commitment[i]?.goal;if(current){const row=scores.find(x=>x[0]===current);if(row)row[1]*=1.3+g(GENE.STUBBORN)*.5}
 scores.sort((a,b)=>b[1]-a[1]);return scores;
}
export function chooseAction(sim,i,scores){const top=scores.slice(0,3);const picked=sim.rng.weighted(top,x=>Math.pow(Math.max(.0001,x[1]),2));return picked?.[0]||ACTION.IDLE}
