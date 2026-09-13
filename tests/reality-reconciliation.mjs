import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,RESOURCE,BUILDING,TILE_TYPE} from '../src/core/constants.js';
import {prepareAction} from '../src/systems/actions.js';
import {executeTick} from '../src/systems/executor.js';
import {ensureConstruction} from '../src/systems/construction.js';

function emptySite(w,kind){
 for(let y=5;y<187;y++)for(let x=5;x<187;x++){
  const t=w.tile(x+.5,y+.5);if(t===TILE_TYPE.WATER||t===TILE_TYPE.MOUNTAIN)continue;
  if(!w.findResourceAt(x+.5,y+.5,kind,1.5))return{x:x+.5,y:y+.5,tile:w.idx(x,y)};
 }
 throw new Error('seed de teste não contém local vazio adequado');
}
function evacuate(sim,bp){for(const j of sim.npcs.living()){sim.npcs.x[j]=bp.cx+12+(j%4);sim.npcs.y[j]=bp.cy+12+((j/4)|0)%4}}

// Fase C: memória espacial errada precisa ser corrigida quando a realidade contradiz a lembrança.
const sim=new Simulation(6060),w=ensureConstruction(sim),n=sim.npcs,i=n.living()[0],fake=emptySite(w,RESOURCE.BERRY),cap=sim.memory.spatialCapacity(n,i);
n.x[i]=fake.x;n.y[i]=fake.y;n.homeX[i]=fake.x;n.homeY[i]=fake.y;
sim.memory.observe(i,fake.tile,sim.tick,1<<RESOURCE.BERRY,0,cap,1,-1);
const before=sim.memory.recallNearest(i,n.x[i],n.y[i],RESOURCE.BERRY,sim.tick);assert.equal(before?.tile,fake.tile,'pré-condição: lembrança falsa de fruta precisa ser selecionável');
assert.equal(prepareAction(sim,i,ACTION.FORAGE,{}),true,'lembrança falsa deve gerar a expedição que será desmentida pela realidade');
w.tick(1);
const after=sim.memory.recallNearest(i,n.x[i],n.y[i],RESOURCE.BERRY,sim.tick);assert.notEqual(after?.tile,fake.tile,'recurso ausente na chegada precisa sair da memória espacial de frutas');
assert.ok((sim.memory.episodic.get(i)||[]).some(m=>m.type==='erro de memória'||m.type==='informação errada'),'contradição espacial precisa gerar memória negativa');
executeTick(sim,i,1);assert.equal(n.intent[i],null,'tarefa no recurso inexistente precisa terminar em vez de ficar presa');
assert.equal(prepareAction(sim,i,ACTION.FORAGE,{}),false,'sem nova evidência, o mesmo alvo falso não pode ser escolhido novamente');

// Fase G: uma obra fisicamente concluída não pode existir sem identidade em world.buildings.
const buildSim=new Simulation(6161),bw=ensureConstruction(buildSim),bn=buildSim.npcs,bi=bn.living()[0];
buildSim.technology.setKnown(bn,bi,1,-1,0);bn.inventory[bi][RESOURCE.LOG]=30;bn.inventory[bi][RESOURCE.STONE]=10;
const bp=bw.createBlueprint(BUILDING.SHELTER,bn.x[bi],bn.y[bi],bn.uid[bi]);assert.ok(bp,'blueprint de teste precisa existir');evacuate(buildSim,bp);
for(const p of bp.pieces)bw.completePiece(bp,p);
assert.equal(bp.done,true,'todas as peças concluídas precisam marcar o blueprint como concluído');
let matches=bw.buildings.filter(b=>b.finished&&b.type===BUILDING.SHELTER&&b.owner===bn.uid[bi]);assert.equal(matches.length,1,'blueprint concluído precisa promover exatamente uma estrutura funcional');
// Simula o estado observado no relatório/um save antigo inconsistente e exige autorreparo barato.
bw.buildings=[];bp.shellBuildingId=999999;bw.tick(120);
matches=bw.buildings.filter(b=>b.finished&&b.type===BUILDING.SHELTER&&b.owner===bn.uid[bi]);assert.equal(matches.length,1,'reconciliação precisa restaurar building ausente de blueprint concluído');

console.log('OK reality reconciliation: memória stale é corrigida e blueprint concluído sempre vira building');
