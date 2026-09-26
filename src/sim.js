// Orquestra o mundo: tempo, criaturas, tribos, diplomacia, guerras, ecologia e crônica.
import { makeRng } from './rng.js';
import { World } from './world.js';
import { Creature, randomGenes } from './creature.js';
import { Tribe } from './tribe.js';
import {
  SPECIES, RACES, AFFINITY, TERRAIN, T, TICKS_PER_DAY, TICKS_PER_SEASON, TICKS_PER_YEAR, SEASONS, TRIBE_COLORS,
} from './data.js';

const CELL = 8;

export class Sim {
  constructor(seed, opts = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.W = opts.W || 180;
    this.H = opts.H || 120;
    this.world = new World(this.W, this.H, this.seed);
    this.tick = 0;
    this.nextId = 1;
    this.nextTribeId = 1;
    this.creatures = [];
    this.byId = new Map();
    this.dead = new Map();
    this.tribes = [];
    this.wars = new Map();
    this.truces = new Map();
    this.log = [];
    this.fx = [];
    this.history = [];
    this.counts = {};
    this.colorIdx = 0;
    this.lastDragonDeath = -1e9;
    this.gw = Math.ceil(this.W / CELL);
    this.gh = Math.ceil(this.H / CELL);
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    this.populate();
    this.rebuildGrid();
    this.snapshot();
  }

  // ---------- tempo ----------
  get year() { return Math.floor(this.tick / TICKS_PER_YEAR) + 1; }
  get season() { return Math.floor((this.tick % TICKS_PER_YEAR) / TICKS_PER_SEASON); }
  get dayFrac() { return (this.tick % TICKS_PER_DAY) / TICKS_PER_DAY; }
  isNight() { const f = this.dayFrac; return f >= 0.75 || f < 0.08; }
  dateLabel(t = this.tick) {
    const y = Math.floor(t / TICKS_PER_YEAR) + 1;
    const s = Math.floor((t % TICKS_PER_YEAR) / TICKS_PER_SEASON);
    return `Ano ${y}, ${SEASONS[s]}`;
  }

  // ---------- registro ----------
  chronicle(imp, text, refs = []) {
    this.log.push({ t: this.tick, imp, text, refs });
    if (this.log.length > 4000) this.log.splice(0, 500);
  }
  pickTribeColor() { return TRIBE_COLORS[this.colorIdx++ % TRIBE_COLORS.length]; }

  add(c) {
    this.creatures.push(c);
    this.byId.set(c.id, c);
    this.counts[c.species] = (this.counts[c.species] || 0) + 1;
    return c;
  }
  find(id) { return id == null ? null : this.byId.get(id) || this.dead.get(id) || null; }
  tribeById(id) { return this.tribes.find((t) => t.id === id) || null; }
  countOf(sp) { return this.counts[sp] || 0; }

  // ---------- espaço ----------
  rebuildGrid() {
    for (const cell of this.grid) cell.length = 0;
    const counts = {};
    for (const c of this.creatures) {
      if (!c.alive) continue;
      counts[c.species] = (counts[c.species] || 0) + 1;
      const gx = Math.min(this.gw - 1, Math.max(0, (c.x / CELL) | 0));
      const gy = Math.min(this.gh - 1, Math.max(0, (c.y / CELL) | 0));
      this.grid[gy * this.gw + gx].push(c);
    }
    this.counts = counts;
  }
  nearby(x, y, r) {
    const out = [];
    const x0 = Math.max(0, ((x - r) / CELL) | 0), x1 = Math.min(this.gw - 1, ((x + r) / CELL) | 0);
    const y0 = Math.max(0, ((y - r) / CELL) | 0), y1 = Math.min(this.gh - 1, ((y + r) / CELL) | 0);
    const r2 = r * r;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        for (const c of this.grid[gy * this.gw + gx]) {
          if (!c.alive) continue;
          const dx = c.x - x, dy = c.y - y;
          if (dx * dx + dy * dy <= r2) out.push(c);
        }
      }
    }
    return out;
  }

  // ---------- passo ----------
  step() {
    this.tick++;
    this.rebuildGrid();
    const list = this.creatures;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const c = list[i];
      if (!c.alive) continue;
      c.update();
      if (c.species === 'dragon' && c.alive && this.tick >= c.sleepUntil) c.dragonBurn();
    }
    if (this.anyDead) {
      this.creatures = this.creatures.filter((c) => c.alive);
      this.anyDead = false;
    }
    if (this.tick % 20 === 0) this.world.regrow(this.season, 20);
    if (this.tick % TICKS_PER_DAY === 0) this.daily();
    if (this.tick % TICKS_PER_SEASON === 0) this.snapshot();
    if (this.tick % 50 === 0) this.fx = this.fx.filter((f) => this.tick - f.t < 400);
  }

  snapshot() {
    const pops = {};
    for (const k of Object.keys(SPECIES)) pops[k] = this.countOf(k);
    this.history.push({ t: this.tick, pops });
    if (this.history.length > 800) this.history = this.history.filter((_, i) => i % 2 === 0);
  }

  // ---------- morte e violência ----------
  onDeath(c, cause, killer) {
    this.anyDead = true;
    this.byId.delete(c.id);
    if (c.sapient || c.species === 'dragon') {
      this.dead.set(c.id, c);
      if (this.dead.size > 5000) this.dead.delete(this.dead.keys().next().value);
    }
    this.fx.push({ type: 'death', x: c.x, y: c.y, t: this.tick, color: c.sp.color });
    const tribe = c.tribe;
    const wasLeader = c.isLeader();
    const ageStr = `${Math.floor(c.ageYears())} anos`;
    if (tribe) { tribe.remove(c); tribe.deaths++; }
    if (c.partner) {
      const p = this.find(c.partner);
      if (p && p.alive) { p.partner = null; p.log(`Ficou viúvo(a) de ${c.name}.`); }
    }

    if (killer) {
      killer.kills++;
      if (c.sapient) {
        killer.fame += c.notable() ? 5 : 2;
        if (killer.sapient) {
          if (killer.kills >= 8 && !killer.epithet) killer.epithet = killer.sex === 'F' ? 'a Sanguinária' : 'o Sanguinário';
          else if (killer.kills >= 4 && !killer.epithet) killer.epithet = killer.sex === 'F' ? 'a Implacável' : 'o Implacável';
          killer.log(`Matou ${c.name}${c.tribe ? '' : ''} em combate.`);
        }
      } else if (c.species === 'wolf' && killer.sapient) {
        killer.fame += 1;
        killer.wolfKills = (killer.wolfKills || 0) + 1;
        if (killer.wolfKills >= 4 && !killer.epithet) killer.epithet = 'Caçador de Lobos';
      } else if (c.species === 'dragon') {
        killer.fame += 40;
        killer.epithet = 'Mata-Dragões';
        killer.log(`Matou o dragão ${c.name}!`);
        this.lastDragonDeath = this.tick;
      }
      // comida da caça
      if (!c.sapient && c.species !== 'dragon') {
        const meat = c.species === 'deer' ? 5 : 3;
        if (killer.sapient) {
          const need = Math.min(meat, Math.ceil(killer.hunger / 0.35));
          killer.eat(need);
          killer.carryFood = Math.min(4, killer.carryFood + (meat - need));
        } else {
          killer.hunger = Math.max(0, killer.hunger - (killer.species === 'dragon' ? 0.35 : 0.8));
          // a alcateia divide a carcaça
          if (killer.species === 'wolf') for (const o of this.nearby(c.x, c.y, 5)) if (o.species === 'wolf' && o !== killer) o.hunger = Math.max(0, o.hunger - 0.5);
        }
      } else if (!killer.sapient) {
        killer.hunger = Math.max(0, killer.hunger - (killer.species === 'dragon' ? 0.45 : 0.9));
      }
      // vingança
      if (c.sapient && killer.sapient) {
        for (const rid of [c.mother, c.father, c.partner, ...c.children]) {
          const r = this.find(rid);
          if (r && r.alive && r !== killer) {
            r.grudges.add(killer.id);
            r.log(`Jurou vingança contra ${killer.name}, que matou ${c.name}.`);
          }
        }
        if (killer.tribe && tribe && killer.tribe !== tribe) {
          this.adjustRelation(killer.tribe, tribe, -18);
          const w = this.wars.get(warKey(killer.tribe, tribe));
          if (w) w.deaths++;
        }
      }
      if (c.sapient && killer.grudges.has(c.id)) {
        killer.grudges.delete(c.id);
        killer.log(`Vingou-se de ${c.name}.`);
        this.chronicle(2, `${killer.fullName()} vingou-se de ${c.name}.`, [killer.id, c.id]);
      }
    }

    // crônica
    let text = null, imp = 1;
    const who = `${c.fullName()}${tribe ? ` (${tribe.name})` : ''}`;
    if (c.species === 'dragon') {
      imp = 3;
      text = killer ? `${killer.name} da ${killer.tribe?.name || 'terra'} matou o dragão ${c.name}! Será lembrado(a) como ${killer.fullName()}.` : `O dragão ${c.name} pereceu.`;
    } else if (c.sapient) {
      const byWhom = killer ? (killer.sapient ? `${killer.fullName()}${killer.tribe ? ` (${killer.tribe.name})` : ''}` : killer.species === 'dragon' ? `o dragão ${killer.name}` : `um ${killer.sp.name.toLowerCase()}`) : '';
      const how = {
        combate: `foi morto(a) por ${byWhom}`,
        fome: 'morreu de fome',
        sede: 'morreu de sede',
        velhice: `morreu de velhice aos ${ageStr}`,
        parto: 'morreu no parto',
      }[cause] || 'morreu';
      c.log(how.charAt(0).toUpperCase() + how.slice(1) + '.');
      if (wasLeader || c.notable()) { imp = 2; text = `${wasLeader ? 'O(A) líder ' : ''}${who} ${how}.`; }
      else if (killer && (killer.sapient || killer.species === 'dragon')) { imp = 1; text = `${who} ${how}.`; }
      else if (cause === 'fome' || cause === 'sede') { imp = 0; text = `${who} ${how}.`; }
    }
    if (text) this.chronicle(imp, text, killer ? [c.id, killer.id] : [c.id]);
  }

  onViolence(src, victim) {
    victim.rel.set(src.id, Math.min(victim.rel.get(src.id) || 0, -60));
    if (src.tribe && victim.tribe && src.tribe !== victim.tribe && !this.atWar(src.tribe, victim.tribe)) {
      this.adjustRelation(src.tribe, victim.tribe, -1.5);
    }
  }

  // ---------- diplomacia ----------
  relation(a, b) {
    if (a === b) return 100;
    let v = a.relations.get(b.id);
    if (v === undefined) {
      v = AFFINITY[a.race][b.race] * 40;
      a.relations.set(b.id, v);
      b.relations.set(a.id, v);
    }
    return v;
  }
  setRelation(a, b, v) {
    v = Math.max(-100, Math.min(100, v));
    a.relations.set(b.id, v);
    b.relations.set(a.id, v);
  }
  adjustRelation(a, b, dv) { if (a !== b) this.setRelation(a, b, this.relation(a, b) + dv); }
  atWar(a, b) { return !!a && !!b && a !== b && this.wars.has(warKey(a, b)); }

  diplomacy() {
    const alive = this.tribes.filter((t) => t.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        let rel = this.relation(a, b);
        const target = AFFINITY[a.race][b.race] * 50;
        rel += (target - rel) * 0.01;
        const d = Math.hypot(a.home.x - b.home.x, a.home.y - b.home.y);
        const overlap = a.radius() + b.radius() + 14 - d;
        if (overlap > 0) rel -= Math.min(2.5, overlap * 0.07);
        // vizinhos disputam terras; líderes agressivos alimentam a rivalidade
        if (d < 70 && AFFINITY[a.race][b.race] < 0.3) {
          const hawk = ((a.leader ? a.leader.agg() : 0.3) + (b.leader ? b.leader.agg() : 0.3)) / 2;
          rel -= ((70 - d) / 70) * (0.2 + hawk * 0.9);
        }
        this.setRelation(a, b, rel);
        const key = warKey(a, b);
        const war = this.wars.get(key);
        if (!war) {
          const truce = this.truces.get(key) || 0;
          if (rel < -45 && this.tick > truce && d < 90 && a.adults() >= 3 && b.adults() >= 3) this.declareWar(a, b);
        } else {
          const years = (this.tick - war.start) / TICKS_PER_YEAR;
          const small = Math.min(a.adults(), b.adults());
          let p = 0.003 + years * 0.012 + war.deaths * 0.006;
          if (small < 3) p += 0.3;
          if (this.rng() < p) this.makePeace(a, b, war);
          else this.planRaids(a, b);
        }
      }
    }
  }

  declareWar(a, b) {
    const [agg, def] = a.members.size >= b.members.size ? [a, b] : [b, a];
    this.wars.set(warKey(a, b), { a: a.id, b: b.id, start: this.tick, deaths: 0 });
    this.chronicle(3, `GUERRA! A ${agg.name} (${agg.sp.plural}) declarou guerra à ${def.name} (${def.sp.plural}).`, agg.leader ? [agg.leader.id] : []);
    for (const t of [a, b]) for (const c of t.members) c.log(`Viu seu povo entrar em guerra contra a ${(t === a ? b : a).name}.`);
  }

  makePeace(a, b, war) {
    this.wars.delete(warKey(a, b));
    this.truces.set(warKey(a, b), this.tick + TICKS_PER_YEAR * 4);
    this.setRelation(a, b, -15);
    const years = Math.max(1, Math.round((this.tick - war.start) / TICKS_PER_YEAR));
    this.chronicle(3, `Paz entre a ${a.name} e a ${b.name} após ${years} ano(s) de guerra e ${war.deaths} mortos.`, []);
    for (const t of [a, b]) for (const c of t.members) if (c.raid) c.raid = null;
  }

  planRaids(a, b) {
    for (const [att, def] of [[a, b], [b, a]]) {
      if (!att.alive || !def.alive) continue;
      const raiding = [...att.members].some((c) => c.raid && c.raid.enemy === def.id);
      if (raiding || this.rng() > 0.3) continue;
      const fighters = [...att.members].filter((c) => c.isAdult() && c.hp > c.maxHp() * 0.6 && !c.pregnant)
        .sort((x, y) => (y.strength() * (0.5 + y.agg())) - (x.strength() * (0.5 + x.agg())));
      const n = Math.min(fighters.length, Math.max(2, Math.ceil(fighters.length * 0.5)));
      if (n < 2) continue;
      const party = fighters.slice(0, n);
      for (const c of party) c.raid = { enemy: def.id, until: this.tick + TICKS_PER_DAY * 3 };
      const chief = party[0];
      this.chronicle(2, `${chief.fullName()} lidera ${n} guerreiros da ${att.name} num ataque contra a ${def.name}.`, [chief.id]);
    }
  }

  // ---------- rotina diária ----------
  daily() {
    for (const t of this.tribes) t.daily();
    this.diplomacy();
    this.ecology();
  }

  ecology() {
    const r = this.rng, w = this.world;
    if (this.countOf('deer') < 30) this.spawnHerd('deer', 8, 'Uma manada de cervos migrou para a região.');
    if (this.countOf('wolf') < 3 && this.countOf('deer') > 25 && r() < 0.05) this.spawnHerd('wolf', 3, 'Uma alcateia de lobos chegou das terras selvagens.');
    const dragons = this.countOf('dragon');
    if (dragons === 0 && this.tick - this.lastDragonDeath > TICKS_PER_YEAR * 40 && this.year > 3) this.spawnDragon(true);
    // novos povos chegam pelo mar quando o mundo fica vazio
    const aliveTribes = this.tribes.filter((t) => t.alive).length;
    const sapients = RACES.reduce((s, k) => s + this.countOf(k), 0);
    const p = sapients === 0 ? 0.05 : aliveTribes < 4 ? 1 / 60 : aliveTribes < 7 ? 1 / 250 : 0;
    if (r() < p) {
      const race = r.pick(RACES);
      const t = this.spawnTribe(race, 8);
      if (t) this.chronicle(3, `Barcos chegaram à costa: um grupo de ${t.sp.plural.toLowerCase()} fundou a ${t.name}.`, t.leader ? [t.leader.id] : []);
    }
  }

  spawnHerd(sp, n, msg) {
    const w = this.world, r = this.rng;
    for (let tries = 0; tries < 50; tries++) {
      const x = r.int(2, this.W - 3), y = r.int(2, this.H - 3);
      const tt = w.tile(x, y);
      if (tt !== T.GRASS && tt !== T.FOREST) continue;
      if (this.tribes.some((t) => t.alive && Math.hypot(t.home.x - x, t.home.y - y) < 20)) continue;
      const home = { x: x + 0.5, y: y + 0.5 };
      for (let i = 0; i < n; i++) {
        const c = this.add(new Creature(this, sp, x + r.range(0, 1.5), y + r.range(0, 1.5), { age: r.range(2, 5) * TICKS_PER_YEAR, sex: i % 2 ? 'F' : 'M' }));
        c.home = home;
      }
      if (msg) this.chronicle(1, msg, []);
      return;
    }
  }

  spawnDragon(announce) {
    const w = this.world, r = this.rng;
    const spot = w.findNearest(r.int(10, this.W - 10), r.int(10, this.H - 10), 60, (i, x, y) => w.terrain[i] === T.HILLS && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.tile(x + dx, y + dy) === T.MOUNTAIN));
    if (!spot) return;
    const d = this.add(new Creature(this, 'dragon', spot[0] + 0.5, spot[1] + 0.5, { age: 200 * TICKS_PER_YEAR }));
    d.home = { x: spot[0] + 0.5, y: spot[1] + 0.5 };
    d.sleepUntil = this.tick + Math.round(r.range(8, 14) * TICKS_PER_YEAR);
    d.hunger = 0.6;
    this.chronicle(3, announce ? `Nas montanhas, um ovo antigo eclodiu. O dragão ${d.name} dorme em seu covil.` : `Dizem que o dragão ${d.name} dorme sob as montanhas.`, [d.id]);
  }

  // ---------- assentamentos ----------
  findSite(race, cx, cy, maxDist, exclude, minDist = 0) {
    const w = this.world, r = this.rng, sp = SPECIES[race];
    let best = null, bs = -1e9;
    for (let k = 0; k < 350; k++) {
      const x = Math.floor(cx + r.range(-maxDist, maxDist)), y = Math.floor(cy + r.range(-maxDist, maxDist));
      if (x < 4 || y < 4 || x >= this.W - 4 || y >= this.H - 4 || !w.passable(x, y)) continue;
      const dd = Math.hypot(x - cx, y - cy);
      if (dd < minDist || dd > maxDist) continue;
      const pref = sp.pref[w.tile(x, y)] ?? 0;
      let food = 0, open = 0;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        if (!w.inside(x + dx, y + dy)) continue;
        const i = w.idx(x + dx, y + dy);
        food += w.foodCap[i];
        if (TERRAIN[w.terrain[i]].passable) open++;
      }
      let sc = food * (0.4 + pref) + open * 0.3;
      if (!w.findNearest(x, y, 4, (i) => w.nearWater[i] === 1)) continue;
      for (const t of this.tribes) {
        if (!t.alive || t === exclude) continue;
        const d = Math.hypot(t.home.x - x, t.home.y - y);
        if (d < 18) sc -= 200;
        else if (d < 32) sc -= (32 - d) * 3;
      }
      sc += r() * 8;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }

  spawnTribe(race, size) {
    const r = this.rng;
    const site = this.findSite(race, this.W / 2, this.H / 2, Math.max(this.W, this.H), null, 0);
    if (!site) return null;
    const t = new Tribe(this, race, site[0] + 0.5, site[1] + 0.5);
    this.tribes.push(t);
    const sp = SPECIES[race];
    const adults = [];
    for (let i = 0; i < size; i++) {
      const child = i >= size - Math.floor(size / 3);
      const age = child ? r.range(1, sp.adult - 1) : r.range(sp.adult, sp.life * 0.55);
      const c = this.add(new Creature(this, race, t.home.x + r.range(-2, 2), t.home.y + r.range(-2, 2), {
        age: age * TICKS_PER_YEAR, sex: i % 2 ? 'F' : 'M',
      }));
      t.add(c);
      c.log(`Chegou às novas terras com a ${t.name}.`);
      if (!child) adults.push(c);
    }
    // casais iniciais
    const men = adults.filter((c) => c.sex === 'M'), women = adults.filter((c) => c.sex === 'F');
    for (let i = 0; i < Math.min(men.length, women.length) - 1; i++) {
      men[i].partner = women[i].id; women[i].partner = men[i].id;
      men[i].rel.set(women[i].id, 60); women[i].rel.set(men[i].id, 60);
    }
    for (const c of t.members) {
      if (!c.isAdult()) {
        const mom = r.pick(women.length ? women : adults);
        c.mother = mom.id;
        mom.children.push(c.id);
        const dad = mom.partner ? this.find(mom.partner) : null;
        if (dad) { c.father = dad.id; dad.children.push(c.id); }
      }
    }
    // duas cabanas iniciais
    for (let k = 0; k < 2; k++) {
      const spot = this.world.findNearest(t.home.x + (k ? 2 : -2), t.home.y + 1, 3, (i, x, y) => !t.hutAt(x, y) && !(x === (t.home.x | 0) && y === (t.home.y | 0)) && TERRAIN[this.world.terrain[i]].passable && this.world.terrain[i] !== T.RIVER);
      if (spot) t.huts.push({ x: spot[0], y: spot[1], built: 0 });
    }
    t.chooseLeader();
    return t;
  }

  foundTribe(race, founders, x, y) {
    const site = this.findSite(race, x, y, 25, null, 0) || [x | 0, y | 0];
    const t = new Tribe(this, race, site[0] + 0.5, site[1] + 0.5);
    t.food = 5;
    this.tribes.push(t);
    for (const c of founders) { t.add(c); c.log(`Fundou a ${t.name}.`); }
    t.chooseLeader();
    this.chronicle(3, `${founders.map((c) => c.name).join(' e ')}, errantes, fundaram a ${t.name}.`, founders.map((c) => c.id));
    return t;
  }

  populate() {
    const r = this.rng;
    this.chronicle(3, `Nasce o mundo de semente ${this.seed}. Quatro povos chegam a estas terras.`, []);
    for (const race of RACES) {
      const t = this.spawnTribe(race, 12);
      if (t) this.chronicle(2, `A ${t.name} (${t.sp.plural}) ergueu acampamento. Líder: ${t.leader?.name}.`, t.leader ? [t.leader.id] : []);
    }
    for (let i = 0; i < 18; i++) this.spawnHerd('deer', r.int(4, 7), null);
    for (let i = 0; i < 4; i++) this.spawnHerd('wolf', 3, null);
    this.spawnDragon(false);
  }
}

function warKey(a, b) { return a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`; }

export { randomGenes };
