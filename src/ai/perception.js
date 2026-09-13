import {MAP_W,MAP_H,RESOURCE,TILE_TYPE,BUILDING,BIOME,NPC_STATE} from '../core/constants.js';
import {SPATIAL_FLAG} from './memory.js';
import {isNight} from '../core/clock.js';
import {sensoryFor} from '../systems/senses.js';
import {technologyFor} from '../systems/technology.js';
import {BALANCE} from '../calibration/balance.js';

export function perceive(sim,i){
 const n=sim.npcs,w=sim.world,m=sim.memory,d=n.derived(i),night=isNight(sim.tick),biome=w.biome(n.x[i],n.y[i]);
 let short=d.perception*BALANCE.perceptionShortMult,long=d.longPerception*BALANCE.perceptionLongMult;
 if(night){short*=.42;long*=.35}
 if(biome===BIOME.DENSE_FOREST){short*=.68;long*=.55}else if(biome===BIOME.MARSH){short*=.78;long*=.75}else if(biome===BIOME.FIELD||biome===BIOME.BEACH||biome===BIOME.MOUNTAIN)long*=1.18;
 const id=w.idx(n.x[i],n.y[i]),e=w.elevation?.[id]||0;long*=1+Math.max(0,e-.55)*1.1;
 const injury=1-(n.wound[i]||0)*.35-(n.pain?.[i]||0)*.25;short=Math.max(1.5,short*injury);long=Math.max(6,long*injury);if(n.state[i]===NPC_STATE.SLEEPING){short=1.2;long=3}
 const cap=m.spatialCapacity(n,i);m.markVisited(i,n.x[i],n.y[i],18);
 const seenResources=w.resourcesNear(n.x[i],n.y[i],short);for(const r of seenResources)m.observe(i,w.idx(r.x,r.y),sim.tick,1<<r.kind,r.kind===RESOURCE.WATER?SPATIAL_FLAG.WATER:0,cap,r.amount,-1);
 if(!night){for(const r of w.resourcesNear(n.x[i],n.y[i],long,RESOURCE.WATER)){if(Math.hypot(r.x-n.x[i],r.y-n.y[i])<=short)continue;if(lineOfSight(w,n.x[i],n.y[i],r.x,r.y,.035))m.observe(i,w.idx(r.x,r.y),sim.tick,1<<RESOURCE.WATER,SPATIAL_FLAG.WATER,cap,r.amount,-1)}}
 const buildings=[];for(const b of w.buildings){if(!b.finished)continue;const bd=Math.hypot(b.x-n.x[i],b.y-n.y[i]);if(bd<=short){buildings.push({id:b.id,type:b.type,x:b.x,y:b.y,d:bd,owner:b.owner});m.observe(i,w.idx(b.x,b.y),sim.tick,0,SPATIAL_FLAG.BUILDING|(b.type===BUILDING.CAMPFIRE?SPATIAL_FLAG.FIRE:0),cap,1,b.owner??-1)}else if(b.type===BUILDING.CAMPFIRE&&bd<=Math.max(long,night?44:long)&&lineOfSight(w,n.x[i],n.y[i],b.x,b.y,.08)){m.observe(i,w.idx(b.x,b.y),sim.tick,0,SPATIAL_FLAG.SMOKE|SPATIAL_FLAG.FIRE,cap,1,b.owner??-1)}}
 for(const dg of w.dungeons){const dd=Math.hypot(dg.x-n.x[i],dg.y-n.y[i]);if(dd<=long&&lineOfSight(w,n.x[i],n.y[i],dg.x,dg.y,.06)){m.observe(i,w.idx(dg.x,dg.y),sim.tick,0,SPATIAL_FLAG.DUNGEON,cap,1,-1);const key=`dungeon:${dg.id}`;if(!(m.semantic.get(i)||[]).some(f=>f.key===key)){m.learn(i,{key,text:`Há uma entrada de dungeon nesta região.`,tick:sim.tick,confidence:.9});m.remember(i,{type:'descoberta',text:'Encontrei uma entrada de dungeon desconhecida.',tick:sim.tick,valence:1,importance:.82,reflectionKey:'exploração'});sim.log('descoberta',`${n.names[i]} descobriu uma dungeon.`,.78,i)}}}
 const humans=[],wounded=[];for(const j of n.living())if(j!==i){const hd=Math.hypot(n.x[j]-n.x[i],n.y[j]-n.y[i]);if(hd<=short){const person={id:j,uid:n.uid[j],x:n.x[j],y:n.y[j],d:hd,wound:n.wound[j],action:n.action[j]};humans.push(person);n.humanSeen[i]=1;n.humanSeen[j]=1;m.observe(i,w.idx(n.x[j],n.y[j]),sim.tick,0,SPATIAL_FLAG.HUMAN,cap,1,n.uid[j]);if(n.wound[j]>.12)wounded.push(person);technologyFor(sim).observe(sim,i,j,n.action[j])}}
 let threat=0,target=null;for(const mon of w.monsters)if(mon.hp>0){const md=Math.hypot(mon.x-n.x[i],mon.y-n.y[i]);if(md<=short){const t=(1-md/(short+1))*(.45+mon.power);if(t>threat){threat=t;target={kind:'monster',ref:{id:mon.id},x:mon.x,y:mon.y,d:md}}m.observe(i,w.idx(mon.x,mon.y),sim.tick,0,SPATIAL_FLAG.THREAT,cap,1,-1)}}
 const prey=[];for(const a of sim.animals?.items||[])if(a.alive){const ad=Math.hypot(a.x-n.x[i],a.y-n.y[i]);if(ad>short)continue;if(a.predator){const t=(1-ad/(short+1))*(.12+a.power*.38);if(t>threat){threat=t;target={kind:'animal',ref:{id:a.id},x:a.x,y:a.y,d:ad}}}else if(!a.domestic)prey.push({id:a.id,x:a.x,y:a.y,d:ad})}
 const senses=sensoryFor(sim);senses.tick(sim.tick);const sounds=senses.hear(sim,i).map(x=>({type:x.type,x:x.x,y:x.y,d:x.d,confidence:x.confidence,source:x.source}));for(const s of sounds)if(['grito','combate','uivo'].includes(s.type)&&s.confidence>.25)threat=Math.max(threat,.15+s.confidence*.25);
 return{radius:short,longRadius:long,threat:Math.min(1.5,threat),target,humans,wounded,prey,buildings,sounds};
}

function lineOfSight(w,x0,y0,x1,y1,margin=.04){const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy),steps=Math.max(2,Math.ceil(d/2)),a=w.elevation[w.idx(x0,y0)]||0,b=w.elevation[w.idx(x1,y1)]||0;for(let s=1;s<steps;s++){const f=s/steps,x=x0+dx*f,y=y0+dy*f;if(!w.inside(x,y))return false;const expected=a+(b-a)*f;if((w.elevation[w.idx(x,y)]||0)>expected+margin)return false}return true}
export function knownResource(sim,i,kind){return sim.memory.recallNearest(i,sim.npcs.x[i],sim.npcs.y[i],kind,sim.tick)}
export function knownDungeons(sim,i){return sim.memory.recallFlag(i,sim.npcs.x[i],sim.npcs.y[i],SPATIAL_FLAG.DUNGEON,sim.tick)}
export function knownBuildings(sim,i){return sim.memory.recallFlag(i,sim.npcs.x[i],sim.npcs.y[i],SPATIAL_FLAG.BUILDING|SPATIAL_FLAG.FIRE,sim.tick)}
