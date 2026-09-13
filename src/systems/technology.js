import {ACTION,GENE,RESOURCE,TECH_COUNT,TOOL,TILE_TYPE,BIOME} from '../core/constants.js';

export const TECH=[
 {id:0,key:'knap',name:'Lascar pedra',pre:[],mat:[RESOURCE.STONE]},
 {id:1,key:'branch_shelter',name:'Abrigo de galhos',pre:[],mat:[RESOURCE.LOG]},
 {id:2,key:'edible_plants',name:'Identificar planta comestível',pre:[],mat:[RESOURCE.BERRY]},
 {id:3,key:'fire',name:'Fogo',pre:[0],mat:[RESOURCE.LOG,RESOURCE.STONE]},
 {id:4,key:'stone_axe',name:'Machado de pedra',pre:[0],mat:[RESOURCE.STONE,RESOURCE.LOG]},
 {id:5,key:'stone_pick',name:'Picareta de pedra',pre:[0],mat:[RESOURCE.STONE,RESOURCE.LOG]},
 {id:6,key:'spear',name:'Lança',pre:[0],mat:[RESOURCE.LOG,RESOURCE.STONE]},
 {id:7,key:'fell_tree',name:'Derrubar árvore',pre:[4],mat:[RESOURCE.LOG]},
 {id:8,key:'wood_building',name:'Construção em madeira',pre:[1,7],mat:[RESOURCE.LOG]},
 {id:9,key:'cooking',name:'Cozinhar',pre:[3],mat:[RESOURCE.MEAT,RESOURCE.FISH]},
 {id:10,key:'tanning',name:'Curtir couro',pre:[0],mat:[RESOURCE.LEATHER]},
 {id:11,key:'basketry',name:'Cestaria',pre:[1],mat:[RESOURCE.LOG]},
 {id:12,key:'fishing',name:'Pesca',pre:[0],mat:[RESOURCE.LOG]},
 {id:13,key:'hunting',name:'Caça com lança',pre:[6],mat:[RESOURCE.MEAT]},
 {id:14,key:'boil_water',name:'Ferver água',pre:[3],mat:[RESOURCE.WATER]},
 {id:15,key:'herbalism',name:'Herbalismo',pre:[2],mat:[RESOURCE.BERRY]},
 {id:16,key:'agriculture',name:'Agricultura',pre:[2,11],mat:[RESOURCE.SEED]},
 {id:17,key:'domestication',name:'Domesticação',pre:[13,16],mat:[RESOURCE.MEAT]},
 {id:18,key:'kiln',name:'Forno',pre:[3,8],mat:[RESOURCE.CLAY,RESOURCE.LOG]},
 {id:19,key:'pottery',name:'Cerâmica',pre:[18],mat:[RESOURCE.CLAY]},
 {id:20,key:'weaving',name:'Tecelagem',pre:[11],mat:[RESOURCE.WOOL]},
 {id:21,key:'preservation',name:'Conservar alimento',pre:[9,19],mat:[RESOURCE.SALT]},
 {id:22,key:'stone_building',name:'Construção em pedra',pre:[5,8],mat:[RESOURCE.STONE]},
 {id:23,key:'charcoal',name:'Carvão vegetal',pre:[3,7],mat:[RESOURCE.LOG]},
 {id:24,key:'smelting',name:'Fundição',pre:[18,23,5],mat:[RESOURCE.IRON,RESOURCE.LOG]},
 {id:25,key:'metallurgy',name:'Metalurgia',pre:[24],mat:[RESOURCE.IRON]},
 {id:26,key:'iron_tools',name:'Ferramentas de ferro',pre:[25],mat:[RESOURCE.IRON]},
 {id:27,key:'iron_weapons',name:'Armas de ferro',pre:[25],mat:[RESOURCE.IRON]},
 {id:28,key:'iron_armor',name:'Armadura de ferro',pre:[25,20],mat:[RESOURCE.IRON]},
 {id:29,key:'masonry',name:'Alvenaria',pre:[22,19],mat:[RESOURCE.STONE,RESOURCE.CLAY]},
 {id:30,key:'nets',name:'Redes de pesca',pre:[12,20],mat:[RESOURCE.WOOL]},
 {id:31,key:'irrigation',name:'Irrigação',pre:[16,19],mat:[RESOURCE.WATER,RESOURCE.CLAY]},
 {id:32,key:'medicine',name:'Medicina herbal',pre:[15,14],mat:[RESOURCE.BERRY,RESOURCE.WATER]},
 {id:33,key:'navigation',name:'Navegação terrestre',pre:[11],mat:[]},
 {id:34,key:'husbandry',name:'Criação de animais',pre:[17],mat:[RESOURCE.GRAIN]},
 {id:35,key:'advanced_metal',name:'Metalurgia avançada',pre:[25,23],mat:[RESOURCE.IRON]}
];

const ACTION_TECH=new Map([
 [ACTION.BUILD,1],[ACTION.WOOD,7],[ACTION.IRON,5],[ACTION.FARM,16],[ACTION.FISH,12],[ACTION.HUNT,13],
 [ACTION.COOK,9],[ACTION.TAILOR,20],[ACTION.FORGE,24]
]);

export const techniqueName=id=>TECH[id]?.name||`Técnica ${id}`;
export const techniqueForAction=action=>ACTION_TECH.get(action)??null;

export class TechnologySystem{
 constructor(sim=null,data=null){
  this.sim=sim;
  this.discoveries=data?.discoveries||[];
  this.crossGroupTransfers=data?.crossGroupTransfers||0;
  this.focusByUid=new Map(data?.focusByUid||[]);
  this.lastAttemptByUid=new Map();
 }
 attach(sim){this.sim=sim;return this}
 ensure(){return this}
 knows(n,i,t){return t<32?!!(n.techKnownLo[i]&(1<<t)):!!(n.techKnownHi[i]&(1<<(t-32)))}
 setKnown(n,i,t,sourceUid=-1,tick=0){if(this.knows(n,i,t))return false;if(t<32)n.techKnownLo[i]|=1<<t;else n.techKnownHi[i]|=1<<(t-32);n.techProgress[i*TECH_COUNT+t]=255;n.techSource[i*TECH_COUNT+t]=sourceUid;n.techLearnTick[i*TECH_COUNT+t]=tick;return true}
 knownList(i){const n=this.sim?.npcs;if(!n)return[];const out=[];for(let t=0;t<TECH_COUNT;t++)if(this.knows(n,i,t))out.push(t);return out}
 canAction(i,action,sim=this.sim){const t=ACTION_TECH.get(action);if(t==null)return true;const n=sim?.npcs;if(!n)return false;return this.knows(n,i,t)}
 countKnown(n,i){let c=0;for(let t=0;t<TECH_COUNT;t++)if(this.knows(n,i,t))c++;return c}
 prerequisites(n,i,t){return !!TECH[t]&&TECH[t].pre.every(p=>this.knows(n,i,p))}
 availableMaterial(sim,i,t){
  const n=sim.npcs,w=sim.world,inv=n.inventory[i],need=TECH[t].mat;
  if(!need.length)return true;
  const x=n.x[i],y=n.y[i],tile=w.tile(x,y),biome=w.biome(x,y);
  return need.some(k=>{
   if(inv[k]>.04)return true;
   if(sim.memory.recallNearest(i,x,y,k,sim.tick,840*30))return true;
   if(w.resourcesNear?.(x,y,2.5,k)?.length)return true;
   if(k===RESOURCE.STONE&&(tile===TILE_TYPE.STONE||biome===BIOME.ROCK||biome===BIOME.MOUNTAIN))return true;
   if(k===RESOURCE.LOG&&(tile===TILE_TYPE.FOREST||[BIOME.OPEN_FOREST,BIOME.DENSE_FOREST,BIOME.BOREAL].includes(biome)))return true;
   if(k===RESOURCE.WATER&&tile===TILE_TYPE.WATER)return true;
   return false;
  });
 }
 progress(n,i,t,amount,sourceUid=-1,tick=0){if(this.knows(n,i,t)||!this.prerequisites(n,i,t))return false;const p=i*TECH_COUNT+t;n.techProgress[p]=Math.min(255,n.techProgress[p]+Math.max(1,amount|0));if(sourceUid>=0)n.techSource[p]=sourceUid;if(n.techProgress[p]>=255)return this.setKnown(n,i,t,n.techSource[p],tick);return false}
 experiment(sim,i){
  this.attach(sim);const n=sim.npcs,uid=n.uid[i];if(!uid||n.age[i]<12||n.need(i,0)>.84||n.need(i,1)>.84)return null;
  const last=this.lastAttemptByUid.get(uid)??-9999;if(sim.tick-last<40)return null;this.lastAttemptByUid.set(uid,sim.tick);
  const candidates=[];for(let t=0;t<TECH_COUNT;t++)if(!this.knows(n,i,t)&&this.prerequisites(n,i,t)&&this.availableMaterial(sim,i,t))candidates.push(t);if(!candidates.length){this.focusByUid.delete(uid);return null}
  let t=this.focusByUid.get(uid);if(!candidates.includes(t)){t=sim.rng.weighted(candidates,x=>1+(n.techProgress[i*TECH_COUNT+x]||0)/80+(x<3?.35:0));this.focusByUid.set(uid,t)}
  const creativity=n.gene(i,GENE.CREATIVITY),curiosity=n.gene(i,GENE.CURIOSITY),stubborn=n.gene(i,GENE.STUBBORN),frustration=Math.min(1,(n.need(i,6)||0)+.15),p=n.techProgress[i*TECH_COUNT+t]||0;
  const chance=.03*(.25+creativity*.75)*(.35+curiosity*.65)*(.55+frustration*.45)*(1+p/255*.3)*(1+stubborn*.18);
  if(!sim.rng.chance(chance))return{tech:t,learned:false,progress:p};
  const gain=62+Math.round((creativity+curiosity)*32+sim.rng.range(0,28)),learned=this.progress(n,i,t,gain,-1,sim.tick);
  if(learned){this.focusByUid.delete(uid);this.onDiscovery(sim,i,t,'experimentação')}
  return{tech:t,learned,progress:n.techProgress[i*TECH_COUNT+t]};
 }
 observe(sim,observer,actor,action){this.attach(sim);const t=ACTION_TECH.get(action);if(t==null)return false;const n=sim.npcs;if(!this.knows(n,actor,t)||this.knows(n,observer,t)||!this.prerequisites(n,observer,t))return false;const hunger=n.need(observer,0),attention=Math.max(.1,1-hunger*.8),gain=Math.round((8+n.gene(observer,GENE.LEARNING)*18)*attention);this.focusByUid.set(n.uid[observer],t);const learned=this.progress(n,observer,t,gain,n.uid[actor],sim.tick);if(learned){this.focusByUid.delete(n.uid[observer]);this.onDiscovery(sim,observer,t,`observando ${n.names[actor]}`)}return learned}
 teach(sim,teacher,student){this.attach(sim);const n=sim.npcs;if(teacher<0||student<0||teacher===student)return null;const options=[];for(let t=0;t<TECH_COUNT;t++)if(this.knows(n,teacher,t)&&!this.knows(n,student,t)&&this.prerequisites(n,student,t))options.push(t);if(!options.length)return null;const t=sim.rng.pick(options),rel=sim.memory.relation(teacher,student),kin=n.parents[student]?.includes(n.uid[teacher])||n.parents[teacher]?.includes(n.uid[student]);const willingness=.25+n.gene(teacher,GENE.LOYALTY)*.35+(rel.affection+.5)*.22+(kin?.22:0)-n.gene(teacher,GENE.GREED)*.28;if(!sim.rng.chance(Math.max(.04,willingness))){sim.memory.remember(student,{type:'recusa',text:`${n.names[teacher]} recusou ensinar ${TECH[t].name}.`,tick:sim.tick,valence:-2,importance:.45,reflectionKey:`pessoa:${teacher}`});return{tech:t,learned:false,refused:true}}this.focusByUid.set(n.uid[student],t);const gain=55+Math.round(n.gene(student,GENE.LEARNING)*65),learned=this.progress(n,student,t,gain,n.uid[teacher],sim.tick);sim.memory.adjust(student,teacher,{trust:.035,affection:.018,debt:.04,knowledgeDebt:.06});sim.memory.adjust(teacher,student,{affection:.012,respect:.008});if(learned){this.focusByUid.delete(n.uid[student]);this.onDiscovery(sim,student,t,`ensinado por ${n.names[teacher]}`)}return{tech:t,learned,refused:false}}
 inherit(sim,parent,child){this.attach(sim);const n=sim.npcs;if(child<0||parent<0)return;for(let t=0;t<TECH_COUNT;t++)if(this.knows(n,parent,t)&&this.prerequisites(n,child,t)&&!this.knows(n,child,t)){this.focusByUid.set(n.uid[child],t);const gain=2+Math.round(n.gene(child,GENE.LEARNING)*4),learned=this.progress(n,child,t,gain,n.uid[parent],sim.tick);if(learned){this.focusByUid.delete(n.uid[child]);this.onDiscovery(sim,child,t,`aprendido na família com ${n.names[parent]}`)}}}
 onDiscovery(sim,i,t,channel){this.attach(sim);const n=sim.npcs,tech=TECH[t],sourceUid=n.techSource[i*TECH_COUNT+t];this.discoveries.push({tick:sim.tick,npc:n.uid[i],tech:t,channel,sourceUid});if(this.discoveries.length>800)this.discoveries.shift();if(sourceUid>0){const source=n.indexByUid(sourceUid);if(source>=0&&Math.hypot(n.homeX[source]-n.homeX[i],n.homeY[source]-n.homeY[i])>18)this.crossGroupTransfers++}sim.memory.remember(i,{type:'técnica',text:`Aprendi ${tech.name} por ${channel}.`,tick:sim.tick,valence:5,importance:.9,reflectionKey:`tecnica:${tech.key}`});sim.log('descoberta',`${n.names[i]} aprendeu ${tech.name}.`,.92,i);if(t===4&&n.tool[i]===TOOL.NONE)n.tool[i]=TOOL.AXE;if(t===5&&n.tool[i]===TOOL.NONE)n.tool[i]=TOOL.PICK;if(t===6&&n.tool[i]===TOOL.NONE)n.tool[i]=TOOL.KNIFE}
 forgetNpc(uid){this.focusByUid.delete(uid);this.lastAttemptByUid.delete(uid)}
 serialize(){return{discoveries:this.discoveries,crossGroupTransfers:this.crossGroupTransfers,focusByUid:Array.from(this.focusByUid)}}
 static hydrate(data,sim=null){return new TechnologySystem(sim,data||{})}
}

export function technologyFor(sim){if(!sim.technology)sim.technology=new TechnologySystem(sim);else sim.technology.attach?.(sim);return sim.technology}
