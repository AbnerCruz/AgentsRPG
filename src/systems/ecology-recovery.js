import {AnimalSystem} from './animals.js';
import {ANIMAL,ANIMAL_INFO,MAX_ANIMALS,TILE_TYPE} from '../core/constants.js';

// Refúgios impedem que sobrecaça local torne uma espécie regionalmente estéril para sempre.
// A dinâmica normal continua sazonal/logística; este piso usa a capacidade de primavera
// porque representa bolsões persistentes de difícil acesso, não alimento disponível hoje.
if(!AnimalSystem.prototype.__phaseERefugeInstalled){
 const base=AnimalSystem.prototype.regionalTick;
 AnimalSystem.prototype.regionalTick=function(sim){
  base.call(this,sim);
  if(this.liveCount()>=MAX_ANIMALS)return;
  for(let ry=0;ry<12;ry++)for(let rx=0;rx<12;rx++)for(let s=0;s<ANIMAL.NAMES.length;s++){
   const info=ANIMAL_INFO[s];if(!info||info.predator)continue;
   const idx=this.regionSpeciesIndex(rx,ry,s),pop=this.regionPop[idx],refugeK=this.capacityFor(s,rx,ry,this.world,'primavera');
   if(refugeK<3||pop>1)continue;
   this.refugeCredit[idx]+=.06*Math.max(.5,refugeK-pop);
   if(this.refugeCredit[idx]<1)continue;
   const born=spawnFromRefuge(this,s,rx,ry);
   if(born){this.refugeCredit[idx]-=1;this.metrics.births++}
  }
  this.recountRegional();
 };
 Object.defineProperty(AnimalSystem.prototype,'__phaseERefugeInstalled',{value:true});
}
function spawnFromRefuge(system,s,rx,ry){
 const direct=system.spawnInRegion(s,rx,ry,false);if(direct)return direct;
 const info=ANIMAL_INFO[s],w=system.world,x0=rx*16,y0=ry*16;
 for(let y=y0+1;y<Math.min(y0+16,w.height||192);y++)for(let x=x0+1;x<Math.min(x0+16,w.width||192);x++){
  const t=w.tile(x+.5,y+.5);if(t===TILE_TYPE.WATER||t===TILE_TYPE.MOUNTAIN||!info.biomes?.includes(w.biome(x+.5,y+.5)))continue;
  return system.spawn(s,x+.5,y+.5,false,{herd:system.herdFor(s,x+.5,y+.5),tameness:.05});
 }
 return null;
}
