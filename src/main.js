import {hashSeed} from './core/rng.js';
import {GameLoop} from './core/loop.js';
import {DAY_TICKS} from './core/constants.js';
import {saveWorld,loadWorld,clearWorld} from './core/save.js';
import {Simulation} from './simulation.js';
import {Renderer} from './render/renderer.js';
import {installLayerInspector} from './render/layers.js';
import {UI} from './ui/ui.js';
import {installPhaseBUI} from './ui/phaseb.js';
let sim,renderer,ui,loop,lastSaveTick=0,saveQueued=false;const seedInput=document.querySelector('#seedInput'),status=document.querySelector('#bootStatus');seedInput.value=String(Math.floor(Date.now()/1000));const saved=await loadWorld();if(saved)document.querySelector('#continueBtn').classList.remove('hidden');document.querySelector('#continueBtn').onclick=async()=>{const elapsed=Math.max(0,Date.now()-(saved.savedAt||Date.now())),catchup=Math.min(DAY_TICKS*14,Math.floor(elapsed/5000));await boot(Simulation.hydrate(saved),catchup)};document.querySelector('#newBtn').onclick=async()=>{await clearWorld();const seed=hashSeed(seedInput.value||Date.now());status.textContent='Preparando geração do mundo…';await new Promise(requestAnimationFrame);const generated=await generateWorld(seed);await boot(new Simulation(seed,generated),0)};
async function generateWorld(seed){
 if(typeof Worker==='undefined')return null;
 return await new Promise(resolve=>{const worker=new Worker(new URL('./world/world-worker.js',import.meta.url),{type:'module'}),fallback=setTimeout(()=>{worker.terminate();resolve(null)},8000);worker.onmessage=e=>{const msg=e.data||{};if(msg.type==='progress'){status.textContent=`Gerando mundo · ${msg.stage} · ${Math.round((msg.value||0)*100)}%`;return}if(msg.type==='done'){clearTimeout(fallback);worker.terminate();resolve(msg.data)}else if(msg.type==='error'){clearTimeout(fallback);worker.terminate();resolve(null)}};worker.onerror=()=>{clearTimeout(fallback);worker.terminate();resolve(null)};worker.postMessage({seed})})
}

async function boot(instance,catchupTicks=0){sim=instance;if(catchupTicks>0)await catchUp(catchupTicks);document.querySelector('#boot').classList.add('hidden');renderer=new Renderer(document.querySelector('#world'),sim,i=>ui.inspect(i));installLayerInspector(renderer,document.querySelector('#layerSelect'));loop=new GameLoop(()=>{sim.step();if(sim.tick-lastSaveTick>=DAY_TICKS){lastSaveTick=sim.tick;scheduleSave()}},alpha=>{renderer.render(alpha);ui.update()});ui=new UI(sim,renderer,loop);installPhaseBUI(ui);loop.start();scheduleSave(true);addEventListener('agents-save',()=>scheduleSave(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)scheduleSave(true)});window.addEventListener('pagehide',()=>saveWorld(sim.serialize()));ui.update();ui.toast?.(`Mundo ${sim.seed} · geração ${sim.world.generationStats?.ms??0} ms`)}
function scheduleSave(immediate=false){if(!sim||saveQueued)return;saveQueued=true;const run=async()=>{try{await saveWorld(sim.serialize())}finally{saveQueued=false}};if(immediate)return run();if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,80)}
async function catchUp(total){const original=status.textContent;for(let done=0;done<total;){const end=Math.min(total,done+220);for(;done<end;done++)sim.step();status.textContent=`Recuperando o mundo… ${Math.round(done/total*100)}%`;await new Promise(requestAnimationFrame)}status.textContent=original}
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
