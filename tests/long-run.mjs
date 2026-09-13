import {Simulation} from '../src/simulation.js';
import {DAY_TICKS} from '../src/core/constants.js';
const sim=new Simulation(7919),days=+(process.env.DAYS||600);for(let d=1;d<=days;d++){for(let i=0;i<DAY_TICKS;i++)sim.step();if(d%60===0){const bytes=Buffer.byteLength(JSON.stringify(sim.serialize()));console.log({day:d,alive:sim.npcs.living().length,created:sim.npcs.nextUid-1,saveKB:Math.round(bytes/1024),boss:!sim.dungeon.boss.alive,buildings:sim.world.buildings.length})}if(!sim.npcs.living().length)break}
