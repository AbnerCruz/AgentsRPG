import {hashSeed} from './core/rng.js';
import {GameLoop} from './core/loop.js';
import {DAY_TICKS} from './core/constants.js';
import {saveWorld,loadWorld,clearWorld} from './core/save.js';
import {Simulation} from './simulation.js';
import {createNewSimulation} from './simulation-factory.js';
import {Renderer} from './render/renderer.js';
import {installLayerInspector} from './render/layers.js';
import {UI} from './ui/ui.js';
import {installPhaseBUI} from './ui/phaseb.js';
let sim,renderer,ui,loop,lastSaveTick=0,saveQueued=false;
const seedInput=document.querySelector('#seedInput'),status=document.querySelector('#bootStatus'),newBtn=document.querySelector('#newBtn'),continueBtn=document.querySelector('#continueBtn');
seedInput.value=String(Math.floor(Date.now()/1000));
const saved=await loadWorld();
if(saved)continueBtn.classList.remove('hidden');
continueBtn.onclick=async()=>{const elapsed=Math.max(0,Date.now()-(saved.savedAt||Date.now())),catchup=Math.min(DAY_TICKS*14,Math.floor(elapsed/5000));await boot(Simulation.hydrate(saved),catchup)};
newBtn.onclick=async()=>{
 if(newBtn.disabled)return;
 newBtn.disabled=true;continueBtn.disabled=true;seedInput.disabled=true;
 try{
  await clearWorld();
  const seed=hashSeed(seedInput.value||Date.now());
  status.textContent='Gerando continente…';
  await new Promise(requestAnimationFrame);
  const generated=await generateWorld(seed);
  status.textContent=generated?'Criando população…':'Worker indisponível · gerando localmente…';
  await new Promise(requestAnimationFrame);
  const instance=createNewSimulation(seed,generated);
  await boot(instance,0);
 }catch(error){
  console.error(error);
  status.textContent=`Falha ao criar mundo: ${error?.message||error}`;
  newBtn.disabled=false;continueBtn.disabled=false;seedInput.disabled=false;
 }
};

async function generateWorld(seed){
 if(typeof Worker==='undefined')return null;
 return await new Promise(resolve=>{
  let settled=false;
  const worker=new Worker(new URL('./world/world-worker.js',import.meta.url),{type:'module'});
  const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();resolve(value)};
  const timer=setTimeout(()=>finish(null),45000);
  worker.onmessage=e=>{const msg=e.data||{};if(msg.type==='progress'){status.textContent=`Gerando mundo · ${msg.stage} · ${Math.round((msg.value||0)*100)}%`;return}if(msg.type==='done')finish(msg.data);else if(msg.type==='error'){console.error('world worker',msg.message);finish(null)}};
  worker.onerror=e=>{console.error('world worker',e);finish(null)};
  worker.postMessage({seed});
 });
}

async function boot(instance,catchupTicks=0){sim=instance;if(catchupTicks>0)await catchUp(catchupTicks);document.querySelector('#boot').classList.add('hidden');renderer=new Renderer(document.querySelector('#world'),sim,i=>ui.inspect(i));installLayerInspector(renderer,document.querySelector('#layerSelect'));loop=new GameLoop(()=>{sim.step();if(sim.tick-lastSaveTick>=DAY_TICKS){lastSaveTick=sim.tick;scheduleSave()}},alpha=>{renderer.render(alpha);ui.update()});ui=new UI(sim,renderer,loop);installPhaseBUI(ui);loop.start();scheduleSave(true);addEventListener('agents-save',()=>scheduleSave(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)scheduleSave(true)});window.addEventListener('pagehide',()=>saveWorld(sim.serialize()));ui.update();ui.toast?.(`Mundo ${sim.seed} · geração ${sim.world.generationStats?.ms??0} ms`)}
function scheduleSave(immediate=false){if(!sim||saveQueued)return;saveQueued=true;const run=async()=>{try{await saveWorld(sim.serialize())}finally{saveQueued=false}};if(immediate)return run();if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,80)}
async function catchUp(total){const original=status.textContent;for(let done=0;done<total;){const end=Math.min(total,done+220);for(;done<end;done++)sim.step();status.textContent=`Recuperando o mundo… ${Math.round(done/total*100)}%`;await new Promise(requestAnimationFrame)}status.textContent=original}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
