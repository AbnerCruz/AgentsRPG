import {DAY_TICKS,TOOL,ACTION,TECH_COUNT} from '../core/constants.js';
import {DISEASES} from './disease.js';
import {technologyFor,TECH} from './technology.js';
import {sensoryFor} from './senses.js';
export function lifecycleTick(sim){
 const n=sim.npcs,tech=technologyFor(sim),senses=sensoryFor(sim);
 for(const i of n.living()){
  n.age[i]+=1/(DAY_TICKS*12);
  const dv=n.derived(i),painTarget=Math.min(1,n.wound[i]*(1.05-dv.painTolerance*.45)+(n.activeDisease[i] ? .18 : 0));n.pain[i]+=(painTarget-n.pain[i])*.018;
  if(n.wound[i]>0){const rest=n.action[i]===ACTION.SLEEP?.0007:.00012;n.wound[i]=Math.max(0,n.wound[i]-rest*(1+n.skill(i,12)*.35));if(n.wound[i]>.35&&sim.rng.chance(.00018*(1-n.gene(i,7))))n.infection[i]=Math.min(1,n.infection[i]+.05);else n.infection[i]=Math.max(0,n.infection[i]-.00008)}
  if(n.age[i]>=12&&sim.tick%45===i%45)tech.experiment(sim,i);
  if(n.age[i]<16&&sim.tick%120===i%120)for(const uid of n.parents[i]||[]){const p=n.indexByUid(uid);if(p>=0&&n.alive[p])tech.inherit(sim,p,i)}
  if(sim.tick%90===i%90&&n.wound[i]>.32)senses.emitSmell(n.x[i],n.y[i],8+n.wound[i]*12,'sangue',i,sim.tick,120);
  if(sim.tick%120===i%120&&n.activeDisease[i]){const d=DISEASES[n.activeDisease[i]-1];if(n.diseaseTimer[i]>d.incubation)senses.emitSound(n.x[i],n.y[i],8,'tosse',i,sim.tick)}
  if(n.hp[i]<=0){die(sim,i,n.need(i,0)>.96?'fome':n.need(i,1)>.975?'sede':n.activeDisease[i]?'doença':n.infection[i]>.7?'infecção':'ferimentos');continue}
  const max=n.derived(i).longevity;if(n.age[i]>max&&sim.rng.chance(.00005*(n.age[i]-max+1)))die(sim,i,'velhice');
 }
}
export function die(sim,i,cause){const n=sim.npcs;if(!n.alive[i])return;const uid=n.uid[i],unique=[];for(let t=0;t<TECH_COUNT;t++){const knows=t<32?!!(n.techKnownLo[i]&(1<<t)):!!(n.techKnownHi[i]&(1<<(t-32)));if(!knows)continue;let other=false;for(const j of n.living())if(j!==i&&(t<32?!!(n.techKnownLo[j]&(1<<t)):!!(n.techKnownHi[j]&(1<<(t-32))))){other=true;break}if(!other)unique.push(t)}if(n.tool[i])sim.world.tools[n.tool[i]]++;n.kill(i,cause,sim.tick);sim.technology?.forgetNpc?.(uid);sim.log('morte',`${n.names[i]} morreu por ${cause}.`,1,i);if(unique.length)sim.log('perda cultural',`${n.names[i]} morreu levando conhecimento único: ${unique.slice(0,3).map(t=>TECH[t].name).join(', ')}.`,1,i);for(const j of n.living()){const r=sim.memory.relation(j,i),weight=Math.max(0,r.affection+r.respect+r.trust);if(weight>.15)sim.memory.remember(j,{type:'morte',text:`${n.names[i]} morreu por ${cause}.`,tick:sim.tick,valence:-8,importance:Math.min(1,.55+weight*.25),reflectionKey:'morte'})}sim.memory.compactDead(i)}
