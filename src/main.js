import {hashSeed} from './core/rng.js';
import {GameLoop} from './core/loop.js';
import {saveWorld,loadWorld,clearWorld} from './core/save.js';
import {Simulation} from './simulation.js';
import {Renderer} from './render/renderer.js';
import {UI} from './ui/ui.js';
let sim,renderer,ui,loop,lastSaveTick=0;
const seedInput=document.querySelector('#seedInput');seedInput.value=String(Math.floor(Date.now()/1000));
const saved=await loadWorld();if(saved)document.querySelector('#continueBtn').classList.remove('hidden');
document.querySelector('#continueBtn').onclick=async()=>{const elapsed=Math.max(0,Date.now()-(saved.savedAt||Date.now()));const catchup=Math.min(28800,Math.floor(elapsed/2000));await boot(Simulation.hydrate(saved),catchup)};
document.querySelector('#newBtn').onclick=async()=>{await clearWorld();await boot(new Simulation(hashSeed(seedInput.value||Date.now())),0)};
async function boot(instance,catchupTicks=0){sim=instance;if(catchupTicks>0)await catchUp(catchupTicks);document.querySelector('#boot').classList.add('hidden');renderer=new Renderer(document.querySelector('#world'),sim,i=>ui.inspect(i));loop=new GameLoop(()=>{sim.step();if(sim.tick-lastSaveTick>=240){lastSaveTick=sim.tick;saveWorld(sim.serialize())}},()=>{renderer.render();ui.update()});ui=new UI(sim,renderer,loop);loop.start();saveWorld(sim.serialize());addEventListener('agents-save',async()=>{await saveWorld(sim.serialize());ui.toast('Mundo salvo no dispositivo.')},{once:false});document.addEventListener('visibilitychange',async()=>{if(document.hidden)await saveWorld(sim.serialize())});window.addEventListener('pagehide',()=>saveWorld(sim.serialize()));ui.update()}
async function catchUp(total){const note=document.querySelector('.bootCard small');const original=note.textContent;for(let done=0;done<total;){const end=Math.min(total,done+300);for(;done<end;done++)sim.step();note.textContent=`Recuperando o mundo… ${Math.round(done/total*100)}%`;await new Promise(requestAnimationFrame)}note.textContent=original}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
