import {World} from '../world/world.js';
import {MAP_W,MAP_H,RESOURCE,BIOME,WATER_KIND,TILE_TYPE} from '../core/constants.js';
import {noiseHash} from '../core/rng.js';
import './resource-ecology.js';

if(!World.prototype.__civilizationUnlockInstalled){
 // Mantém água como critério dominante, mas volta a considerar pedra já existente
 // com peso pequeno. Depois da seleção, garante seixos fisicamente plausíveis em
 // margens/praias para que a primeira técnica não dependa de uma expedição de 50 tiles.
 World.prototype.placeSpawnSeeds=function(){
  this.spawnSeeds=[];const candidates=[];
  for(let y=6;y<MAP_H-6;y+=2)for(let x=6;x<MAP_W-6;x+=2){
   const id=this.idx(x,y),b=this.biomes[id];if(this.waterKind[id]||b===BIOME.MOUNTAIN||b===BIOME.ROCK||this.slope[id]>95)continue;
   let fresh=99;for(let yy=y-8;yy<=y+8;yy+=2)for(let xx=x-8;xx<=x+8;xx+=2)if(this.inside(xx,yy)){const wk=this.waterKind[this.idx(xx,yy)];if(wk===WATER_KIND.RIVER||wk===WATER_KIND.LAKE)fresh=Math.min(fresh,Math.hypot(xx-x,yy-y))}
   if(fresh>8)continue;
   const stone=this.resourcesNear(x+.5,y+.5,14,RESOURCE.STONE).reduce((m,r)=>Math.min(m,Math.hypot(r.x-(x+.5),r.y-(y+.5))),99);
   const stoneBonus=Math.max(0,10-stone)*.16;
   const score=(8-fresh)*2+(1-this.slope[id]/255)*2+(this.moisture[id]>.35&&this.moisture[id]<.8?1:0)+stoneBonus+noiseHash(x,y,this.seed+5001)*.5;
   candidates.push({x:x+.5,y:y+.5,score});
  }
  candidates.sort((a,b)=>b.score-a.score);const target=25+Math.floor(noiseHash(2,3,this.seed+5002)*16);
  for(const c of candidates){if(this.spawnSeeds.length>=target)break;if(this.spawnSeeds.every(s=>Math.hypot(s.x-c.x,s.y-c.y)>10))this.spawnSeeds.push(c)}
  for(const c of candidates){if(this.spawnSeeds.length>=25)break;if(this.spawnSeeds.every(s=>Math.hypot(s.x-c.x,s.y-c.y)>6))this.spawnSeeds.push(c)}
  if(!this.spawnSeeds.length)this.spawnSeeds.push({x:MAP_W/2+.5,y:MAP_H/2+.5,score:0});
  for(const s of this.spawnSeeds)ensurePebbles(this,s);
  this.settlement={...this.spawnSeeds[0]};
 };
 Object.defineProperty(World.prototype,'__civilizationUnlockInstalled',{value:true});
}

function ensurePebbles(w,seed){
 if(w.resourcesNear(seed.x,seed.y,8,RESOURCE.STONE).length)return;
 let best=null,bs=-Infinity;
 for(let r=1;r<=8;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;const x=Math.floor(seed.x)+dx,y=Math.floor(seed.y)+dy;if(!w.inside(x,y))continue;
  const id=w.idx(x,y),t=w.tiles[id];if(t===TILE_TYPE.WATER||t===TILE_TYPE.MOUNTAIN)continue;
  let margin=w.biomes[id]===BIOME.BEACH?1.25:0;
  for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]])if(w.inside(x+ax,y+ay)){const wk=w.waterKind[w.idx(x+ax,y+ay)];if(wk===WATER_KIND.RIVER||wk===WATER_KIND.LAKE)margin=Math.max(margin,1.1)}
  if(!margin)continue;const d=Math.hypot(x+.5-seed.x,y+.5-seed.y),score=margin-d*.08-(w.slope[id]||0)/400+noiseHash(x,y,w.seed+5201)*.08;if(score>bs){bs=score;best={x,y}}
 }
 if(!best)return;
 const amount=.7+noiseHash(best.x,best.y,w.seed+5202)*1.1;
 const pebble=w.addResource(RESOURCE.STONE,best.x+.5,best.y+.5,amount,0,1.2);pebble.pebble=true;pebble.regenDays=0;
}
