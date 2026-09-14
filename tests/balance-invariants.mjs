import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,BUILDING,DAY_TICKS,GENE,NEED} from '../src/core/constants.js';
import {isNight} from '../src/core/clock.js';
import {BALANCE} from '../src/calibration/balance.js';
import {updateNeeds} from '../src/ai/drives.js';

assert.equal(BALANCE.sleepRate,.0008,'sono deve saturar em aproximadamente 1,25 dia');
assert.equal(GENE.HEARING,26,'slot de audição deve permanecer estável para saves existentes');
assert.equal(GENE.SMELL,27,'slot de olfato deve permanecer estável para saves existentes');
assert.equal('RARE_A' in GENE,false,'gene raro não implementado não pode aliasar audição');
assert.equal('RARE_B' in GENE,false,'gene raro não implementado não pode aliasar olfato');
assert.equal(GENE.COUNT,28,'remoção dos aliases não deve alterar o stride dos saves existentes');

const sim=new Simulation(7070),n=sim.npcs,i=n.living()[0];
let nightTick=0;while(nightTick<DAY_TICKS&&!isNight(nightTick))nightTick++;assert.ok(nightTick<DAY_TICKS,'relógio precisa conter período noturno');sim.tick=nightTick;

// Sem abrigo nem fogo, insegurança noturna precisa crescer mesmo sem ameaça imediata.
sim.world.buildings=[];n.setNeed(i,NEED.SAFETY,.5);updateNeeds(sim,i,0);assert.ok(n.need(i,NEED.SAFETY)>.5,'SAFETY precisa subir à noite quando NPC está exposto');

// Abrigo deve permitir que a insegurança recue.
const shelter=sim.world.addBuilding(BUILDING.SHELTER,n.x[i],n.y[i],true,n.uid[i]);shelter.finished=true;n.setNeed(i,NEED.SAFETY,.5);updateNeeds(sim,i,0);assert.ok(n.need(i,NEED.SAFETY)<.5,'SAFETY precisa cair quando NPC está protegido');

// PURPOSE não pode ficar matematicamente colada em zero: rotina cria pressão lenta,
// enquanto exploração/construção/ensino/dungeon aliviam essa pressão.
n.intent[i]={action:ACTION.FORAGE};n.action[i]=ACTION.FORAGE;n.setNeed(i,NEED.PURPOSE,.2);updateNeeds(sim,i,0);const routinePurpose=n.need(i,NEED.PURPOSE);assert.ok(routinePurpose>.2,'rotina precisa acumular PURPOSE lentamente');
n.intent[i]={action:ACTION.EXPLORE};n.action[i]=ACTION.EXPLORE;n.setNeed(i,NEED.PURPOSE,.2);updateNeeds(sim,i,0);assert.ok(n.need(i,NEED.PURPOSE)<.2,'exploração precisa satisfazer PURPOSE');

console.log(`OK balance invariants: sleep=${BALANCE.sleepRate}, SAFETY noturna ativa, PURPOSE dinâmico e genes sensoriais sem aliases`);
