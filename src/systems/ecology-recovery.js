import {AnimalSystem} from './animals.js';
import {ANIMAL,ANIMAL_INFO,MAX_ANIMALS} from '../core/constants.js';
import {season} from '../core/clock.js';

// Refúgios impedem que sobrecaça local torne uma espécie regionalmente estéril para sempre.
// A dinâmica normal continua logística; este piso só age quando restam 0–1 indivíduos
// em habitat com capacidade real, representando bolsões de difícil acesso e recolonização.
if(!AnimalSystem.prototype.__phaseERefugeInstalled){
 const base=AnimalSystem.prototype.regionalTick;
 AnimalSystem.prototype.regionalTick=function(sim){
  base.call(this,sim);
  if(this.liveCount()>=MAX_ANIMALS)return;
  const seas=season(sim.tick);
  for(let ry=0;ry<12;ry++)for(let rx=0;rx<12;rx++)for(let s=0;s<ANIMAL.NAMES.length;s++){
   const info=ANIMAL_INFO[s];if(!info||info.predator)continue;
   const idx=this.regionSpeciesIndex(rx,ry,s),pop=this.regionPop[idx],K=this.capacityFor(s,rx,ry,this.world,seas);
   if(K<3||pop>1)continue;
   this.refugeCredit[idx]+=.06*Math.max(.5,K-pop);
   if(this.refugeCredit[idx]<1)continue;
   const born=this.spawnInRegion(s,rx,ry,false);
   if(born){this.refugeCredit[idx]-=1;this.metrics.births++}
  }
  this.recountRegional();
 };
 Object.defineProperty(AnimalSystem.prototype,'__phaseERefugeInstalled',{value:true});
}
