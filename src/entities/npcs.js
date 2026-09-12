import {MAX_NPCS,NEED,GENE,SKILLS,PROF} from '../core/constants.js';
import {randomGenome,inheritGenome,derived} from '../genetics/genome.js';
const FIRST=['Alda','Brann','Cira','Doran','Eira','Fenn','Gala','Hadr','Iria','Jorn','Kara','Leto','Mira','Norn','Orla','Perr','Runa','Sven','Tara','Ulric','Vera','Wynn'];
const LAST=['Pedra','Freixo','Corvo','Vale','Ferro','Rio','Musgo','Cinza','Lobo','Olmo','Luar','Sal'];
export class NPCStore{
 constructor(){const n=MAX_NPCS;this.alive=new Uint8Array(n);this.x=new Float32Array(n);this.y=new Float32Array(n);this.age=new Float32Array(n);this.sex=new Uint8Array(n);this.hp=new Float32Array(n);this.stamina=new Float32Array(n);this.prestige=new Float32Array(n);this.prof=new Uint8Array(n);this.needs=new Float32Array(n*NEED.COUNT);this.genes=new Float32Array(n*GENE.COUNT);this.skills=new Float32Array(n*SKILLS.length);this.names=Array(n).fill('');this.parents=Array.from({length:n},()=>[-1,-1]);this.children=Array.from({length:n},()=>[]);this.partner=new Int16Array(n).fill(-1);this.action=Array(n).fill('observando');this.plan=Array.from({length:n},()=>[]);this.scores=Array.from({length:n},()=>[]);this.inventory=Array.from({length:n},()=>new Float32Array(7));this.birthTick=new Uint32Array(n);this.deathCause=Array(n).fill('');this.count=0}
 gene(i,g){return this.genes[i*GENE.COUNT+g]} setGene(i,g,v){this.genes[i*GENE.COUNT+g]=v}
 need(i,n){return this.needs[i*NEED.COUNT+n]} setNeed(i,n,v){this.needs[i*NEED.COUNT+n]=Math.max(0,Math.min(1,v))}
 skill(i,s){return this.skills[i*SKILLS.length+s]} addSkill(i,s,v){this.skills[i*SKILLS.length+s]=Math.min(1,this.skill(i,s)+v*this.gene(i,GENE.LEARNING))}
 genome(i){return this.genes.slice(i*GENE.COUNT,(i+1)*GENE.COUNT)}
 create(rng,x,y,opts={}){const i=this.count++;if(i>=MAX_NPCS){this.count=MAX_NPCS;throw Error('Limite de NPCs');}this.alive[i]=1;this.x[i]=x;this.y[i]=y;this.age[i]=opts.age??rng.range(18,38);this.sex[i]=opts.sex??rng.int(0,1);this.hp[i]=1;this.stamina[i]=1;this.prestige[i]=opts.prestige||0;this.prof[i]=0;this.names[i]=opts.name||`${rng.pick(FIRST)} ${rng.pick(LAST)}`;const g=opts.genome||randomGenome(rng);this.genes.set(g,i*GENE.COUNT);for(let n=0;n<NEED.COUNT;n++)this.setNeed(i,n,rng.range(.08,.35));this.parents[i]=opts.parents||[-1,-1];this.birthTick[i]=opts.birthTick||0;this.action[i]='observando';return i}
 child(rng,a,b,tick){const g=inheritGenome(this.genome(a),this.genome(b),rng),i=this.create(rng,(this.x[a]+this.x[b])/2,(this.y[a]+this.y[b])/2,{age:0,genome:g,parents:[a,b],birthTick:tick});this.children[a].push(i);this.children[b].push(i);return i}
 derived(i){return derived(this.genome(i),this.age[i])}
 professionName(i){return PROF[this.prof[i]]||PROF[0]}
 living(){const out=[];for(let i=0;i<this.count;i++)if(this.alive[i])out.push(i);return out}
 kill(i,cause){this.alive[i]=0;this.hp[i]=0;this.deathCause[i]=cause;this.action[i]='morto'}
 serialize(){const keys=['alive','x','y','age','sex','hp','stamina','prestige','prof','needs','genes','skills','partner','birthTick'];const out={count:this.count,names:this.names,parents:this.parents,children:this.children,action:this.action,plan:this.plan,scores:this.scores,deathCause:this.deathCause,inventory:this.inventory.map(a=>Array.from(a))};for(const k of keys)out[k]=Array.from(this[k]);return out}
 static hydrate(d){const s=new NPCStore();s.count=d.count;for(const k of ['alive','x','y','age','sex','hp','stamina','prestige','prof','needs','genes','skills','partner','birthTick'])s[k].set(d[k]);for(const k of ['names','parents','children','action','plan','scores','deathCause'])if(d[k])s[k]=d[k];if(d.inventory)s.inventory=d.inventory.map(a=>Float32Array.from(a));return s}
}
