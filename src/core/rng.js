export class RNG{
 constructor(seed=1){this.state=(Number(seed)||1)>>>0}
 next(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}
 int(a,b){return Math.floor(this.next()*(b-a+1))+a}
 range(a,b){return a+this.next()*(b-a)}
 pick(a){return a?.length?a[Math.floor(this.next()*a.length)]:undefined}
 chance(p){return this.next()<p}
 gaussian(){let u=0,v=0;while(!u)u=this.next();while(!v)v=this.next();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
 weighted(items,weight){let sum=0;for(const x of items)sum+=Math.max(0,weight(x));if(sum<=0)return items[0];let r=this.next()*sum;for(const x of items){r-=Math.max(0,weight(x));if(r<=0)return x}return items.at(-1)}
}
export function hashSeed(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0}
export function noiseHash(x,y,seed){let h=(x*374761393+y*668265263+seed*1442695041)|0;h=(h^(h>>>13))*1274126177;return((h^(h>>>16))>>>0)/4294967295}
