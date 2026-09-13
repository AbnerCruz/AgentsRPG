import {GENE,BIOME,RESOURCE} from '../core/constants.js';
import {technologyFor} from './technology.js';

export const DISEASES=[
 {id:0,key:'gastro',name:'doença alimentar',incubation:160,duration:900,severity:.34,lethality:.000035,infectivity:.04,immune:true},
 {id:1,key:'resp',name:'doença respiratória',incubation:320,duration:1500,severity:.22,lethality:.000018,infectivity:.13,immune:true},
 {id:2,key:'wound',name:'infecção de ferimento',incubation:220,duration:1200,severity:.31,lethality:.00004,infectivity:0,immune:false},
 {id:3,key:'marsh',name:'febre do pântano',incubation:420,duration:1800,severity:.28,lethality:.000026,infectivity:.015,immune:true}
];
export function infect(sim,i,id,source=-1){const n=sim.npcs,d=DISEASES[id];if(!d||n.activeDisease[i]||((n.immunity[i]>>>id)&1))return false;const resistance=.35+n.gene(i,GENE.DISEASE)*.65;if(sim.rng.chance(resistance*.38))return false;n.activeDisease[i]=id+1;n.diseaseTimer[i]=0;sim.memory.remember(i,{type:'doença',text:`Comecei a adoecer de ${d.name}.`,tick:sim.tick,valence:-5,importance:.72,reflectionKey:'doença'});if(source>=0)sim.memory.remember(i,{type:'contágio',text:`Adoeci depois de contato com ${n.names[source]}.`,tick:sim.tick,valence:-4,importance:.7,reflectionKey:'estranhos'});return true}
export function foodExposure(sim,i,kind,raw=true){const t=technologyFor(sim),n=sim.npcs;let risk=(kind===RESOURCE.MEAT||kind===RESOURCE.FISH||kind===RESOURCE.MILK)?.035:(kind===RESOURCE.BERRY?.012:.004);if(t.knows(n,i,9)&&!raw)risk*=.12;if(kind===RESOURCE.BERRY&&t.knows(n,i,2))risk*=.22;if(t.knows(n,i,21))risk*=.55;if(sim.rng.chance(risk))infect(sim,i,0)}
export function waterExposure(sim,i){const t=technologyFor(sim),n=sim.npcs,risk=t.knows(n,i,14)?.0015:.012;if(sim.rng.chance(risk))infect(sim,i,0)}
export function diseaseTick(sim){const n=sim.npcs,t=technologyFor(sim);for(const i of n.living()){const active=n.activeDisease[i];if(active){const d=DISEASES[active-1];n.diseaseTimer[i]++;if(n.diseaseTimer[i]>=d.incubation){n.stamina[i]=Math.max(0,n.stamina[i]-d.severity*.00055);n.pain[i]=Math.min(1,n.pain[i]+d.severity*.0007);if(sim.rng.chance(d.lethality*(1-n.gene(i,GENE.DISEASE)*.55)))n.hp[i]-=.02+d.severity*.025;if(n.diseaseTimer[i]>d.incubation+d.duration){if(d.immune)n.immunity[i]|=1<<d.id;n.activeDisease[i]=0;n.diseaseTimer[i]=0;n.pain[i]=Math.max(0,n.pain[i]-.2);sim.memory.remember(i,{type:'recuperação',text:`Me recuperei de ${d.name}.`,tick:sim.tick,valence:3,importance:.65,reflectionKey:'doença'})}}}
  if(sim.tick%60===i%60){const b=sim.world.biome(n.x[i],n.y[i]);if(b===BIOME.MARSH&&sim.rng.chance(.014*(1-n.gene(i,GENE.DISEASE)*.6)))infect(sim,i,3);if(n.wound[i]>.28&&!t.knows(n,i,15)&&sim.rng.chance(.018*(1-n.gene(i,GENE.DISEASE)*.6)))infect(sim,i,2);const cold=n.need(i,3);if(cold>.72&&sim.world.moisture?.[sim.world.idx(n.x[i],n.y[i])]>.55&&sim.rng.chance(.012))infect(sim,i,1)}
 }
 if(sim.tick%30===0)proximitySpread(sim)}
function proximitySpread(sim){const n=sim.npcs,alive=n.living();for(let a=0;a<alive.length;a++){const i=alive[a],active=n.activeDisease[i];if(!active)continue;const d=DISEASES[active-1];if(!d.infectivity||n.diseaseTimer[i]<d.incubation)continue;for(let b=a+1;b<alive.length;b++){const j=alive[b];if(Math.hypot(n.x[i]-n.x[j],n.y[i]-n.y[j])>2.2)continue;if(sim.rng.chance(d.infectivity*.08)){infect(sim,j,d.id,i);break}}}}
