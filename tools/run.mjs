// Roda a simulação sem interface e imprime um resumo. Uso: node tools/run.mjs [seed] [anos]
import { Sim } from '../src/sim.js';
import { TICKS_PER_YEAR, RACES } from '../src/data.js';

const seed = Number(process.argv[2] ?? 42);
const years = Number(process.argv[3] ?? 30);
const verbose = process.argv.includes('-v');
const sim = new Sim(seed);
const t0 = Date.now();
let shown = 0;
for (let y = 1; y <= years; y++) {
  for (let i = 0; i < TICKS_PER_YEAR; i++) sim.step();
  const c = sim.counts;
  const tribes = sim.tribes.filter((t) => t.alive).map((t) => `${t.race[0]}${t.members.size}/${t.huts.length}h/${Math.round(t.food)}f`).join(' ');
  console.log(`ano ${String(y).padStart(3)} | H${c.human || 0} A${c.dwarf || 0} E${c.elf || 0} O${c.orc || 0} | cervos ${c.deer || 0} lobos ${c.wolf || 0} dragão ${c.dragon || 0} | guerras ${sim.wars.size} | ${tribes}`);
  if (verbose) {
    for (; shown < sim.log.length; shown++) { const e = sim.log[shown]; if (e.imp >= 2) console.log('   ', sim.dateLabel(e.t), '-', e.text); }
  }
}
const ms = Date.now() - t0;
console.log(`\n${years} anos em ${ms} ms (${Math.round((years * TICKS_PER_YEAR) / (ms / 1000))} ticks/s), ${sim.creatures.length} criaturas vivas`);
const causes = {};
for (const d of sim.dead.values()) if (d.sapient) causes[d.deathCause] = (causes[d.deathCause] || 0) + 1;
console.log('causas de morte (povos):', causes);
