import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,BUILDING,RESOURCE,TILE_TYPE} from '../src/core/constants.js';
import {ensureConstruction,groupForNpc} from '../src/systems/construction.js';
import {prepareAction} from '../src/systems/actions.js';
import {movementSpeed} from '../src/systems/executor.js';

const sim=new Simulation(424242),w=ensureConstruction(sim),n=sim.npcs,i=n.living()[0],group=groupForNpc(sim,i),j=n.living().find(k=>k!==i&&groupForNpc(sim,k)===group);
assert.ok(j!=null,'seed de teste precisa ter ao menos dois adultos no mesmo grupo');
sim.technology.setKnown(n,i,1,-1,sim.tick);sim.technology.setKnown(n,j,1,-1,sim.tick);n.inventory[i][RESOURCE.LOG]=10;n.inventory[j][RESOURCE.LOG]=10;

// A primeira moradia criada pelo fluxo real de construção deve ser pequena e coletiva.
assert.equal(prepareAction(sim,i,ACTION.BUILD,{}),true,'construtor deve conseguir iniciar o primeiro abrigo');
const bp=w.blueprints[n.intent[i].meta.blueprint];
assert.equal(bp.type,BUILDING.SHELTER,'primeiro projeto do grupo deve ser abrigo');
assert.equal(bp.primitive,true,'primeiro abrigo sem construção em madeira deve ser primitivo');
assert.ok(bp.pieces.length>=4&&bp.pieces.length<=8,`abrigo primitivo deve ter 4-8 peças, recebeu ${bp.pieces.length}`);
assert.equal(bp.group,group,'blueprint precisa pertencer ao grupo');
assert.equal(w.nextBlueprintPiece(n.uid[j])?.bp.id,bp.id,'outro membro do grupo deve receber tarefa da mesma obra');
assert.equal(w.createBlueprint(BUILDING.STORAGE,n.x[j]+4,n.y[j]+4,n.uid[j]),null,'grupo não deve abrir segunda obra estrutural antes de fechar a primeira');

// Concluir o abrigo libera a próxima obra, mas não recria um abrigo privado para cada pessoa.
const ex=bp.cx<96?180.5:10.5,ey=bp.cy<96?180.5:10.5;for(const k of n.living()){n.x[k]=ex;n.y[k]=ey}
for(const p of bp.pieces)w.completePiece(bp,p);
const shelter=w.buildings.find(b=>b.finished&&b.type===BUILDING.SHELTER&&b.group===group);
assert.ok(shelter,'abrigo primitivo concluído deve virar building funcional');assert.equal(shelter.primitive,true,'building deve preservar a identidade de abrigo primitivo');
n.intent[i]=null;n.action[i]=ACTION.IDLE;n.taskProgress[i]=0;
assert.equal(prepareAction(sim,j,ACTION.BUILD,{}),true,'grupo deve poder iniciar nova obra depois do abrigo');
const next=w.blueprints[n.intent[j].meta.blueprint];
assert.equal(next.type,BUILDING.STORAGE,'membro sem abrigo próprio deve reconhecer o abrigo coletivo e avançar a infraestrutura do grupo');

// A constante de deslocamento da rodada v8 é 0,30 em terreno neutro e sem penalidades.
let grass=null;for(let y=1;y<191&&!grass;y++)for(let x=1;x<191;x++)if(w.tile(x,y)===TILE_TYPE.GRASS){grass={x:x+.5,y:y+.5};break}
assert.ok(grass,'seed de teste precisa conter terreno de grama');n.x[i]=grass.x;n.y[i]=grass.y;n.inventory[i].fill(0);n.stamina[i]=1;n.wound[i]=0;n.pain[i]=0;
const expected=.30*n.derived(i).speed,actual=movementSpeed(sim,i);assert.ok(Math.abs(actual-expected)<1e-8,`base de movimento deveria ser 0,30: ${actual} vs ${expected}`);

console.log(`OK recalibration: abrigo ${bp.pieces.length} peças, obra coletiva e movimento base 0,30`);
