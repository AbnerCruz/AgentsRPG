import {Renderer} from './renderer.js';
import {MATERIAL} from '../systems/construction.js';

if(!Renderer.prototype.__phaseGVisuals){
 Renderer.prototype.drawBlocks=function(ctx){
  const palette={
   [MATERIAL.WOOD]:['#76583b','#9a754f'],
   [MATERIAL.STONE]:['#666a66','#8b8e88'],
   [MATERIAL.MUD]:['#85664a','#a9825b'],
   [MATERIAL.THATCH]:['#8f7a45','#b19b5c'],
   [MATERIAL.METAL]:['#555d60','#858f92']
  };
  for(const b of this.sim.world.blocks){
   const p=this.screen(b.x+.5,b.y+.5);if(!this.visible(p,25))continue;
   const s=14*this.camera.zoom,mat=palette[b.material]||palette[MATERIAL.WOOD],hp=Math.max(0,Math.min(1,b.hp??1));
   ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillRect(p.x-s*.46,p.y+s*.22,s*.92,s*.2);
   ctx.fillStyle=hp<.35?'#51453e':mat[0];
   if(b.type===4){ctx.beginPath();ctx.arc(p.x,p.y,s*.25,0,Math.PI*2);ctx.fillStyle='#c8723e';ctx.fill();ctx.fillStyle='#efbd67';ctx.fillRect(p.x-s*.08,p.y-s*.18,s*.16,s*.3)}
   else{ctx.fillRect(p.x-s/2,p.y-s/2,s,s*.72);ctx.fillStyle=mat[1];ctx.fillRect(p.x-s*.4,p.y-s*.4,s*.8,Math.max(1,this.camera.zoom));if(hp<.7){ctx.strokeStyle='rgba(35,27,24,.7)';ctx.lineWidth=Math.max(1,this.camera.zoom*.6);ctx.beginPath();ctx.moveTo(p.x-s*.25,p.y-s*.2);ctx.lineTo(p.x+s*.18,p.y+s*.12);ctx.stroke()}}
   const piece=b.phaseGId?this.sim.world.pieceStore?.[b.phaseGId]:null;if(piece?.burning){ctx.fillStyle='rgba(231,113,55,.75)';ctx.beginPath();ctx.arc(p.x,p.y-s*.42,s*.18,0,Math.PI*2);ctx.fill()}
  }
 };
 Object.defineProperty(Renderer.prototype,'__phaseGVisuals',{value:true});
}
