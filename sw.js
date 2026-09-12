const CACHE='agentsrpg-v2-20260912';
const CORE=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './src/main.js','./src/simulation.js',
 './src/core/rng.js','./src/core/loop.js','./src/core/save.js','./src/core/constants.js','./src/core/clock.js',
 './src/world/world.js','./src/entities/npcs.js','./src/genetics/genome.js',
 './src/ai/drives.js','./src/ai/memory.js','./src/ai/planner.js','./src/ai/utility.js',
 './src/systems/actions.js','./src/systems/lifecycle.js','./src/systems/professions.js','./src/systems/social.js',
 './src/dungeon/dungeon.js','./src/render/renderer.js','./src/ui/ui.js','./src/narrative/templates.js'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(xs=>Promise.all(xs.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return res})))})
