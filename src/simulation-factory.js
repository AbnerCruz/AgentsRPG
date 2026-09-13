import {Simulation} from './simulation.js';
import {RNG} from './core/rng.js';
import {VERSION,MAX_NPCS,TILE_TYPE,MAP_W,MAP_H} from './core/constants.js';
import {World} from './world/world.js';
import {NPCStore} from './entities/npcs.js';
import {MemorySystem} from './ai/memory.js';
import {AnimalSystem} from './systems/animals.js';
import {Dungeon} from './dungeon/dungeon.js';

export function createNewSimulation(seed,generated){
 const s=Object.create(Simulation.prototype);
 s.version=VERSION;
 s.seed=seed>>>0;
 s.rng=new RNG(s.seed);
 s.tick=0;
 s.world=new World(s.rng,s.seed,generated||null);
 s.npcs=new NPCStore();
 s.memory=new MemorySystem();
 s.animals=new AnimalSystem(s.rng,s.world);
 s.dungeon=new Dungeon(s.rng,s.world);
 s.chronicle=[];
 s.populationHistory=[];
 s.geneHistory=[];
 s.bubbles=[];
 s.actionHistogram={};
 s.travel={started:0,completed:0,abandoned:0,byAction:{},completedByAction:{},abandonedByAction:{}};
 s.tasks={started:0,completed:0,failed:0,byAction:{},completedByAction:{},failedByAction:{}};
 s.lastPerception=Array(MAX_NPCS).fill(null);
 seedPopulation(s,100);
 const center=populationCenter(s);
 s.viewX=center.x;
 s.viewY=center.y;
 s.log('origem','Cem pessoas despertaram dispersas pelo continente sem vila, ferramentas ou conhecimento do mundo.',.98);
 return s;
}

function seedPopulation(sim,count){
 const w=sim.world,n=sim.npcs,seeds=w.spawnSeeds?.length?w.spawnSeeds:[w.settlement];
 for(let k=0;k<count;k++){
  const base=seeds[k%seeds.length];
  const p=nearbyLand(sim,base.x,base.y);
  const i=n.create(sim.rng,p.x,p.y,{tool:0});
  if(i<0)break;
  sim.memory.ensure(i,sim.memory.spatialCapacity(n,i));
 }
}

function nearbyLand(sim,x,y){
 const w=sim.world;
 for(let tries=0;tries<24;tries++){
  const a=sim.rng.range(0,Math.PI*2),r=tries<4?sim.rng.range(.2,2.2):sim.rng.range(.2,5.5);
  const nx=Math.max(1.5,Math.min(MAP_W-1.5,x+Math.cos(a)*r));
  const ny=Math.max(1.5,Math.min(MAP_H-1.5,y+Math.sin(a)*r));
  const t=w.tile(nx,ny);
  if(t!==TILE_TYPE.WATER&&t!==TILE_TYPE.MOUNTAIN)return{x:nx,y:ny};
 }
 return{x,y};
}

function populationCenter(sim){
 const alive=sim.npcs.living();
 if(!alive.length)return{x:sim.world.settlement.x,y:sim.world.settlement.y};
 let x=0,y=0;for(const i of alive){x+=sim.npcs.x[i];y+=sim.npcs.y[i]}
 return{x:x/alive.length,y:y/alive.length};
}
