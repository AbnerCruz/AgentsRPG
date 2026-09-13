import {MAP_W,MAP_H,TILE} from '../core/constants.js';
const CHUNK=16,CW=Math.ceil(MAP_W/CHUNK),CH=Math.ceil(MAP_H/CHUNK);
export function installPhaseCOverlay(renderer){
 const base=renderer.render.bind(renderer);
 renderer.render=(alpha=1)=>{base(alpha);drawMentalView(renderer)};
}
function drawMentalView(r){
 const i=r.selected,n=r.sim.npcs;if(i<0||!n.alive[i])return;const ctx=r.ctx,d=r.dpr,sp=r.sim.memory.spatial.get(i);ctx.save();ctx.setTransform(d,0,0,d,0,0);
 for(let cy=0;cy<CH;cy++)for(let cx=0;cx<CW;cx++){const familiarity=sp?.coverage?.[cy*CW+cx]||0,p=r.screen(cx*CHUNK,cy*CHUNK),size=CHUNK*TILE*r.camera.zoom;if(p.x+size<0||p.y+size<0||p.x>r.canvas.width/d||p.y>r.canvas.height/d)continue;const a=familiarity?Math.max(.08,.48-familiarity/255*.38):.72;ctx.fillStyle=`rgba(4,7,6,${a})`;ctx.fillRect(p.x,p.y,size,size)}
 if(sp)for(let k=0;k<sp.count;k++){if(sp.tiles[k]<0)continue;const x=sp.tiles[k]%MAP_W+.5,y=Math.floor(sp.tiles[k]/MAP_W)+.5,p=r.screen(x,y);if(!r.visible(p,15))continue;ctx.globalAlpha=Math.max(.2,sp.confidence[k]||.35);ctx.fillStyle=sp.flags[k]?'#e3cf86':'#a6c78c';ctx.fillRect(p.x-2,p.y-2,4,4)}
 ctx.globalAlpha=1;const p=r.screen(n.x[i],n.y[i]),sense=r.sim.lastPerception[i]||{},z=TILE*r.camera.zoom;ctx.lineWidth=1;ctx.strokeStyle='rgba(206,224,191,.72)';circle(ctx,p.x,p.y,(sense.radius||n.derived(i).perception)*z);ctx.setLineDash([4,4]);ctx.strokeStyle='rgba(185,194,218,.48)';circle(ctx,p.x,p.y,(sense.longRadius||n.derived(i).longPerception)*z);ctx.setLineDash([]);const wind=r.sim.world.wind||{dx:1,dy:0},smell=n.derived(i).smell*10*z;ctx.strokeStyle='rgba(215,181,133,.5)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+wind.dx*smell,p.y+wind.dy*smell);ctx.stroke();ctx.restore();
}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(2,r),0,Math.PI*2);ctx.stroke()}
