import assert from 'node:assert/strict';
import {taskTimeoutFor} from '../src/systems/actions.js';

const MIN_MOVEMENT_SPEED=.008;
for(const distance of[0,12,48,96,180]){
 const duration=40;
 const budget=taskTimeoutFor(distance,duration);
 const physicalMinimum=Math.ceil(distance/MIN_MOVEMENT_SPEED)+duration;
 assert.ok(budget>=physicalMinimum,`timeout de ${budget} ticks não pode ser menor que o mínimo físico ${physicalMinimum} para ${distance} tiles`);
}
assert.ok(taskTimeoutFor(96,40)>taskTimeoutFor(48,40),'viagem mais longa deve receber mais tempo');
assert.ok(taskTimeoutFor(48,120)>taskTimeoutFor(48,40),'trabalho mais longo deve receber mais tempo');
console.log('OK Phase D travel timeout: orçamento respeita velocidade mínima física');
