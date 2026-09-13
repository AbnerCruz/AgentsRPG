import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
import {BUILDING,RESOURCE,BIOME} from '../src/core/constants.js';
import {ensureConstruction,PIECE,MATERIAL,roomAt,placementPreservesAccess,territoryAt,constructionStats,canAccessChest,groupForNpc} from '../src/systems/construction.js';

function evacuateSite(sim,bp){for(const j of sim.npcs.living()){sim.npcs.x[j]=bp.cx+10+(j%3);sim.npcs.y[j]=bp.cy+10+((j/3)|0)%3}}
function completeBlueprint(sim,bp){assert.ok(bp,'blueprint precisa existir');evacuateSite(sim,bp);let built=null;for(const p of bp.pieces){const x=sim.world.completePiece(bp,p);if(x)built=x}return built}
function addRawPiece(w,type,x,y,layer='ground',opts={}){const id=w.nextPieceId++,p={id,type,x,y,layer,ownerUid:opts.ownerUid??-1,group:opts.group??0,material:opts.material??RESOURCE.LOG,materialStyle:opts.materialStyle??MATERIAL.WOOD,durability:1,maxDurability:1,open:opts.open??false,burning:false,builtTick:0};w.pieceStore[id]=p;if(layer==='ground')w.structure[w.idx(x,y)]=id;return p}

const sim=new Simulation(9090),w=ensureConstruction(sim),n=sim.npcs,i=n.living()[0];
assert.ok(w.structure instanceof Uint16Array&&w.structureOwner instanceof Int16Array,'camadas estruturais precisam ser TypedArrays alinhadas ao mapa');

// Projeto vira peças reais e o progresso mora no alvo compartilhado.
sim.technology.setKnown(n,i,1,-1,sim.tick);n.inventory[i][RESOURCE.LOG]=20;n.inventory[i][RESOURCE.STONE]=5;
const bp=w.createBlueprint(BUILDING.SHELTER,n.x[i],n.y[i],n.uid[i]);assert.ok(bp&&bp.pieces.length>20,'abrigo precisa ser projeto de várias peças');bp.pieces[0].progress=.47;assert.equal(w.nextBlueprintPiece(n.uid[i])?.bp.id,bp.id,'obra existente deve ser fonte de tarefas');assert.equal(bp.pieces[0].progress,.47,'progresso precisa permanecer na peça, não no trabalhador');
// O canteiro sintético é evacuado; emparedamento é testado separadamente abaixo.
evacuateSite(sim,bp);let built=null;for(const p of bp.pieces.filter(x=>x.layer!=='fixture')){const x=w.completePiece(bp,p);if(x)built=x}assert.ok(built?.finished,'casca concluída precisa produzir estrutura funcional');assert.equal(bp.done,false,'móvel avançado não pode bloquear o abrigo físico nem ser confundido com a casca');for(const p of bp.pieces.filter(x=>x.layer==='fixture'))w.completePiece(bp,p);assert.ok(w.pieceStore.filter(Boolean).length>=20,'peças concluídas precisam entrar no store');

// Cômodo fechado: consulta um tile de piso, não o pilar estrutural central.
const ix=bp.cx+1,iy=bp.cy;let room=roomAt(w,ix,iy);assert.ok(room&&room.coverage>.5,'paredes + cobertura precisam formar cômodo');const door=w.pieceStore.find(p=>p?.type===PIECE.DOOR&&Math.hypot(p.x-bp.cx,p.y-bp.cy)<4);assert.ok(door,'projeto precisa ter porta');door.open=true;w.invalidateStructureRegion(door.x,door.y);assert.equal(roomAt(w,ix,iy),null,'porta aberta deve abrir o cômodo');door.open=false;w.invalidateStructureRegion(door.x,door.y);assert.ok(roomAt(w,ix,iy),'fechar a porta deve restaurar o cômodo');const wall=w.pieceStore.find(p=>p?.type===PIECE.WALL&&Math.hypot(p.x-bp.cx,p.y-bp.cy)<4);w.structure[w.idx(wall.x,wall.y)]=0;wall.durability=0;w.invalidateStructureRegion(wall.x,wall.y);assert.equal(roomAt(w,ix,iy),null,'buraco de um tile deve abrir o cômodo');

// Cômodo maior que o limite não entra no cache como interior fechado.
const huge=new Simulation(9191),hw=ensureConstruction(huge),hn=huge.npcs,hi=hn.living()[0],cx=96,cy=96,r=7;hw.pieceStore=[null];hw.nextPieceId=1;hw.structure.fill(0);for(let x=cx-r;x<=cx+r;x++){addRawPiece(hw,PIECE.WALL,x,cy-r);addRawPiece(hw,PIECE.WALL,x,cy+r)}for(let y=cy-r+1;y<cy+r;y++){addRawPiece(hw,PIECE.WALL,cx-r,y);addRawPiece(hw,PIECE.WALL,cx+r,y)}for(let y=cy-r+1;y<cy+r;y++)for(let x=cx-r+1;x<cx+r;x++)addRawPiece(hw,PIECE.ROOF,x,y,'roof');const hugeRestored=Simulation.hydrate(JSON.parse(JSON.stringify(huge.serialize())));assert.equal(roomAt(hugeRestored.world,cx,cy),null,'região grande demais deve ser tratada como aberta');

// Colocação obrigatoriamente preserva uma saída local para NPCs próximos.
const safe=new Simulation(9292),sw=ensureConstruction(safe),sn=safe.npcs,si=sn.living()[0];sn.x[si]=50.5;sn.y[si]=50.5;for(const [x,y] of [[49,50],[51,50],[50,49]])addRawPiece(sw,PIECE.WALL,x,y);assert.equal(placementPreservesAccess(safe,{pieceType:PIECE.WALL,layer:'ground',x:50,y:51}),false,'parede que empareda um NPC deve ser rejeitada');assert.equal(sw.pathfinder.cost(49,50),Infinity,'paredes precisam bloquear A*');const d=addRawPiece(sw,PIECE.DOOR,50,51,'ground',{open:false});assert.ok(Number.isFinite(sw.pathfinder.cost(50,51)),'porta fechada continua passável para humano com custo');

// Manutenção é trabalho contínuo, não recriação do prédio.
wall.durability=wall.maxDurability*.4;sim.technology.setKnown(n,i,1,-1,sim.tick);const repair=w.nextBlueprintPiece(n.uid[i]);assert.ok(repair?.piece?.repairId===wall.id,'peça degradada precisa gerar tarefa de manutenção');

// Território deriva das estruturas e propriedade do baú é relacional.
const territory=territoryAt(sim,bp.cx,bp.cy);assert.equal(territory,groupForNpc(sim,i),'estrutura precisa gerar território do grupo');const storage=w.createBlueprint(BUILDING.STORAGE,bp.cx+9,bp.cy,n.uid[i]);if(storage){completeBlueprint(sim,storage);const chest=w.pieceStore.find(p=>p?.type===PIECE.CHEST&&p.ownerUid===n.uid[i]);if(chest)assert.equal(canAccessChest(sim,i,chest),true,'dono sempre precisa acessar o próprio baú')}

// Material arquitetônico emerge de técnica + ambiente/material disponível.
const stoneSim=new Simulation(9393),stw=ensureConstruction(stoneSim),stn=stoneSim.npcs,sti=stn.living()[0];stoneSim.technology.setKnown(stn,sti,22,-1,0);stn.inventory[sti][RESOURCE.STONE]=4;const stoneBp=stw.createBlueprint(BUILDING.SHELTER,stn.x[sti],stn.y[sti],stn.uid[sti]);assert.equal(stoneBp.style,MATERIAL.STONE,'grupo com pedra e técnica deve poder adotar arquitetura de pedra');
const mudSim=new Simulation(9494),mw=ensureConstruction(mudSim),mn=mudSim.npcs,mi=mn.living()[0];mudSim.technology.setKnown(mn,mi,18,-1,0);mn.inventory[mi][RESOURCE.CLAY]=4;let mudTile=null;for(let y=5;y<187&&!mudTile;y++)for(let x=5;x<187;x++){const b=mw.biome(x,y);if((b===BIOME.STEPPE||b===BIOME.MARSH)&&mw.tile(x,y)!==1&&mw.tile(x,y)!==4){mudTile={x,y};break}}assert.ok(mudTile,'seed de teste precisa conter estepe ou pântano');mn.homeX[mi]=mn.x[mi]=mudTile.x+.5;mn.homeY[mi]=mn.y[mi]=mudTile.y+.5;const mudBp=mw.createBlueprint(BUILDING.SHELTER,mudTile.x,mudTile.y,mn.uid[mi]);assert.equal(mudBp.style,MATERIAL.MUD,'grupo com argila em clima adequado deve poder adotar taipa');

// Save não serializa cache de cômodo; ele é reconstruído deterministicamente pelas peças.
const saved=sim.serialize(),restored=Simulation.hydrate(JSON.parse(JSON.stringify(saved))),before=constructionStats(sim),after=constructionStats(restored);assert.equal(after.pieces,before.pieces,'round-trip perdeu peças estruturais');assert.equal(restored.world.structure.length,192*192,'camada estrutural não foi reconstituída');assert.ok(!saved.world.phaseG.roomCache,'cache de cômodo não deve ir para o save');
console.log(`OK Phase G: ${before.pieces} peças, cômodos incrementais, acesso, manutenção, propriedade, território e materiais emergentes`);