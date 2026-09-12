import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
const s=new Simulation(7919),samples=[];for(let day=1;day<=600;day++){for(let t=0;t<240;t++)s.step();if(day%60===0)samples.push({day,alive:s.npcs.living().length,boss:!s.dungeon.boss.alive,deepest:s.dungeon.deepest,saveKB:+(JSON.stringify(s.serialize()).length/1024).toFixed(1)})}assert.ok(s.npcs.living().length>0,'seed 7919 não deve extinguir na corrida de 600 dias');console.table(samples);
