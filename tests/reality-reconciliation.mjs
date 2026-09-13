import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {ACTION,RESOURCE,BUILDING,MAP_W,MAP_H,TILE_TYPE} from '../src/core/constants.js';
import {finishIntent} from '../src/systems/actions.js';

function emptyResourceTile(sim,kind){
 const w=sim.world;
 for(let y=2;y<MAP_H-2;y++)for(let x=2;x<MAP_W-2;x++){
  const t=w.tile(x+.5,y+.5);
  if(t===TILE_TYPE.WATER||t===TILE_TYPE.MOUNTAIN)continue;
  if(!w.findResourceAt(x+.5,y+.5,kind,1.5))return{x:x+.5,y:y+.5};
 }
 throw new Error('no empty resource tile found');
}

{
 const sim=new Simulation(6161),i=sim.npcs.living()[0],n=sim.npcs,w=sim.world,m=sim.memory;
 const p=emptyResourceTile(sim,RESOURCE.BERRY),cap=m.spatialCapacity(n,i),tile=w.idx(p.x,p.y),bit=1<<RESOURCE.BERRY;
 m.observe(i,tile,sim.tick,bit,0,cap,1,-1);
 const s=m.spatial.get(i);let slot=-1;for(let k=0;k<s.count;k++)if(s.tiles[k]===tile&&(s.resource[k]&bit)){slot=k;break}
 assert.ok(slot>=0,'stale berry memory must exist before reconciliation');
 n.intent[i]={action:ACTION.FORAGE,started:sim.tick,targetX:p.x,targetY:p.y,sourceX:p.x,sourceY:p.y,targetId:-1,targetKind:RESOURCE.BERRY,meta:{memorySlot:slot,sourceUid:-1}};
 finishIntent(sim,i,false);
 assert.equal(s.resource[slot]&bit,0,'failed arrival must remove false resource bit from spatial memory');
 assert.equal(s.quantity[slot],0,'failed arrival must zero remembered quantity');
 assert.ok((m.episodic.get(i)||[]).some(e=>e.type==='correção de memória'),'failed arrival must create a negative correction memory');
 assert.equal(m.recallNearest(i,n.x[i],n.y[i],RESOURCE.BERRY,sim.tick)?.tile===tile,false,'corrected false target must not be selected again');
}

{
 const sim=new Simulation(6262),i=sim.npcs.living()[0],n=sim.npcs,w=sim.world;
 let site=null;for(let r=2;r<10&&!site;r++)for(let dy=-r;dy<=r&&!site;dy++)for(let dx=-r;dx<=r&&!site;dx++){
  const x=Math.round(n.x[i]+dx),y=Math.round(n.y[i]+dy);if(!w.inside(x,y))continue;const t=w.tile(x,y);if(t!==TILE_TYPE.WATER&&t!==TILE_TYPE.MOUNTAIN)site={x,y};
 }
 assert.ok(site,'must find a buildable site');
 const bp=w.createBlueprint(BUILDING.CAMPFIRE,site.x,site.y,n.uid[i]);
 assert.ok(bp,'campfire blueprint must be created');
 for(const p of bp.pieces)p.done=true;bp.done=true;w.buildings=[];
 const restored=Simulation.hydrate(JSON.parse(JSON.stringify(sim.serialize())));
 const b=restored.world.buildings.find(x=>x.finished&&x.type===BUILDING.CAMPFIRE&&x.owner===n.uid[i]);
 assert.ok(b,'hydrate must reconcile a completed blueprint into world.buildings');
 assert.equal(restored.world.blueprints[bp.id].shellBuildingId,b.id,'repaired blueprint must point at its building identity');
}

console.log('OK reality reconciliation: stale resource memories are corrected and completed blueprints regain building identities');
