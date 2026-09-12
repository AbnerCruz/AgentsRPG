export class GameLoop{
  constructor(step,render){this.step=step;this.render=render;this.speed=1;this.acc=0;this.last=performance.now();this.tickMs=250;this.running=false}
  setSpeed(v){this.speed=Number(v)}
  start(){if(this.running)return;this.running=true;const frame=(now)=>{if(!this.running)return;const dt=Math.min(100,now-this.last);this.last=now;if(this.speed>0){this.acc+=dt*this.speed;let n=0;while(this.acc>=this.tickMs&&n<128){this.step();this.acc-=this.tickMs;n++}}if(this.speed<64||Math.floor(now/250)%4===0)this.render(this.acc/this.tickMs);requestAnimationFrame(frame)};requestAnimationFrame(frame)}
  stop(){this.running=false}
}
