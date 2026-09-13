import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {World} from '../src/world/world.js';
import {RNG} from '../src/core/rng.js';
import {MAP_W,MAP_H,BIOME,RESOURCE,DUNGEON_COUNT} from '../src/core/constants.js';
const N=MAP_W*MAP_H;
for(let s=1;s<=20;s++){
 const seed=s*7919,t0=performance.now(),w=new World(new RNG(seed),seed),ms=performance.now()-t0;
 assert.ok(ms<2000,`seed ${seed}: geração excedeu 2s (${ms.toFixed(0)}ms)`);
 const water=w.waterKind.reduce((a,v)=>a+(v?1:0),0)/N;
 assert.ok(water>=.03&&water<=.08,`seed ${seed}: água ${(water*100).toFixed(2)}%`);
 const counts=new Int32Array(BIOME.NAMES.length);for(const b of w.biomes)counts[b]++;
 for(let b=0;b<counts.length;b++){const f=counts[b]/N;assert.ok(f>=.01,`seed ${seed}: ${BIOME.NAMES[b]} abaixo de 1%`);assert.ok(f<=.4,`seed ${seed}: ${BIOME.NAMES[b]} acima de 40%`)}
 assert.ok(w.spawnSeeds.length>=25&&w.spawnSeeds.length<=40,`seed ${seed}: sementes humanas ${w.spawnSeeds.length}`);
 assert.equal(w.dungeons.length,DUNGEON_COUNT);
 const reachable=w.landReachableFrom(w.spawnSeeds[0].x,w.spawnSeeds[0].y);for(const d of w.dungeons)assert.ok(reachable[w.idx(d.x,d.y)],`seed ${seed}: dungeon ${d.id} inacessível por terra`);
 for(const k of [RESOURCE.LOG,RESOURCE.STONE,RESOURCE.IRON,RESOURCE.BERRY,RESOURCE.WATER])assert.ok(w.resources.some(r=>r.kind===k),`seed ${seed}: recurso essencial ${RESOURCE.NAMES[k]} ausente`);
 const twin=new World(new RNG(seed),seed);assert.deepEqual(Buffer.from(w.tiles),Buffer.from(twin.tiles),`seed ${seed}: tiles não determinísticos`);assert.deepEqual(Buffer.from(w.biomes),Buffer.from(twin.biomes),`seed ${seed}: biomas não determinísticos`);
 const snap=w.exportGenerated(),fromWorker=new World(new RNG(seed),seed,snap);assert.deepEqual(Buffer.from(w.tiles),Buffer.from(fromWorker.tiles),`seed ${seed}: snapshot do worker divergiu`);
 const saved=w.serialize();assert.equal(saved.tiles,undefined,'save não deve carregar tiles');assert.equal(saved.elevation,undefined,'save não deve carregar elevação');
}
console.log('OK Phase B: 20 seeds, determinismo, biomas, água, conectividade, recursos e orçamento');
