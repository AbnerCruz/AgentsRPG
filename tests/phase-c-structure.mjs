import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const utility=await readFile(new URL('../src/ai/utility.js',import.meta.url),'utf8');
const actions=await readFile(new URL('../src/systems/actions.js',import.meta.url),'utf8');
for(const forbidden of ['nearestResource','nearestBuildingLocal','nearestPrey','nearestVisibleNPC','nearestWounded']){
 assert.equal(utility.includes(forbidden),false,`utility não pode consultar ${forbidden} globalmente`);
}
assert.ok(utility.includes('knownResource'),'utility deve usar memória individual para recursos');
assert.ok(utility.includes('perception'),'utility deve consumir percepção do NPC');
assert.equal(actions.includes('nearestVisibleNPC'),false,'preparação de ação social deve usar percepção');
assert.equal(actions.includes('nearestWounded'),false,'cuidado deve usar percepção');
assert.equal(actions.includes('nearestPrey'),false,'caça deve usar percepção');
console.log('OK Phase C structure: caminho de decisão sem buscas globais oniscientes');
