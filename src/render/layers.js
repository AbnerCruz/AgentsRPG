import {MAP_W,MAP_H,TILE,TILE_TYPE} from '../core/constants.js';
const MODES=['biome','elevation','flow','moisture','temperature','slope','wear'];
export function worldLayer(w,mode){
 if(mode==='elevation')return w.elevation;
 if(mode==='flow')return w.flow;
 if(mode==='moisture')return w.moisture;
 if(mode==='temperature')return w.temperature;
 if(mode==='slope')return w.slope;
 if(mode==='wear')return w.wear;
 return w.biomes;
}
export function installLayerInspector(renderer,select){
 if(!renderer||!select)return;
 renderer.layerMode='biome';
 renderer.makeTerrain=()=>{
  const mode=renderer.layerMode;
  const w=renderer.sim.world,c=document.createElement('canvas');c.width=MAP_W*TILE;c.height=MAP_H*TILE;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
  const layer=worldLayer(w,mode);let max=1,min=0;
  if(mode==='flow'){max=0;for(const v of layer)max=Math.max(max,Math.log1p(v));max=max||1}
  if(mode==='temperature'){min=Infinity;max=-Infinity;for(const v of layer){min=Math.min(min,v);max=Math.max(max,v)}if(max===min)max=min+1}
  for(let y=0;y<MAP_H;y++)for(let xx=0;xx<MAP_W;xx++){const id=y*MAP_W+xx;let v=layer[id]||0;if(mode==='biome'){let c=colorFor(mode,0,w.biomes[id]),t=w.tiles[id];if(t===TILE_TYPE.TRAIL)c='#6b5a3e';else if(t===TILE_TYPE.PATH)c='#705d40';else if(t===TILE_TYPE.ROAD)c='#806a4a';else if(t===TILE_TYPE.DUNGEON)c='#302534';x.fillStyle=c;x.fillRect(xx*TILE,y*TILE,TILE,TILE);continue}if(mode==='flow')v=Math.log1p(v)/max;else if(mode==='temperature')v=(v-min)/(max-min);else if(mode==='slope'||mode==='wear')v/=255;v=Math.max(0,Math.min(1,v));x.fillStyle=colorFor(mode,v,w.biomes[id]);x.fillRect(xx*TILE,y*TILE,TILE,TILE)}
  renderer.terrain=c;renderer.terrainTick=renderer.sim.tick;
 };
 renderer.makeTerrain();
 select.value='biome';
 select.onchange=()=>{const mode=MODES.includes(select.value)?select.value:'biome';renderer.layerMode=mode;renderer.makeTerrain()};
}
function colorFor(mode,v,biome){
 if(mode==='elevation'){const q=Math.round(v*220+18);return`rgb(${q},${q},${q})`}
 if(mode==='flow'){const b=Math.round(80+v*175),g=Math.round(40+v*150);return`rgb(18,${g},${b})`}
 if(mode==='moisture'){const g=Math.round(55+v*175),b=Math.round(45+v*95);return`rgb(28,${g},${b})`}
 if(mode==='temperature'){const r=Math.round(45+v*205),b=Math.round(220-v*190),g=Math.round(80+Math.sin(v*Math.PI)*120);return`rgb(${r},${g},${b})`}
 if(mode==='slope'){const q=Math.round(30+v*220);return`rgb(${q},${Math.round(q*.82)},${Math.round(q*.65)})`}
 if(mode==='wear'){const r=Math.round(50+v*180),g=Math.round(65+v*120);return`rgb(${r},${g},45)`}
 const p=['#526d43','#35583a','#26442d','#555750','#454843','#3f5947','#81795a','#315d69','#385246','#777044'];return p[biome]||'#526d43';
}
