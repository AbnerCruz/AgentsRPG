export class GameLoop{
 constructor(step,render,{tickMs=250}={}){this.stepFn=step;this.renderFn=render;this.tickMs=tickMs;this.speed=1;this.acc=0;this.last=0;this.running=false}
 setSpeed(v){this.speed=Math.max(0,Number(v)||0)}
 start(){if(this.running)return;this.running=true;this.last=performance.now();requestAnimationFrame(t=>this.frame(t))}
 stop(){this.running=false}
 frame(now){if(!this.running)return;let dt=Math.min(100,now-this.last);this.last=now;if(this.speed>0)this.acc+=dt*this.speed;let guard=0;while(this.acc>=this.tickMs&&guard++<120){this.stepFn();this.acc-=this.tickMs}const alpha=this.speed?Math.min(1,this.acc/this.tickMs):1;this.renderFn(alpha);requestAnimationFrame(t=>this.frame(t))}
}
