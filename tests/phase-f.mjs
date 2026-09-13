import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {DAY_TICKS,RESOURCE,ARMOR,NUTRITION,WOUND_TYPE,BODY_REGION,FOOD_STATE} from '../src/core/constants.js';
import {ensureSurvival,survivalTick,survivalSummary,waterCapacity,fertilityFactor,addWound,treatWorstWound,foodTotal} from '../src/systems/survival.js';
import {noiseHash} from '../src/core/rng.js';

const sim=new Simulation(6060),n=sim.npcs,w=sim.world,i=n.living()[0],j=n.living()[1],p=ensureSurvival(n);
assert.ok(p.bodyTemp instanceof Float32Array&&p.wetness instanceof Float32Array,'estado corporal deve ser compacto');
assert.ok(Array.isArray(p.wounds[i])&&Array.isArray(p.foodLots[i]),'ferimentos e lotes devem ser listas pequenas por NPC');

// Perecibilidade: o mesmo peixe cru deve degradar muito antes do lote conservado.
w.foodBatches=[];w.stock.fill(0);const raw=w.addFoodBatch(RESOURCE.FISH,1,0,{x:n.x[i],y:n.y[i]}),salted=w.addFoodBatch(RESOURCE.FISH,1,0,{x:n.x[i],y:n.y[i],preservation:'salgado',quality:.82,raw:false});
sim.tick=DAY_TICKS*5;survivalTick(sim,i);assert.ok(raw.state>=FOOD_STATE.SPOILED,`peixe cru deveria estragar em 5 dias, estado=${raw.state}`);assert.ok(salted.state<raw.state,'conservação precisa estender o prazo');

// Estoque podre é removido fisicamente em vez de acumular para sempre.
sim.tick=DAY_TICKS*18;survivalTick(sim,i);assert.ok((raw.amount||0)===0,'lote podre precisa sair do estoque comestível');assert.ok(foodTotal(sim)<2,'estoque perecível não pode inflar indefinidamente');

// Temperatura corporal: roupa muda o resultado no mesmo frio.
const cold=new Simulation(7070),cn=cold.npcs,ci=cn.living()[0],cj=cn.living()[1],cp=ensureSurvival(cn);cold.world.temperatureAt=()=>-6;cn.armor[cj]=ARMOR.LEATHER;for(let t=0;t<700;t++){cold.tick++;survivalTick(cold,ci);survivalTick(cold,cj)}assert.ok(cp.bodyTemp[cj]>cp.bodyTemp[ci]+.12,`roupa não alterou temperatura: ${cp.bodyTemp[ci]} vs ${cp.bodyTemp[cj]}`);

// Molhado multiplica risco térmico e seca sob abrigo/fogo; atravessar água é detectado.
const water=cold.world.resources.find(r=>r.kind===RESOURCE.WATER);assert.ok(water,'mundo precisa ter água');cn.x[ci]=water.x;cn.y[ci]=water.y;cold.tick++;survivalTick(cold,ci);assert.ok(cp.wetness[ci]>0,'entrar na água precisa molhar o NPC');

// Ferimentos são entidades com sangramento, tratamento e cicatriz/sequela potencial.
const woundSim=new Simulation(8080),wn=woundSim.npcs,wi=wn.living()[0],care=wn.living()[1],wp=ensureSurvival(wn);while(noiseHash(wn.uid[wi],woundSim.tick,woundSim.seed+1207)<=.42)woundSim.tick++;const wound=addWound(woundSim,wi,WOUND_TYPE.FRACTURE,BODY_REGION.LEGS,.78,'javali');const hp0=wn.hp[wi];for(let q=0;q<120;q++){woundSim.tick++;survivalTick(woundSim,wi)}assert.ok(wn.hp[wi]<hp0,'sangramento/trauma agudo precisa ter consequência');wn.inventory[care][RESOURCE.WATER]=1;wn.inventory[care][RESOURCE.BERRY]=1;const bleed=wound.bleeding;assert.ok(treatWorstWound(woundSim,care,wi),'tratamento deve encontrar o ferimento');assert.ok(wound.bleeding<bleed,'tratamento precisa conter sangramento');wound.severity=.019;woundSim.tick++;survivalTick(woundSim,wi);assert.ok(wp.scars[wi].length>=1,'ferimento grave curado deve deixar cicatriz');assert.ok(wp.sequelaSpeed[wi]>0,'fratura grave de perna deve poder deixar sequela');

// Dieta variada altera fertilidade e recuperação de fundo.
wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.FRESH]=.08;wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.PROTEIN]=.08;wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.ENERGY]=.08;const badDiet=fertilityFactor(woundSim,wi);wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.FRESH]=.9;wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.PROTEIN]=.9;wn.nutrition[wi*NUTRITION.COUNT+NUTRITION.ENERGY]=.9;assert.ok(fertilityFactor(woundSim,wi)>badDiet+.35,'diversidade nutricional precisa ter efeito material');

// Tecnologia de recipiente aumenta autonomia hídrica.
const baseCap=waterCapacity(woundSim,wi);woundSim.technology.setKnown(wn,wi,41,-1,woundSim.tick);const skinCap=waterCapacity(woundSim,wi);woundSim.technology.setKnown(wn,wi,42,-1,woundSim.tick);const potCap=waterCapacity(woundSim,wi);assert.ok(skinCap>baseCap&&potCap>skinCap,`recipientes não ampliaram capacidade: ${baseCap}/${skinCap}/${potCap}`);

// Save/load preserva o estado corporal e a história escrita no corpo.
const saved=woundSim.serialize(),restored=Simulation.hydrate(JSON.parse(JSON.stringify(saved))),rp=ensureSurvival(restored.npcs);assert.equal(rp.scars[wi].length,wp.scars[wi].length,'cicatrizes se perderam no save');assert.equal(rp.wounds[wi].length,wp.wounds[wi].length,'ferimentos se perderam no save');assert.equal(rp.bodyTemp[wi],wp.bodyTemp[wi],'temperatura corporal se perdeu no save');assert.equal(restored.serialize().npcs.phaseF.scars[wi].length,saved.npcs.phaseF.scars[wi].length,'round-trip da Fase F não é estável');

const summary=survivalSummary(woundSim,wi);assert.ok(Number.isFinite(summary.temperature)&&Array.isArray(summary.wounds),'painel precisa receber estado legível');
console.log('OK Phase F: perecibilidade, conservação, térmica, molhado, ferimentos, nutrição, recipientes e round-trip');
