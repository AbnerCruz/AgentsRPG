import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim.js';
import { TICKS_PER_YEAR, T } from '../src/data.js';

const run = (sim, years) => { for (let i = 0; i < years * TICKS_PER_YEAR; i++) sim.step(); return sim; };

function fingerprint(sim) {
  let h = 0;
  for (const c of sim.creatures) h = (h * 31 + Math.round(c.x * 100) + Math.round(c.y * 100) * 7 + c.id) | 0;
  return `${sim.creatures.length}:${sim.log.length}:${h}`;
}

test('mundo gerado tem água, rios e acampamentos perto da água', () => {
  const sim = new Sim(123);
  const w = sim.world;
  assert.ok(w.rivers > 0, 'deveria haver rios');
  assert.equal(sim.tribes.length, 4);
  for (const t of sim.tribes) {
    const water = w.findNearest(t.home.x, t.home.y, 4, (i) => w.nearWater[i] === 1);
    assert.ok(water, `${t.name} precisa de água por perto`);
    assert.ok(w.passable(t.home.x | 0, t.home.y | 0));
  }
  assert.ok(sim.creatures.some((c) => c.species === 'dragon'));
});

test('mesma semente produz exatamente a mesma história', () => {
  const a = run(new Sim(99), 3);
  const b = run(new Sim(99), 3);
  assert.equal(fingerprint(a), fingerprint(b));
  assert.deepEqual(a.log.map((e) => e.text), b.log.map((e) => e.text));
});

test('invariantes se mantêm após 15 anos', () => {
  const sim = run(new Sim(7), 15);
  const w = sim.world;
  for (const c of sim.creatures) {
    assert.ok(c.alive);
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y), `posição inválida de ${c.name}`);
    assert.ok(c.x >= 0 && c.y >= 0 && c.x < w.W && c.y < w.H, `${c.name} fora do mapa`);
    assert.ok(c.hp > 0 && c.hp <= c.maxHp() + 1e-6);
    assert.ok(c.hunger >= 0 && c.hunger <= 1 && c.thirst >= 0 && c.thirst <= 1);
    if (!c.sp.flying) assert.ok(w.passable(c.x | 0, c.y | 0) || w.tile(c.x | 0, c.y | 0) === T.RIVER, `${c.name} preso em terreno intransponível`);
  }
  for (const t of sim.tribes.filter((t) => t.alive)) {
    for (const m of t.members) {
      assert.ok(m.alive, 'membro morto continua na tribo');
      assert.equal(m.tribe, t);
    }
    if (t.leader) assert.equal(t.leader.tribe, t);
    assert.ok(t.food >= 0 && t.wood >= 0);
  }
});

test('a vida continua: nascimentos, construções e crônica', () => {
  const sim = run(new Sim(42), 20);
  const births = sim.tribes.reduce((s, t) => s + t.births, 0);
  const sapients = sim.creatures.filter((c) => c.sapient).length;
  assert.ok(births > 10, `poucos nascimentos: ${births}`);
  assert.ok(sapients > 20, `população pequena demais: ${sapients}`);
  assert.ok(sim.tribes.some((t) => t.huts.length > 2), 'nenhuma aldeia cresceu');
  assert.ok(sim.log.length > 10);
  assert.ok(sim.countOf('deer') > 0);
});
