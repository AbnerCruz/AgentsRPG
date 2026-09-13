import {GENE,BIOME,NPC_STATE} from '../core/constants.js';
import {noiseHash} from '../core/rng.js';

export class SensorySystem{
 constructor(data=null){this.sounds=(data?.sounds||[]).map(x=>({...x}));this.smells=(data?.smells||[]).map(x=>({...x}));this.lastTick=data?.lastTick||0}
 tick(tick){if(tick===this.lastTick)return;this.lastTick=tick;this.sounds=this.sounds.filter(e=>e.until>=tick);this.smells=this.smells.filter(e=>e.until>=tick)}
 emitSound(x,y,intensity,type,source=-1,tick=0){this.sounds.push({x,y,intensity,type,source,born:tick,until:tick+3});if(this.sounds.length>96)this.sounds.splice(0,this.sounds.length-96)}
 emitSmell(x,y,intensity,type,source=-1,tick=0,duration=180){this.smells.push({x,y,intensity,type,source,born:tick,until:tick+duration});if(this.smells.length>96)this.smells.splice(0,this.smells.length-96)}
 hear(sim,i){this.tick(sim.tick);const n=sim.npcs,w=sim.world,dv=n.derived(i);if(n.state[i]===NPC_STATE.SLEEPING)return[];const out=[];for(const e of this.sounds){const dx=e.x-n.x[i],dy=e.y-n.y[i],d=Math.hypot(dx,dy),terrain=w.biome(n.x[i],n.y[i])===BIOME.DENSE_FOREST?.82:1,reach=e.intensity*dv.hearing*terrain;if(d>reach)continue;const uncertainty=Math.max(.3,d*(1-dv.hearing*.25)*.16),a=Math.atan2(dy,dx)+(noiseHash(i,e.born,e.source+sim.seed)-.5)*.5;out.push({...e,d,x:n.x[i]+Math.cos(a)*Math.max(0,d+uncertainty*(noiseHash(e.source,i,sim.seed)-.5)),y:n.y[i]+Math.sin(a)*Math.max(0,d+uncertainty*(noiseHash(i,e.source,sim.seed+3)-.5)),confidence:Math.max(.15,1-d/(reach+.01))})}return out.sort((a,b)=>a.d-b.d)}
 smell(sim,i){this.tick(sim.tick);const n=sim.npcs,w=sim.world,dv=n.derived(i),wind=w.wind||{dx:1,dy:0},out=[];for(const e of this.smells){const dx=n.x[i]-e.x,dy=n.y[i]-e.y,d=Math.hypot(dx,dy)||.001,dot=(dx/d)*wind.dx+(dy/d)*wind.dy,windFactor=dot>.35?1.65:dot<-.35?.32:1,reach=e.intensity*dv.smell*windFactor;if(d>reach)continue;out.push({...e,d,confidence:Math.max(.12,1-d/(reach+.01)),downwind:dot})}return out.sort((a,b)=>a.d-b.d)}
 serialize(){return{sounds:this.sounds.map(x=>({...x})),smells:this.smells.map(x=>({...x})),lastTick:this.lastTick}}
 static hydrate(data){return new SensorySystem(data||null)}
}
export function sensoryFor(sim){if(!sim.senses)sim.senses=new SensorySystem();return sim.senses}
export function perceivedNeed(sim,i,k){const n=sim.npcs,real=n.need(i,k),noise=(noiseHash(i,k,Math.floor(sim.tick/45)+sim.seed)-.5),pain=n.pain?.[i]||0,disease=n.activeDisease?.[i]? .08:0,amp=.055+pain*.07+disease;return Math.max(0,Math.min(1,real+noise*amp))}
