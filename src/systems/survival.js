import {MAX_NPCS,RESOURCE,FOOD_KINDS,NUTRITION,ARMOR,BUILDING,TILE_TYPE,WATER_KIND,DAY_TICKS,ACTION,CLOTHING,WOUND_TYPE,BODY_REGION,FOOD_STATE} from '../core/constants.js';
import {NPCStore} from '../entities/npcs.js';
import {World} from '../world/world.js';
import {ambientTemperature,season} from '../core/clock.js';
import {noiseHash} from '../core/rng.js';
import {technologyFor} from './technology.js';
import {infect} from './disease.js';

const FOOD_LIST=[RESOURCE.GRAIN,RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK,RESOURCE.FAT];
const FOOD_INDEX=new Map(FOOD_LIST.map((k,i)=>[k,i]));
const FOOD_BASE_DAYS={
 [RESOURCE.FISH]:2,[RESOURCE.MILK]:2,[RESOURCE.MEAT]:4,[RESOURCE.BERRY]:5,[RESOURCE.EGG]:8,[RESOURCE.GRAIN]:90,[RESOURCE.FAT]:18,[RESOURCE.PRESERVED]:55
};
const FOOD_STATE_NAMES=['fresco','maduro','estragado','podre'];
const REGION_NAMES=['cabeça','tronco','braços','pernas'];
const WOUND_NAMES=['corte','perfuração','contusão','queimadura','fratura'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));

export function ensureSurvival(n){
 if(n.phaseF)return n.phaseF;
 const p=n.phaseF={
  bodyTemp:new Float32Array(MAX_NPCS),wetness:new Float32Array(MAX_NPCS),clothingDurability:new Float32Array(MAX_NPCS),clothingLayers:new Uint8Array(MAX_NPCS),thermalStage:new Uint8Array(MAX_NPCS),
  sequelaSpeed:new Float32Array(MAX_NPCS),sequelaStrength:new Float32Array(MAX_NPCS),sequelaPerception:new Float32Array(MAX_NPCS),
  waterQuality:new Float32Array(MAX_NPCS),waterShadow:new Float32Array(MAX_NPCS),lastWound:new Float32Array(MAX_NPCS),lastArmor:new Uint8Array(MAX_NPCS),
  foodShadow:new Float32Array(MAX_NPCS*FOOD_LIST.length),foodLots:Array.from({length:MAX_NPCS},()=>[]),wounds:Array.from({length:MAX_NPCS},()=>[]),scars:Array.from({length:MAX_NPCS},()=>[])
 };
 p.bodyTemp.fill(36.8);p.clothingDurability.fill(1);p.waterQuality.fill(1);
 for(let i=0;i<MAX_NPCS;i++){p.lastWound[i]=n.wound?.[i]||0;p.lastArmor[i]=n.armor?.[i]||0;p.waterShadow[i]=n.inventory?.[i]?.[RESOURCE.WATER]||0;for(let q=0;q<FOOD_LIST.length;q++)p.foodShadow[i*FOOD_LIST.length+q]=n.inventory?.[i]?.[FOOD_LIST[q]]||0}
 return p;
}

export function survivalTick(sim,i){
 const n=sim.npcs,p=ensureSurvival(n);if(!n.alive[i])return;
 syncPersonalFood(sim,i,p);syncWater(sim,i,p);syncWounds(sim,i,p);updateThermal(sim,i,p);updateWounds(sim,i,p);updateNutrition(sim,i,p);
 if(sim.tick%60===0&&i===firstLiving(n)){updateWorldFood(sim);preserveWorldFood(sim)}
}

export function survivalSummary(sim,i){
 const n=sim.npcs,p=ensureSurvival(n),temp=p.bodyTemp[i],wet=p.wetness[i],wounds=p.wounds[i]||[],scars=p.scars[i]||[];
 return{temperature:temp,thermal:thermalLabel(temp),wetness:wet,clothing:clothingLabel(p.clothingLayers[i]),clothingDurability:p.clothingDurability[i],wounds,scars,waterCapacity:waterCapacity(sim,i),waterQuality:p.waterQuality[i],nutrition:[n.nutritionAt(i,NUTRITION.FRESH),n.nutritionAt(i,NUTRITION.PROTEIN),n.nutritionAt(i,NUTRITION.ENERGY)]};
}

export function waterCapacity(sim,i){const n=sim.npcs,t=technologyFor(sim);let cap=.28;if(t.knows(n,i,41)||t.knows(n,i,10))cap=.78;if(t.knows(n,i,42)||t.knows(n,i,19))cap=1.25;return cap}
export function fertilityFactor(sim,i){const n=sim.npcs,a=n.nutritionAt(i,NUTRITION.FRESH),b=n.nutritionAt(i,NUTRITION.PROTEIN),c=n.nutritionAt(i,NUTRITION.ENERGY);return clamp(.3+(a+b+c)/3*.85,.3,1.08)}
export function healingFactor(sim,i){const n=sim.npcs,a=n.nutritionAt(i,NUTRITION.FRESH),b=n.nutritionAt(i,NUTRITION.PROTEIN),c=n.nutritionAt(i,NUTRITION.ENERGY);return clamp(.28+(a*.3+b*.42+c*.28),.25,1.2)}
export function diseaseResistanceFactor(sim,i){const n=sim.npcs,a=n.nutritionAt(i,NUTRITION.FRESH),b=n.nutritionAt(i,NUTRITION.PROTEIN),c=n.nutritionAt(i,NUTRITION.ENERGY);return clamp(.62+(a+b+c)/3*.45,.58,1.08)}
export function hasUntreatedWound(sim,i){const p=ensureSurvival(sim.npcs);return(p.wounds[i]||[]).some(w=>w.severity>.18&&!w.treated)}
export function foodTotal(sim){let total=0;const n=sim.npcs;for(const i of n.living())for(const k of FOOD_LIST)total+=n.inventory[i][k]||0;for(const b of sim.world.foodBatches||[])total+=b.amount||0;return total}
export function foodStateName(v){return FOOD_STATE_NAMES[v]||'fresco'}
export function woundLabel(w){return`${WOUND_NAMES[w.type]||'ferimento'} em ${REGION_NAMES[w.region]||'corpo'}`}

export function addWound(sim,i,type=WOUND_TYPE.CUT,region=BODY_REGION.TORSO,severity=.25,source='acidente'){
 const n=sim.npcs,p=ensureSurvival(n),list=p.wounds[i];severity=clamp(severity,.04,1);const bleedFactor=type===WOUND_TYPE.CUT?.58:type===WOUND_TYPE.PUNCTURE?.45:type===WOUND_TYPE.FRACTURE?.08:type===WOUND_TYPE.BURN?.12:.03;
 const wound={id:`${n.uid[i]}:${sim.tick}:${list.length}`,type,region,severity,original:severity,born:sim.tick,bleeding:severity*bleedFactor,infected:false,treated:false,cleaned:false,source,healed:0};
 if(list.length>=4){let weakest=0;for(let q=1;q<list.length;q++)if(list[q].severity<list[weakest].severity)weakest=q;if(list[weakest].severity>=severity)return list[weakest];list.splice(weakest,1)}list.push(wound);n.wound[i]=Math.max(n.wound[i],severity);p.lastWound[i]=n.wound[i];sim.memory?.remember?.(i,{type:'ferimento',text:`Sofri ${woundLabel(wound)}.`,tick:sim.tick,valence:-5,importance:.58+severity*.35,reflectionKey:'ferimentos'});return wound;
}

export function treatWorstWound(sim,caregiver,target){const n=sim.npcs,p=ensureSurvival(n),list=p.wounds[target]||[];if(!list.length)return false;let w=list[0];for(const q of list)if(q.severity+q.bleeding>w.severity+w.bleeding)w=q;const tech=technologyFor(sim),water=n.inventory[caregiver][RESOURCE.WATER]||0;if(water>=.03){n.inventory[caregiver][RESOURCE.WATER]-=.03;w.cleaned=true}if(tech.knows(n,caregiver,15)&&n.inventory[caregiver][RESOURCE.BERRY]>=.02){n.inventory[caregiver][RESOURCE.BERRY]-=.02;w.cleaned=true}w.treated=true;w.bleeding*=.22;n.addSkill(caregiver,12,.006);sim.memory?.remember?.(target,{type:'tratamento',text:`${n.names[caregiver]} cuidou de ${woundLabel(w)}.`,tick:sim.tick,valence:3,importance:.72,reflectionKey:'cura'});return true}

export function clothingInsulation(sim,i){const n=sim.npcs,p=ensureSurvival(n),layers=p.clothingLayers[i],dur=p.clothingDurability[i];let v=0;if(layers&CLOTHING.FUR)v+=.18;if(layers&CLOTHING.LEATHER)v+=.3;if(layers&CLOTHING.WOOL)v+=.38;if(n.armor[i]===ARMOR.IRON)v+=.08;return clamp(v*dur,0,.72)}

function syncPersonalFood(sim,i,p){const n=sim.npcs,inv=n.inventory[i],lots=p.foodLots[i];for(let q=0;q<FOOD_LIST.length;q++){const kind=FOOD_LIST[q],slot=i*FOOD_LIST.length+q,prev=p.foodShadow[slot],cur=inv[kind]||0,diff=cur-prev;if(diff>.0005){lots.push(makeLot(kind,diff,sim.tick,kind===RESOURCE.PRESERVED?'cozido':'nenhum',kind===RESOURCE.PRESERVED?.62:0,kind!==RESOURCE.PRESERVED))}else if(diff<-.0005){const consumed=consumeLots(lots,kind,-diff,sim);if(consumed.spoiled>.001){n.setNeed(i,0,n.need(i,0)+Math.min(.18,consumed.spoiled*.5));for(let k=0;k<NUTRITION.COUNT;k++)n.nutrition[i*NUTRITION.COUNT+k]=Math.max(0,n.nutrition[i*NUTRITION.COUNT+k]-consumed.spoiled*.08);if(sim.rng.chance(Math.min(.45,.08+consumed.spoiled*.8)))infect(sim,i,0)}}p.foodShadow[slot]=inv[kind]||0}
 let rotten=0;for(const lot of lots){updateLotState(sim,lot,n.x[i],n.y[i]);if(lot.state===FOOD_STATE.ROTTEN&&lot.amount>0){rotten+=lot.amount;inv[lot.kind]=Math.max(0,inv[lot.kind]-lot.amount);lot.amount=0}}
 if(rotten>.03&&sim.tick%120===i%120)sim.senses?.emitSmell?.(n.x[i],n.y[i],16,'podridão',n.uid[i],sim.tick,180);
 p.foodLots[i]=lots.filter(l=>l.amount>.001);for(let q=0;q<FOOD_LIST.length;q++)p.foodShadow[i*FOOD_LIST.length+q]=inv[FOOD_LIST[q]]||0;
}

function syncWater(sim,i,p){const n=sim.npcs,inv=n.inventory[i],prev=p.waterShadow[i],cap=waterCapacity(sim,i);if(inv[RESOURCE.WATER]>cap)inv[RESOURCE.WATER]=cap;const cur=inv[RESOURCE.WATER];if(cur>prev+.002){const q=sourceWaterQuality(sim,i);p.waterQuality[i]=prev>.02?clamp((p.waterQuality[i]*prev+q*(cur-prev))/cur):q}const t=technologyFor(sim);if(cur>.04&&(t.knows(n,i,14))&&(t.knows(n,i,41)||t.knows(n,i,42)||t.knows(n,i,19))&&nearFire(sim,i))p.waterQuality[i]=1;p.waterShadow[i]=cur}
function sourceWaterQuality(sim,i){const n=sim.npcs,w=sim.world,near=w.resourcesNear(n.x[i],n.y[i],2.5,RESOURCE.WATER)?.[0];if(!near)return.78;const wk=w.waterKind?.[w.idx(near.x,near.y)]??WATER_KIND.NONE;return wk===WATER_KIND.RIVER?.98:wk===WATER_KIND.LAKE?.58:wk===WATER_KIND.OCEAN?.18:.42}

function syncWounds(sim,i,p){const n=sim.npcs,cur=n.wound[i]||0,prev=p.lastWound[i]||0;if(cur>prev+.015){const delta=cur-prev,seed=noiseHash(n.uid[i],sim.tick,sim.seed+991),type=n.action[i]===ACTION.FIGHT||n.action[i]===ACTION.HUNT?(seed>.5?WOUND_TYPE.CUT:WOUND_TYPE.PUNCTURE):(seed>.72?WOUND_TYPE.FRACTURE:WOUND_TYPE.CONTUSION),region=Math.floor(noiseHash(n.uid[i],sim.tick,sim.seed+992)*4);addWound(sim,i,type,region,Math.max(.12,delta*2.2),n.action[i]||'acidente')}else if(cur<prev-.025&&p.wounds[i]?.length){let worst=p.wounds[i][0];for(const w of p.wounds[i])if(w.severity>worst.severity)worst=w;worst.treated=true;worst.cleaned=true;worst.bleeding*=.3}p.lastWound[i]=n.wound[i]}

function updateWounds(sim,i,p){const n=sim.npcs,list=p.wounds[i];if(!list.length){n.wound[i]=Math.max(0,n.wound[i]-.00002);p.lastWound[i]=n.wound[i];return}const heal=healingFactor(sim,i),rest=n.action[i]===ACTION.SLEEP?1.7:1;for(const w of list){if(w.bleeding>.001){n.hp[i]=Math.max(0,n.hp[i]-w.bleeding*.00018);w.bleeding=Math.max(0,w.bleeding-(w.treated?.00075:.00008))}if(!w.infected&&!w.cleaned&&w.severity>.18&&sim.tick-w.born>180&&sim.tick%60===i%60&&sim.rng.chance(.015*w.severity*(2-diseaseResistanceFactor(sim,i)))){w.infected=infect(sim,i,2)||w.infected}const infectionPenalty=w.infected?.45:1,rate=.000045*heal*rest*(w.treated?1.8:1)*infectionPenalty;w.severity=Math.max(0,w.severity-rate);w.healed+=rate}
 const healed=list.filter(w=>w.severity<=.02);for(const w of healed)finishWound(sim,i,p,w);p.wounds[i]=list.filter(w=>w.severity>.02);n.wound[i]=p.wounds[i].reduce((m,w)=>Math.max(m,w.severity),0);p.lastWound[i]=n.wound[i]}
function finishWound(sim,i,p,w){if(w.original<.42)return;const n=sim.npcs,scar={type:w.type,region:w.region,born:w.born,healed:sim.tick,source:w.source,sequela:null};const roll=noiseHash(n.uid[i],w.born,sim.seed+1207);if(w.original>.62&&roll>.42){if(w.region===BODY_REGION.LEGS){p.sequelaSpeed[i]=clamp(p.sequelaSpeed[i]+.04+w.original*.08,0,.35);scar.sequela='marcha limitada'}else if(w.region===BODY_REGION.ARMS){p.sequelaStrength[i]=clamp(p.sequelaStrength[i]+.04+w.original*.07,0,.3);scar.sequela='força manual reduzida'}else if(w.region===BODY_REGION.HEAD){p.sequelaPerception[i]=clamp(p.sequelaPerception[i]+.04+w.original*.06,0,.3);scar.sequela='percepção reduzida'}}p.scars[i].push(scar);if(p.scars[i].length>10)p.scars[i].shift();sim.memory?.remember?.(i,{type:'cicatriz',text:`${woundLabel(w)} cicatrizou${scar.sequela?`, deixando ${scar.sequela}`:''}.`,tick:sim.tick,valence:-1,importance:.72,reflectionKey:'corpo'})}

function updateThermal(sim,i,p){const n=sim.npcs,w=sim.world,tile=w.tile(n.x[i],n.y[i]),ambient=w.temperatureAt(n.x[i],n.y[i],sim.tick,ambientTemperature(sim.tick)),shelter=w.nearBuilding(n.x[i],n.y[i],BUILDING.SHELTER,2.7)||w.nearBuilding(n.x[i],n.y[i],BUILDING.CELLAR,2.7),fire=nearFire(sim,i),weather=weatherAt(sim,n.x[i],n.y[i],ambient);if(tile===TILE_TYPE.WATER)p.wetness[i]=clamp(p.wetness[i]+.035);else if(tile===TILE_TYPE.MARSH)p.wetness[i]=clamp(p.wetness[i]+.008);else if(weather==='chuva'&&!shelter)p.wetness[i]=clamp(p.wetness[i]+.004);else if(weather==='neve'&&!shelter)p.wetness[i]=clamp(p.wetness[i]+.0018);const dry=fire?.018:shelter?.006:.0011;p.wetness[i]=Math.max(0,p.wetness[i]-dry);
 if(n.armor[i]!==p.lastArmor[i]){if(n.armor[i]===ARMOR.LEATHER)p.clothingLayers[i]|=CLOTHING.LEATHER;if(n.armor[i]===ARMOR.CLOTH)p.clothingLayers[i]|=CLOTHING.WOOL;p.clothingDurability[i]=1;p.lastArmor[i]=n.armor[i]}if(n.action[i]===ACTION.TAILOR)p.clothingDurability[i]=Math.min(1,p.clothingDurability[i]+.0015);else if(p.clothingLayers[i]&&(p.wetness[i]>.5||ambient<4))p.clothingDurability[i]=Math.max(.25,p.clothingDurability[i]-.000012);
 const insulation=clamp(clothingInsulation(sim,i)+(shelter?.32:0)+(fire?.42:0),0,.88),nutrition=(n.nutritionAt(i,0)+n.nutritionAt(i,1)+n.nutritionAt(i,2))/3,active=n.moving[i]||![ACTION.IDLE,ACTION.SLEEP].includes(n.action[i]),metabolic=(active?.00052:.00025)*(.65+nutrition*.35),wind=Math.abs(w.wind?.dx||0)+Math.abs(w.wind?.dy||0),coldLoad=Math.max(0,18-ambient)/24,heatLoad=Math.max(0,ambient-30)/14,loss=.00078*coldLoad*(1+p.wetness[i]*1.8)*(1+wind*.08)*(1-insulation),gain=.0007*heatLoad*(1-insulation*.25);p.bodyTemp[i]+=metabolic-loss+gain+(36.8-p.bodyTemp[i])*.00045;
 const temp=p.bodyTemp[i],stress=temp<36.4?clamp((36.4-temp)/4.8):temp>37.6?clamp((temp-37.6)/3.4):0;n.setNeed(i,3,stress);p.thermalStage[i]=temp<32?3:temp<34?2:temp<35.5?1:temp>39?4:0;if(temp<35.5)n.stamina[i]=Math.max(0,n.stamina[i]-(35.5-temp)*.00018);if(temp<32.2)n.hp[i]=Math.max(0,n.hp[i]-.00045);if(temp>38.4)n.setNeed(i,1,n.need(i,1)+.0012*(temp-38.4));if(temp>39.3)n.hp[i]=Math.max(0,n.hp[i]-.00035);if(temp<32.8&&p.wetness[i]>.55&&sim.tick%60===i%60&&sim.rng.chance(.035)){const leg=noiseHash(n.uid[i],sim.tick,sim.seed+1301)>.5;if(leg)p.sequelaSpeed[i]=clamp(p.sequelaSpeed[i]+.035,0,.35);else p.sequelaStrength[i]=clamp(p.sequelaStrength[i]+.035,0,.3);p.scars[i].push({type:'congelamento',region:leg?BODY_REGION.LEGS:BODY_REGION.ARMS,born:sim.tick,healed:sim.tick,sequela:'extremidade congelada'});sim.memory?.remember?.(i,{type:'sequela',text:'O frio lesionou permanentemente minhas extremidades.',tick:sim.tick,valence:-7,importance:.9,reflectionKey:'inverno'})}}

function updateNutrition(sim,i,p){const n=sim.npcs;if(sim.tick%DAY_TICKS===i%DAY_TICKS){n.addNutrition(i,NUTRITION.FRESH,-.018);n.addNutrition(i,NUTRITION.PROTEIN,-.012);n.addNutrition(i,NUTRITION.ENERGY,-.01)}const fresh=n.nutritionAt(i,NUTRITION.FRESH),protein=n.nutritionAt(i,NUTRITION.PROTEIN),energy=n.nutritionAt(i,NUTRITION.ENERGY),def=(Math.max(0,.42-fresh)+Math.max(0,.42-protein)+Math.max(0,.42-energy))/1.26;if(def>.55)n.stamina[i]=Math.max(0,n.stamina[i]-.00018*def);if(def>.78)n.hp[i]=Math.max(0,n.hp[i]-.0001*def)}

function updateWorldFood(sim){const w=sim.world;for(const lot of w.foodBatches||[]){normalizeLot(lot);updateLotState(sim,lot,lot.x??w.settlement.x,lot.y??w.settlement.y);if(lot.state===FOOD_STATE.ROTTEN&&lot.amount>0){w.stock[lot.kind]=Math.max(0,w.stock[lot.kind]-lot.amount);if(!lot.rottenLogged){lot.rottenLogged=true;sim.senses?.emitSmell?.(lot.x??w.settlement.x,lot.y??w.settlement.y,24,'podridão',-1,sim.tick,300);sim.log?.('estoque',`${lot.amount.toFixed(1)} de ${RESOURCE.NAMES[lot.kind]} apodreceu no armazenamento.`,.52)}lot.amount=0}}if(w.foodBatches.length>240)w.foodBatches=w.foodBatches.filter(l=>l.amount>.001)}
function preserveWorldFood(sim){const w=sim.world,n=sim.npcs,t=technologyFor(sim),alive=n.living();if(!alive.length)return;const has=id=>alive.some(i=>t.knows(n,i,id)),salt=has(38)||has(21),smoke=has(37)||has(9),dry=has(36),ferment=has(39)||has(19),cellar=has(40)&&w.buildings.some(b=>b.finished&&b.type===BUILDING.CELLAR),lit=w.buildings.some(b=>b.finished&&b.type===BUILDING.CAMPFIRE&&b.lit);for(const lot of w.foodBatches){normalizeLot(lot);if(lot.amount<=.001||lot.quality>.02)continue;const meat=lot.kind===RESOURCE.MEAT||lot.kind===RESOURCE.FISH,fermentable=lot.kind===RESOURCE.MILK||lot.kind===RESOURCE.BERRY,locX=lot.x??w.settlement.x,locY=lot.y??w.settlement.y,moist=w.moisture?.[w.idx(locX,locY)]??.5,temp=w.temperatureAt(locX,locY,sim.tick,ambientTemperature(sim.tick));if(meat&&salt&&w.stock[RESOURCE.SALT]>.02){const use=Math.min(w.stock[RESOURCE.SALT],Math.max(.02,lot.amount*.045));w.stock[RESOURCE.SALT]-=use;lot.preservation='salgado';lot.quality=.82;lot.raw=false}else if(meat&&smoke&&lit&&w.stock[RESOURCE.LOG]>.03){w.stock[RESOURCE.LOG]-=.03;lot.preservation='defumado';lot.quality=.62;lot.raw=false}else if(fermentable&&ferment){lot.preservation='fermentado';lot.quality=.56;lot.raw=false}else if(dry&&moist<.38){lot.preservation='seco';lot.quality=.36}else if(cellar){lot.preservation='adega';lot.quality=.42}else if(temp<3||season(sim.tick)==='inverno'&&w.biome(locX,locY)===4){lot.preservation='gelo';lot.quality=.58}}}

function makeLot(kind,amount,born,preservation='nenhum',quality=0,raw=true){return{kind,amount,born,state:FOOD_STATE.FRESH,preservation,quality,raw,rottenLogged:false}}
function normalizeLot(lot){lot.born??=0;lot.state=Number.isInteger(lot.state)?lot.state:FOOD_STATE.FRESH;lot.preservation??='nenhum';lot.quality??=lot.kind===RESOURCE.PRESERVED?.62:0;lot.raw??=lot.kind!==RESOURCE.PRESERVED;lot.amount??=0;return lot}
function updateLotState(sim,lot,x,y){normalizeLot(lot);const w=sim.world,age=Math.max(0,sim.tick-lot.born),base=(FOOD_BASE_DAYS[lot.kind]||6)*DAY_TICKS,temp=w.temperatureAt(x,y,sim.tick,ambientTemperature(sim.tick)),moist=w.moisture?.[w.idx(x,y)]??.5,tempF=clamp(.35+(temp+5)/28,.35,2.05),moistF=.72+moist*.7,preserve=Math.max(.12,1-lot.quality*.86),ratio=age*tempF*moistF*preserve/Math.max(1,base);lot.state=ratio<.58?FOOD_STATE.FRESH:ratio<1?FOOD_STATE.RIPE:ratio<1.45?FOOD_STATE.SPOILED:FOOD_STATE.ROTTEN;return lot.state}
function consumeLots(lots,kind,amount,sim){let left=amount,spoiled=0;const candidates=lots.filter(l=>l.kind===kind&&l.amount>.001).sort((a,b)=>b.state-a.state||a.born-b.born);for(const lot of candidates){if(left<=.001)break;const take=Math.min(left,lot.amount);lot.amount-=take;left-=take;if(lot.state===FOOD_STATE.SPOILED)spoiled+=take}return{spoiled,amount:amount-left}}

function weatherAt(sim,x,y,ambient){const w=sim.world,moist=w.moisture?.[w.idx(x,y)]??.4,slot=Math.floor(sim.tick/60),roll=noiseHash(Math.floor(x/8),Math.floor(y/8)+slot,sim.seed+1441),threshold=.035+moist*.13;if(roll>threshold)return'claro';return ambient<=1?'neve':'chuva'}
function nearFire(sim,i){const n=sim.npcs;return sim.world.buildings.some(b=>b.finished&&b.type===BUILDING.CAMPFIRE&&b.lit&&Math.hypot(b.x-n.x[i],b.y-n.y[i])<4.5)}
function thermalLabel(t){return t<32?'colapso':t<34?'confusão':t<35.5?'tremor':t>39?'exaustão por calor':t>38?'calor':'confortável'}
function clothingLabel(mask){const a=[];if(mask&CLOTHING.FUR)a.push('peles');if(mask&CLOTHING.LEATHER)a.push('couro');if(mask&CLOTHING.WOOL)a.push('lã');return a.join(' + ')||'sem camada isolante'}
function firstLiving(n){for(let i=0;i<n.count;i++)if(n.alive[i])return i;return-1}

function serializePhaseF(p){return{bodyTemp:Array.from(p.bodyTemp),wetness:Array.from(p.wetness),clothingDurability:Array.from(p.clothingDurability),clothingLayers:Array.from(p.clothingLayers),thermalStage:Array.from(p.thermalStage),sequelaSpeed:Array.from(p.sequelaSpeed),sequelaStrength:Array.from(p.sequelaStrength),sequelaPerception:Array.from(p.sequelaPerception),waterQuality:Array.from(p.waterQuality),waterShadow:Array.from(p.waterShadow),lastWound:Array.from(p.lastWound),lastArmor:Array.from(p.lastArmor),foodShadow:Array.from(p.foodShadow),foodLots:p.foodLots,wounds:p.wounds,scars:p.scars}}
function hydratePhaseF(n,d){const p=ensureSurvival(n);if(!d)return p;for(const k of['bodyTemp','wetness','clothingDurability','clothingLayers','thermalStage','sequelaSpeed','sequelaStrength','sequelaPerception','waterQuality','waterShadow','lastWound','lastArmor','foodShadow'])if(d[k]&&p[k]?.set)p[k].set(d[k].slice(0,p[k].length));for(const k of['foodLots','wounds','scars'])if(d[k])for(let i=0;i<Math.min(MAX_NPCS,d[k].length);i++)p[k][i]=(d[k][i]||[]).map(x=>({...x}));return p}

if(!NPCStore.prototype.__phaseFInstalled){
 const baseSerialize=NPCStore.prototype.serialize,baseDerived=NPCStore.prototype.derived,baseHydrate=NPCStore.hydrate;
 NPCStore.prototype.serialize=function(){const out=baseSerialize.call(this);out.phaseF=serializePhaseF(ensureSurvival(this));return out};
 NPCStore.hydrate=function(d){const n=baseHydrate.call(NPCStore,d);hydratePhaseF(n,d?.phaseF);return n};
 NPCStore.prototype.derived=function(i){const d=baseDerived.call(this,i),p=ensureSurvival(this),w=p.wounds[i]||[],leg=w.reduce((m,x)=>x.region===BODY_REGION.LEGS?Math.max(m,x.severity):m,0),arm=w.reduce((m,x)=>x.region===BODY_REGION.ARMS?Math.max(m,x.severity):m,0),head=w.reduce((m,x)=>x.region===BODY_REGION.HEAD?Math.max(m,x.severity):m,0),conf=p.bodyTemp[i]<34?.72:p.bodyTemp[i]<35.2?.9:1;d.speed*=Math.max(.35,1-p.sequelaSpeed[i]-leg*.55);d.strength*=Math.max(.4,1-p.sequelaStrength[i]-arm*.5);d.perception*=Math.max(.45,1-p.sequelaPerception[i]-head*.45)*conf;d.longPerception*=Math.max(.45,1-p.sequelaPerception[i]-head*.45)*conf;d.hearing*=conf;return d};
 Object.defineProperty(NPCStore.prototype,'__phaseFInstalled',{value:true});
}

if(!World.prototype.__phaseFFoodInstalled){
 const baseTemp=World.prototype.temperatureAt;
 World.prototype.temperatureAt=function(x,y,tick,ambient){let v=baseTemp.call(this,x,y,tick,ambient);if(this.nearBuilding(x,y,BUILDING.CELLAR,3))v-=6;return v};
 World.prototype.addFoodBatch=function(kind,amount,tick,opts={}){if(!FOOD_KINDS.has(kind)&&kind!==RESOURCE.FAT||amount<=0)return;const lot=makeLot(kind,amount,tick,opts.preservation||'nenhum',opts.quality??(kind===RESOURCE.PRESERVED?.62:0),opts.raw??kind!==RESOURCE.PRESERVED);lot.x=opts.x??this.settlement.x;lot.y=opts.y??this.settlement.y;this.foodBatches.push(lot);this.stock[kind]+=amount;return lot};
 World.prototype.expireFood=function(){if(this.foodBatches.length>260)this.foodBatches=this.foodBatches.filter(b=>(b.amount||0)>.001)};
 World.prototype.consumeFood=function(){const rank=[0,1,2,9],lots=this.foodBatches.filter(b=>(b.amount||0)>.02&&b.state!==FOOD_STATE.ROTTEN).sort((a,b)=>(rank[b.state]??0)-(rank[a.state]??0)||a.born-b.born);const b=lots[0];if(!b)return null;const amount=Math.min(.14,b.amount);b.amount-=amount;this.stock[b.kind]=Math.max(0,this.stock[b.kind]-amount);return{kind:b.kind,amount,state:b.state,raw:b.raw,spoiled:b.state===FOOD_STATE.SPOILED,preservation:b.preservation}};
 Object.defineProperty(World.prototype,'__phaseFFoodInstalled',{value:true});
}
