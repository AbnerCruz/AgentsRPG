import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {NPCStore} from '../src/entities/npcs.js';
import {ACTION,BUILDING,DAY_TICKS,GENE,MAX_NPCS,NEED,NPC_STATE} from '../src/core/constants.js';
import {BALANCE} from '../src/calibration/balance.js';
import {updateNeeds} from '../src/ai/drives.js';
import {scoreActions} from '../src/ai/utility.js';
import {perceive} from '../src/ai/perception.js';
import {movementSpeed} from '../src/systems/executor.js';

assert.equal(GENE.HEARING,26);assert.equal(GENE.SMELL,27);assert.equal(GENE.RARE_A,28);assert.equal(GENE.RARE_B,29);assert.equal(GENE.COUNT,30,'genes raros precisam de slots próprios');
assert.equal(BALANCE.movementBase,.30,'velocidade base auditada deve ser 0,30');
assert.equal(BALANCE.sleepRate,.0008,'sono deve acumular em escala diária');
assert.ok(1/(BALANCE.sleepRate*DAY_TICKS)<=1.6,'sono ainda leva mais de ~1,6 dia para saturar');

const sim=new Simulation(5151),n=sim.npcs,i=n.living()[0];
n.stamina[i]=.6;n.wound[i]=0;n.pain[i]=0;for(const inv of n.inventory)inv.fill(0);
assert.ok(movementSpeed(sim,i)>.07,'movimento continua lento demais mesmo sem carga/ferimento');

// Segurança: noite exposta aumenta insegurança; abrigo físico a reduz.
sim.tick=Math.floor(DAY_TICKS*.82);n.setNeed(i,NEED.SAFETY,.1);n.action[i]=ACTION.IDLE;n.state[i]=NPC_STATE.IDLE;
updateNeeds(sim,i,0);const exposed=n.need(i,NEED.SAFETY);assert.ok(exposed>.1,'noite exposta precisa elevar SAFETY');
const shelter=sim.world.addBuilding(BUILDING.SHELTER,n.x[i],n.y[i],true,n.uid[i]);n.homeX[i]=shelter.x;n.homeY[i]=shelter.y;
updateNeeds(sim,i,0);assert.ok(n.need(i,NEED.SAFETY)<exposed,'abrigo precisa reduzir SAFETY');

// Propósito não pode ficar morto em zero e exploração deve satisfazê-lo.
n.setNeed(i,NEED.PURPOSE,0);n.action[i]=ACTION.IDLE;updateNeeds(sim,i,0);const idlePurpose=n.need(i,NEED.PURPOSE);assert.ok(idlePurpose>0,'ociosidade precisa acumular PURPOSE');
n.action[i]=ACTION.EXPLORE;updateNeeds(sim,i,0);assert.ok(n.need(i,NEED.PURPOSE)<idlePurpose,'exploração precisa aliviar PURPOSE');

// SAFETY deve gerar recolhimento/repouso, não fuga fantasma sem ameaça.
n.x[i]=shelter.x+5;n.y[i]=shelter.y;n.setNeed(i,NEED.SAFETY,.8);n.setNeed(i,NEED.SLEEP,.8);const p=perceive(sim,i),scores=scoreActions(sim,i,p),score=a=>scores.find(x=>x[0]===a)?.[1]||0;
assert.ok(score(ACTION.RETURN)>0,'SAFETY alta à noite precisa pontuar RETURN');
assert.ok(score(ACTION.SLEEP)>0,'sono precisa competir de verdade');
assert.equal(score(ACTION.FLEE),0,'SAFETY sem ameaça não pode inventar fuga');

// Compatibilidade: saves v10 tinham stride 28; audição/olfato devem permanecer no mesmo NPC.
const data=n.serialize(),oldGenes=new Array(MAX_NPCS*28).fill(0);for(let npc=0;npc<MAX_NPCS;npc++)for(let g=0;g<28;g++)oldGenes[npc*28+g]=data.genes[npc*GENE.COUNT+g]||0;data.genes=oldGenes;delete data.geneStride;const migrated=NPCStore.hydrate(data);
for(let npc=0;npc<Math.min(4,n.count);npc++){assert.equal(migrated.gene(npc,GENE.HEARING),n.gene(npc,GENE.HEARING));assert.equal(migrated.gene(npc,GENE.SMELL),n.gene(npc,GENE.SMELL));assert.equal(migrated.gene(npc,GENE.RARE_A),0);assert.equal(migrated.gene(npc,GENE.RARE_B),0)}

console.log('OK balance audit: movimento, sono, segurança, propósito e migração genética ativos');
