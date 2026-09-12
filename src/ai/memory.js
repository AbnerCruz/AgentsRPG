const DECAY=.998;
export class MemorySystem{
 constructor(){this.episodic=new Map();this.semantic=new Map();this.beliefs=new Map();this.relations=new Map()}
 ensure(i){if(!this.episodic.has(i))this.episodic.set(i,[]);if(!this.semantic.has(i))this.semantic.set(i,[]);if(!this.beliefs.has(i))this.beliefs.set(i,[]);if(!this.relations.has(i))this.relations.set(i,new Map())}
 remember(i,event,capacity=200){this.ensure(i);const a=this.episodic.get(i);a.push({...event,accesses:0});if(a.length>capacity){a.sort((x,y)=>this.keep(y)-this.keep(x));a.length=capacity}}
 keep(m){return(m.importance||.5)*Math.pow(DECAY,Math.max(0,(m.age||0)))*(1+(m.accesses||0)*.05)}
 recall(i,context,k=5,tick=0){this.ensure(i);const words=new Set(String(context).toLowerCase().split(/\W+/));const a=this.episodic.get(i);const scored=a.map(m=>{const text=(m.text+' '+(m.type||'')).toLowerCase();let rel=.2;for(const w of words)if(w&&text.includes(w))rel+=.2;const rec=Math.exp(-(tick-m.tick)/1200);return[m,rel*rec*(m.importance||.5)]}).sort((a,b)=>b[1]-a[1]).slice(0,k);for(const [m] of scored)m.accesses=(m.accesses||0)+1;return scored.map(x=>x[0])}
 relation(i,j){this.ensure(i);const m=this.relations.get(i);if(!m.has(j))m.set(j,{trust:0,affection:0,fear:0,respect:0,anger:0,debt:0});return m.get(j)}
 adjust(i,j,delta){const r=this.relation(i,j);for(const[k,v]of Object.entries(delta))r[k]=Math.max(-1,Math.min(1,(r[k]||0)+v))}
 learn(i,fact){this.ensure(i);const a=this.semantic.get(i);const old=a.find(x=>x.key===fact.key);if(old){old.confidence=Math.min(1,old.confidence+.1);old.tick=fact.tick}else a.push({...fact,confidence:fact.confidence||.55})}
 reflect(i,tick){this.ensure(i);const recent=this.episodic.get(i).filter(m=>tick-m.tick<1440);const groups=new Map();for(const m of recent){const k=m.reflectionKey||m.type;if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(m)}for(const[k,a]of groups)if(a.length>=3){const val=a.reduce((s,m)=>s+(m.valence||0),0)/a.length;const text=val>=0?`Experiências repetidas com ${k} parecem confiáveis.`:`Experiências repetidas com ${k} parecem perigosas.`;const b=this.beliefs.get(i);if(!b.some(x=>x.key===k)){b.push({key:k,text,valence:val,tick});this.remember(i,{type:'reflexão',text:`Concluí: ${text}`,tick,valence:val,importance:.9})}}}
 dangerModifier(i,tag){this.ensure(i);const b=this.beliefs.get(i).find(x=>x.key===tag&&x.valence<0);return b?Math.max(.25,1+b.valence/12):1}
 compactDead(i,keep=5){const a=(this.episodic.get(i)||[]).slice().sort((x,y)=>(y.importance||.5)-(x.importance||.5)).slice(0,keep);this.episodic.set(i,a);this.semantic.delete(i);this.beliefs.delete(i);this.relations.delete(i);for(const rel of this.relations.values())rel.delete(i)}
 serialize(){const mapToArr=m=>Array.from(m,([k,v])=>[k,v instanceof Map?Array.from(v):v]);return{episodic:mapToArr(this.episodic),semantic:mapToArr(this.semantic),beliefs:mapToArr(this.beliefs),relations:mapToArr(this.relations)}}
 static hydrate(d){const s=new MemorySystem();for(const k of ['episodic','semantic','beliefs'])s[k]=new Map(d?.[k]||[]);s.relations=new Map((d?.relations||[]).map(([i,a])=>[i,new Map(a)]));return s}
}
