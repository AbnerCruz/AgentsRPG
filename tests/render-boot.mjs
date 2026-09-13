import assert from 'node:assert/strict';
import {MAP_W,MAP_H} from '../src/core/constants.js';
import {installLayerInspector,worldLayer} from '../src/render/layers.js';

const N=MAP_W*MAP_H;
const world={
 biomes:new Uint8Array(N),tiles:new Uint8Array(N),elevation:new Float32Array(N),flow:new Float32Array(N),
 moisture:new Float32Array(N),temperature:new Float32Array(N),slope:new Uint8Array(N),wear:new Uint8Array(N)
};
world.elevation[0]=.5;world.flow[0]=4;world.temperature[0]=.6;
const ctx={imageSmoothingEnabled:false,fillStyle:'#000',fillRect(){}};
globalThis.document={createElement(tag){assert.equal(tag,'canvas');return{width:0,height:0,getContext(){return ctx}}}};
const renderer={sim:{world,tick:0},terrain:null,terrainTick:-1,makeTerrain(){throw new Error('makeTerrain original não deveria ser usado após instalar camada')}};
const select={value:'',onchange:null};
assert.equal(worldLayer(world,'elevation'),world.elevation);
assert.equal(worldLayer(world,'flow'),world.flow);
assert.equal(worldLayer(world,'biome'),world.biomes);
installLayerInspector(renderer,select);
assert.ok(renderer.terrain,'instalador de camadas deve criar terreno sem depender de World.generationLayer');
for(const mode of['elevation','flow','moisture','temperature','slope','wear','biome']){select.value=mode;select.onchange();assert.ok(renderer.terrain,`camada ${mode} deve renderizar`)}
console.log('OK render boot: todas as camadas renderizam sem generationLayer ausente');
