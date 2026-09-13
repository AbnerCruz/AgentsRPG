import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,RESOURCE} from '../src/core/constants.js';
import {prepareAction,inferFailureReason} from '../src/systems/actions.js';
import {suspendCurrent,resumeSuspended,performAtomicAction,stackFor,shouldSwitchTask,serializeTaskPlanning} from '../src/systems/task-planning.js';

const sim=new Simulation(424242),n=sim.npcs,i=n.living().find(x=>n.age[x]>=16)??n.living()[0];
assert.ok(prepareAction(sim,i,ACTION.EXPLORE,{}),'exploração precisa preparar');
n.taskProgress[i]=.57;const failed0=sim.tasks.failed,started0=sim.tasks.started;
assert.ok(suspendCurrent(sim,i,'sede crítica'),'tarefa retomável precisa suspender');
assert.equal(stackFor(sim,i).length,1,'pilha precisa receber a tarefa');
assert.equal(sim.tasks.failed,failed0,'suspensão não é falha');

n.inventory[i][RESOURCE.WATER]=1;n.setNeed(i,1,.8);
assert.ok(performAtomicAction(sim,i,ACTION.DRINK),'beber local deve ser ação atômica');
assert.equal(n.intent[i],null,'ação atômica não ocupa o slot de intenção');
assert.equal(sim.tasks.started,started0,'ação atômica não entra no contador de tarefas longas');
assert.ok(resumeSuspended(sim,i),'tarefa precisa retomar depois da ação curta');
assert.equal(n.intent[i].action,ACTION.EXPLORE,'objetivo retomado precisa ser o original');
assert.ok(n.taskProgress[i]>.569,'progresso da tarefa não pode ser perdido');

const sticky=[[ACTION.EXPLORE,.5],[ACTION.BUILD,.62]];n.taskProgress[i]=.84;
assert.equal(shouldSwitchTask(sim,i,sticky,ACTION.BUILD,{}),false,'progresso alto deve criar histerese contra troca pequena');

const broken={action:ACTION.STONE,targetId:999999,targetKind:RESOURCE.STONE,sourceX:n.x[i],sourceY:n.y[i],targetX:n.x[i],targetY:n.y[i],meta:{}};
assert.equal(inferFailureReason(sim,i,broken),'referência inválida','falha operacional precisa ser subcategorizada');
const stone=sim.world.resources.find(r=>r.kind===RESOURCE.STONE);if(stone){stone.amount=0;broken.targetId=stone.id;broken.sourceX=stone.x;broken.sourceY=stone.y;assert.equal(inferFailureReason(sim,i,broken),'material esgotado na chegada','recurso esgotado precisa ter causa própria')}

suspendCurrent(sim,i,'ameaça imediata');const saved=sim.serialize(),restored=Simulation.hydrate(JSON.parse(JSON.stringify(saved)));
assert.equal(restored.taskStacks[i].length,1,'pilha precisa sobreviver ao save/load');
assert.deepEqual(serializeTaskPlanning(restored).stacks[i].map(x=>x.intent.action),serializeTaskPlanning(sim).stacks[i].map(x=>x.intent.action),'round-trip da pilha precisa ser estável');
console.log('OK task planning: atomicidade, suspensão, retomada, histerese, falhas e round-trip');
