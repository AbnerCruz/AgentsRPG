import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,BUILDING} from '../src/core/constants.js';
import {scoreActions} from '../src/ai/utility.js';

const sim=new Simulation(4242),n=sim.npcs,i=n.living()[0];
const hx=n.homeX[i],hy=n.homeY[i];
n.x[i]=Math.min(190,hx+20);n.y[i]=hy;
let scores=scoreActions(sim,i,{}),ret=scores.find(x=>x[0]===ACTION.RETURN);
assert.ok(ret,'RETURN deve permanecer no conjunto de ações disponível');
assert.equal(ret[1],0,'ponto de origem sem abrigo não pode ser tratado como casa');
sim.world.addBuilding(BUILDING.SHELTER,hx,hy,true,n.uid[i]);
scores=scoreActions(sim,i,{});ret=scores.find(x=>x[0]===ACTION.RETURN);
assert.ok(ret[1]>0,'abrigo pessoal real e distante deve habilitar retorno');
console.log('OK Phase D return home: RETURN exige abrigo pessoal real');
