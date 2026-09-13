import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,RESOURCE,TILE_TYPE} from '../src/core/constants.js';
import {prepareAction} from '../src/systems/actions.js';
import {executeTick} from '../src/systems/executor.js';
import {ensureConstruction} from '../src/systems/construction.js';
import {isTargetCooling,isActionSuppressed,recordTaskOutcome} from '../src/systems/failure-guard.js';
import {scoreActions} from '../src/ai/utility.js';

function emptyTile(w,kind){for(let y=4;y<188;y++)for(let x=4;x<188;x++){const t=w.tile(x+.5,y+.5);if(t===TILE_TYPE.WATER||t===TILE_TYPE.MOUNTAIN)continue;if(!w.findResourceAt(x+.5,y+.5,kind,1.5))return{x:x+.5,y:y+.5,tile:w.idx(x,y)}}throw new Error('sem tile vazio')}

const sim=new Simulation(7070),w=ensureConstruction(sim),n=sim.npcs,i=n.living()[0],m=sim.memory,cap=m.spatialCapacity(n,i),fake=emptyTile(w,RESOURCE.BERRY),bit=1<<RESOURCE.BERRY;
n.x[i]=fake.x;n.y[i]=fake.y;n.homeX[i]=fake.x;n.homeY[i]=fake.y;m.observe(i,fake.tile,sim.tick,bit,0,cap,1,-1);
assert.equal(prepareAction(sim,i,ACTION.FORAGE,{}),true,'memória falsa deve conseguir iniciar uma tentativa');executeTick(sim,i,1);
assert.equal(n.intent[i],null,'referência inválida deve encerrar a tarefa');assert.ok(isTargetCooling(sim,i,ACTION.FORAGE,fake.x,fake.y),'alvo falho deve entrar em cooldown');assert.ok((m.episodic.get(i)||[]).some(e=>e.type==='correção de memória'),'falha deve gerar memória episódica negativa');
// Mesmo se informação velha voltar por compartilhamento, o cooldown impede reeleição imediata.
m.observe(i,fake.tile,sim.tick,bit,0,cap,1,-1);assert.notEqual(m.recallNearest(i,n.x[i],n.y[i],RESOURCE.BERRY,sim.tick)?.tile,fake.tile,'cooldown deve bloquear o mesmo tile reintroduzido');
// Três falhas consecutivas removem temporariamente a ação inteira da disputa.
recordTaskOutcome(sim,i,{action:ACTION.FORAGE,sourceX:fake.x+2,sourceY:fake.y},false,'referência inválida');recordTaskOutcome(sim,i,{action:ACTION.FORAGE,sourceX:fake.x+3,sourceY:fake.y},false,'referência inválida');
assert.ok(isActionSuppressed(sim,i,ACTION.FORAGE),'sequência de falhas deve suspender a ação');const forageScore=scoreActions(sim,i,{}).find(x=>x[0]===ACTION.FORAGE)?.[1]??0;assert.equal(forageScore,0,'ação suprimida não pode continuar competindo na utility AI');
// Causa raiz: percepção curta precisa apagar fatos positivos que a realidade visível contradiz.
const root=new Simulation(7171),rw=ensureConstruction(root),rn=root.npcs,ri=rn.living()[0],rm=root.memory,rcap=rm.spatialCapacity(rn,ri),other=rw.resources.find(r=>r.amount>.01&&r.kind!==RESOURCE.BERRY&&rw.tile(r.x,r.y)!==TILE_TYPE.WATER);assert.ok(other,'seed precisa ter recurso não-fruta');rn.x[ri]=other.x;rn.y[ri]=other.y;const rtile=rw.idx(other.x,other.y);rm.observe(ri,rtile,root.tick,1<<RESOURCE.BERRY,0,rcap,1,-1);assert.equal(rm.recallNearest(ri,rn.x[ri],rn.y[ri],RESOURCE.BERRY,root.tick)?.tile,rtile,'pré-condição: memória falsa existe');rw.resourcesNear(rn.x[ri],rn.y[ri],Math.max(2,rn.derived(ri).perception));assert.notEqual(rm.recallNearest(ri,rn.x[ri],rn.y[ri],RESOURCE.BERRY,root.tick)?.tile,rtile,'visão atual sem fruta deve remover a associação falsa');assert.ok((rm._failureGuard?.reconciled||0)>0,'reconciliação de ausência deve ser contabilizada');
console.log('OK failure guard: invalidação, cooldown, teto de tentativas e ausência perceptiva');
