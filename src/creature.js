// Criaturas: necessidades, genética, decisão por utilidade e execução de ações.
import { SPECIES, TICKS_PER_YEAR, TICKS_PER_DAY, T, TERRAIN, makeName } from './data.js';

const HUNGER = 1 / 650;
const THIRST = 1 / 450;
const ENERGY_DRAIN = 1 / 320;
const SLEEP_GAIN = 1 / 70;
const FOOD_VALUE = 0.35; // quanto uma unidade de comida sacia
const CARRY_MAX = 4;
const ENDURANCE = { human: 100, dwarf: 110, elf: 110, orc: 120, deer: 60, wolf: 150, dragon: 400 };
const REACH = { human: 2.5, dwarf: 1.6, elf: 4.5, orc: 2 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// Urgência de uma necessidade: cresce com o valor e explode quando crítica.
const curve = (v) => (v < 0.3 ? 0 : 0.1 + (v - 0.3) / 0.7 + (v > 0.8 ? (v - 0.8) * 4 : 0));

export function randomGenes(rng) {
  const f = () => clamp(rng.gauss(1, 0.1), 0.7, 1.4);
  return { str: f(), spd: f(), vis: f(), life: f(), fert: f(), agg: clamp(rng.gauss(0, 0.12), -0.4, 0.4), soc: clamp(rng.gauss(0, 0.12), -0.4, 0.4) };
}

function mixGenes(rng, a, b) {
  const g = {};
  for (const k of Object.keys(a)) {
    const base = rng() < 0.5 ? a[k] : b[k];
    const mid = (a[k] + b[k]) / 2;
    const v = (base + mid) / 2 + rng.gauss(0, 0.05);
    g[k] = k === 'agg' || k === 'soc' ? clamp(v, -0.45, 0.45) : clamp(v, 0.6, 1.6);
  }
  return g;
}

export class Creature {
  constructor(sim, species, x, y, o = {}) {
    const r = sim.rng;
    this.sim = sim;
    this.id = sim.nextId++;
    this.species = species;
    this.sp = SPECIES[species];
    this.sex = o.sex || (r() < 0.5 ? 'F' : 'M');
    this.name = o.name || makeName(r, species, this.sex);
    this.epithet = '';
    this.x = x;
    this.y = y;
    this.dir = r() * Math.PI * 2;
    this.age = o.age ?? 0;
    this.genes = o.genes || randomGenes(r);
    this.lifespan = this.sp.life * this.genes.life * TICKS_PER_YEAR;
    this.tribe = null;
    this.mother = o.mother ?? null;
    this.father = o.father ?? null;
    this.partner = null;
    this.children = [];
    this.hunger = r.range(0, 0.3);
    this.thirst = r.range(0, 0.3);
    this.energy = r.range(0.6, 1);
    this.stamina = 1;
    this.hp = this.maxHp();
    this.carryFood = 0;
    this.carryWood = 0;
    this.action = null;
    this.thought = '';
    this.nextDecide = sim.tick + r.int(0, 10);
    this.path = null;
    this.rel = new Map();
    this.grudges = new Set();
    this.kills = 0;
    this.fame = 0;
    this.history = [];
    this.pregnant = null;
    this.lastBirth = -1e9;
    this.attackCd = 0;
    this.hitFlash = 0;
    this.lastAttacker = null;
    this.lastHitT = -1e9;
    this.alive = true;
    this.raid = null;
    this.memWater = null;
    this.memFood = null;
    this.home = null; // toca/covil para animais
    this.sleepUntil = 0;
    this.deathT = null;
    this.deathCause = null;
  }

  // ---------- atributos derivados ----------
  get sapient() { return this.sp.sapient; }
  ageYears() { return this.age / TICKS_PER_YEAR; }
  isAdult() { return this.ageYears() >= this.sp.adult; }
  ageFactor() {
    // muda devagar: recalcula no máximo a cada 50 ticks
    if (this._afT !== undefined && this.sim.tick - this._afT < 50) return this._af;
    this._afT = this.sim.tick;
    return (this._af = this.computeAgeFactor());
  }
  computeAgeFactor() {
    const y = this.ageYears();
    if (y < this.sp.adult) return 0.35 + 0.65 * (y / this.sp.adult);
    const lf = this.age / this.lifespan;
    if (lf > 0.75) return Math.max(0.55, 1 - (lf - 0.75) * 1.6);
    return 1;
  }
  maxHp() { return this.sp.hp * (0.6 + 0.4 * this.genes.str) * this.ageFactor(); }
  strength() { return this.sp.str * this.genes.str * this.ageFactor(); }
  vision() { return this.sp.vis * this.genes.vis; }
  agg() { return clamp(this.sp.agg + this.genes.agg, 0, 1); }
  soc() { return clamp(this.sp.soc + this.genes.soc, 0, 1); }
  power() { return this.strength() * Math.sqrt(Math.max(1, this.hp)); }
  fullName() { return this.epithet ? `${this.name} ${this.epithet}` : this.name; }
  isLeader() { return !!this.tribe && this.tribe.leader === this; }
  notable() { return this.fame >= 6 || this.isLeader() || !!this.epithet || this.species === 'dragon'; }
  homePos() {
    if (this.tribe) return this.tribe.home;
    return this.home;
  }
  speed() {
    const s = this.sim;
    let v = this.sp.spd * this.genes.spd;
    if (!this.isAdult()) v *= 0.8;
    if (this.hp < this.maxHp() * 0.35) v *= 0.7;
    if (this.sprinting && this.stamina > 0) v *= 1.3;
    if (!this.sp.flying) {
      const t = s.world.tile(this.x | 0, this.y | 0);
      v /= this.species === 'dwarf' && t === T.HILLS ? 1 : TERRAIN[t].cost;
    }
    return v;
  }

  log(text) {
    this.history.push({ t: this.sim.tick, text });
    if (this.history.length > 80) this.history.splice(1, 1);
  }

  // ---------- ciclo por tick ----------
  update() {
    const s = this.sim;
    this.age++;
    if (this.attackCd > 0) this.attackCd--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.sprinting) this.stamina = Math.max(0, this.stamina - 1 / ENDURANCE[this.species]);
    else if (this.stamina < 1) this.stamina = Math.min(1, this.stamina + 1 / 250);
    this.sprinting = false;

    if (this.species === 'dragon') {
      if (s.tick < this.sleepUntil) {
        this.thought = 'dormindo em seu covil';
        if (this.hp < this.maxHp()) this.hp = Math.min(this.maxHp(), this.hp + 0.2);
        return;
      }
      this.hunger = Math.min(1, this.hunger + 1 / 3000);
    } else {
      const winter = s.season === 3 ? 1.2 : 1;
      this.hunger += HUNGER * winter * (this.isAdult() ? 1 : 0.8) * (this.species === 'wolf' ? 0.6 : 1);
      this.thirst += THIRST;
      if (this.hunger >= 1) { this.hunger = 1; this.hurt(this.maxHp() / 500, null, 'fome'); }
      if (this.thirst >= 1) { this.thirst = 1; this.hurt(this.maxHp() / 400, null, 'sede'); }
      if (!this.alive) return;
    }
    if (this.sapient) {
      if (this.action?.type === 'sleep' && this.action.asleep) this.energy = Math.min(1, this.energy + SLEEP_GAIN);
      else this.energy = Math.max(0, this.energy - ENERGY_DRAIN);
    }
    const mhp = this.maxHp();
    if (this.hp < mhp && this.hunger < 0.6 && this.thirst < 0.6) {
      const sleeping = this.action?.asleep ? 3 : 1;
      this.hp = Math.min(mhp, this.hp + (mhp / 1200) * sleeping);
    }
    if (this.hp > mhp) this.hp = mhp;
    if (this.pregnant && s.tick >= this.pregnant.due) this.giveBirth();
    if ((s.tick + this.id) % TICKS_PER_DAY === 0) this.dailyCheck();
    if (!this.alive) return;

    if (this.needDecide || s.tick >= this.nextDecide || !this.action) {
      this.needDecide = false;
      this.nextDecide = s.tick + (this.action?.asleep ? 30 : this.sapient ? 10 : 16) + (this.id % 6);
      this.decide();
    }
    this.perform();
  }

  dailyCheck() {
    const lf = this.age / this.lifespan;
    if (lf > 0.85 && this.sim.rng() < (lf - 0.85) * 0.3) this.die('velhice');
  }

  // ---------- movimento ----------
  stepToward(tx, ty) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return true;
    const step = Math.min(d, this.speed());
    const nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
    this.dir = Math.atan2(dy, dx);
    const w = this.sim.world;
    if (this.sp.flying || w.passable(nx | 0, ny | 0) || !w.passable(this.x | 0, this.y | 0)) {
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false;
  }

  // 1 = chegou, 0 = andando, -1 = inalcançável
  goTo(tx, ty, reach = 0.4) {
    if (Math.hypot(tx - this.x, ty - this.y) <= reach) { this.path = null; return 1; }
    const w = this.sim.world;
    if (this.pathTx !== tx || this.pathTy !== ty) this.noLine = false;
    if (!this.path || this.pathTx !== tx || this.pathTy !== ty) {
      if (this.sp.flying || (!this.noLine && w.lineClear(this.x, this.y, tx, ty))) this.path = [[tx, ty]];
      else {
        const p = w.findPath(this.x | 0, this.y | 0, tx | 0, ty | 0);
        if (!p) { this.path = null; return -1; }
        p[p.length - 1] = [tx, ty];
        this.path = p;
      }
      this.pathTx = tx; this.pathTy = ty; this.pathI = 0;
    }
    const wp = this.path[this.pathI];
    if (!this.stepToward(wp[0], wp[1])) {
      // a linha reta raspou numa quina: usa A* daqui em diante
      this.path = null;
      this.noLine = true;
      this.stuck = (this.stuck || 0) + 1;
      if (this.stuck > 6) { this.stuck = 0; return -1; }
      return 0;
    }
    this.stuck = 0;
    if (this.pathI < this.path.length - 1 && Math.hypot(wp[0] - this.x, wp[1] - this.y) < 0.2) this.pathI++;
    return 0;
  }

  chase(o, reach) {
    const d = Math.hypot(o.x - this.x, o.y - this.y);
    if (d <= reach) return 1;
    this.sprinting = d < 8;
    const w = this.sim.world;
    if (this.sp.flying || (d < 12 && w.lineClear(this.x, this.y, o.x, o.y))) {
      if (!this.noLine) {
        this.path = null;
        if (this.stepToward(o.x, o.y)) return 0;
        this.noLine = true;
      }
    }
    if (this.path && this.pathTx != null && this.sim.tick - (this.chaseT || 0) < 15) return this.goTo(this.pathTx, this.pathTy, reach);
    this.chaseT = this.sim.tick;
    return this.goTo((o.x | 0) + 0.5, (o.y | 0) + 0.5, reach);
  }

  // ---------- combate ----------
  attack(o, hunting) {
    if (this.attackCd > 0) return;
    const s = this.sim;
    this.attackCd = this.species === 'dragon' ? 18 : 14;
    const d = Math.hypot(o.x - this.x, o.y - this.y);
    const ranged = d > 1.4;
    const hitChance = ranged ? 0.55 : 0.75;
    s.fx.push({ type: ranged ? 'arrow' : 'slash', x: this.x, y: this.y, x2: o.x, y2: o.y, t: s.tick, color: this.sp.color });
    if (s.rng() > hitChance) return;
    let dmg = this.strength() * s.rng.range(0.6, 1.4);
    if (hunting && !o.sapient) dmg *= 1.5;
    o.hurt(dmg, this, 'combate');
  }

  hurt(dmg, src, cause) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hitFlash = 6;
    if (src) {
      this.lastAttacker = src.id;
      this.lastHitT = this.sim.tick;
      this.needDecide = true;
      if (this.action?.asleep) this.action = null;
      if (this.species === 'dragon' && this.sim.tick < this.sleepUntil) this.sleepUntil = 0;
      if (src.sapient && this.sapient) this.sim.onViolence(src, this);
    }
    if (this.hp <= 0) this.die(cause, src);
  }

  die(cause, killer) {
    if (!this.alive) return;
    const s = this.sim;
    this.alive = false;
    this.hp = 0;
    this.deathT = s.tick;
    this.deathCause = cause;
    this.action = null;
    s.onDeath(this, cause, killer);
  }

  // ---------- reprodução ----------
  conceive(father) {
    const s = this.sim;
    this.pregnant = { father: father.id, due: s.tick + Math.round(this.sp.gestation * TICKS_PER_YEAR) };
    this.lastBirth = s.tick;
    father.lastBirth = s.tick;
  }

  giveBirth() {
    const s = this.sim;
    const father = s.find(this.pregnant.father);
    const fGenes = father ? father.genes : this.genes;
    this.pregnant = null;
    const n = s.rng.int(this.sp.litter[0], this.sp.litter[1]);
    for (let i = 0; i < n; i++) {
      const c = new Creature(s, this.species, this.x + s.rng.range(-0.3, 0.3), this.y + s.rng.range(-0.3, 0.3), {
        genes: mixGenes(s.rng, this.genes, fGenes), mother: this.id, father: father ? father.id : null,
      });
      c.hunger = 0.1; c.thirst = 0.1; c.energy = 1;
      c.home = this.home;
      s.add(c);
      this.children.push(c.id);
      if (father) father.children.push(c.id);
      if (this.tribe) { this.tribe.add(c); this.tribe.births++; }
      if (this.sapient) {
        c.log(`Nasceu, filho(a) de ${this.name}${father ? ' e ' + father.name : ''}${this.tribe ? ', na ' + this.tribe.name : ''}.`);
        this.log(`Deu à luz ${c.name}.`);
        if (father) father.log(`Tornou-se pai de ${c.name}.`);
        if (this.isLeader() || father?.isLeader()) s.chronicle(1, `Nasce ${c.name}, filho(a) de ${this.isLeader() ? 'da líder' : 'do líder'} da ${this.tribe?.name}.`, [c.id]);
        if (this.children.length === 8) { this.epithet = this.epithet || 'a Matriarca'; }
        if (father && father.children.length === 8 && father.sex === 'M') father.epithet = father.epithet || 'o Patriarca';
      }
    }
    if (this.sapient && s.rng() < 0.015) this.die('parto');
  }

  // ---------- decisão ----------
  decide() {
    switch (this.species) {
      case 'deer': return this.decideDeer();
      case 'wolf': return this.decideWolf();
      case 'dragon': return this.decideDragon();
      default: return this.decideSapient();
    }
  }

  setAction(a, thought) {
    if (this.action && this.action.type === a.type && a.type !== 'wander' && this.action.targetId === a.targetId && this.action.tx === a.tx && this.action.ty === a.ty) return;
    a.work = 0;
    a.start = this.sim.tick;
    this.action = a;
    this.path = null;
    this.pathTx = null;
    if (thought) this.thought = thought;
  }
  done() { this.action = null; this.needDecide = true; }

  isEnemyOf(o, d) {
    const s = this.sim;
    if (!o.alive || o === this) return false;
    if (this.lastAttacker === o.id && s.tick - this.lastHitT < 150) return true;
    const oa = o.action;
    if (oa && oa.type === 'attack') {
      const t = s.find(oa.targetId);
      if (t === this || (t && this.tribe && t.tribe === this.tribe)) return true;
    }
    if (o.species === 'dragon') return s.tick >= o.sleepUntil || d < 4;
    if (o.species === 'wolf') return d < 3 && this.sapient;
    if (!o.sapient || !this.sapient) return false;
    if (this.grudges.has(o.id)) return true;
    if (this.tribe && o.tribe && this.tribe !== o.tribe && s.atWar(this.tribe, o.tribe)) return true;
    return false;
  }

  decideSapient() {
    const s = this.sim, w = s.world, r = s.rng;
    const near = s.nearby(this.x, this.y, this.vision());
    const tribe = this.tribe;
    const home = this.homePos();
    const adult = this.isAdult();

    // --- ameaças ---
    let threat = 0, allies = this.power(), nearestEnemy = null, nd = 1e9;
    for (const o of near) {
      if (o === this) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (this.isEnemyOf(o, d)) {
        threat += o.power();
        if (d < nd) { nd = d; nearestEnemy = o; }
      } else if (o.sapient && tribe && o.tribe === tribe && o.isAdult()) allies += o.power() * 0.6;
    }
    if (nearestEnemy && nearestEnemy.species === 'dragon' && nd > 9 && (this.thirst > 0.75 || this.hunger > 0.85)) nearestEnemy = null;
    if (nearestEnemy) {
      const atHome = home && Math.hypot(home.x - this.x, home.y - this.y) < 8;
      const courage = this.agg() * 1.6 + (this.raid ? 0.5 : 0) + (atHome ? 0.4 : 0) + (this.grudges.has(nearestEnemy.id) ? 0.5 : 0) - (this.hp < this.maxHp() * 0.35 ? 0.7 : 0);
      if (adult && (allies / (threat + 0.01)) * courage >= 0.55) {
        const verb = nearestEnemy.species === 'dragon' ? 'enfrentando o dragão' : `lutando contra ${nearestEnemy.sapient ? nearestEnemy.name : 'um ' + nearestEnemy.sp.name.toLowerCase()}`;
        this.setAction({ type: 'attack', targetId: nearestEnemy.id, hunting: false }, verb);
      } else {
        this.flee(nearestEnemy);
      }
      return;
    }
    if (this.action && (this.action.type === 'attack' || this.action.type === 'flee') && s.tick - this.action.start < 25) return;

    // comer o que carrega
    if (this.hunger > 0.35 && this.carryFood > 0) {
      const take = Math.min(this.carryFood, Math.ceil(this.hunger / FOOD_VALUE));
      this.carryFood -= take;
      this.eat(take);
    }

    const cur = this.action?.type;
    const keep = (t) => (cur === t ? 0.12 : 0);
    let best = 0.06;
    let choice = () => this.planWander();
    const consider = (score, fn) => { if (score > best) { best = score; choice = fn; } };
    // mantém a tarefa em andamento em vez de replanejar (e perder o progresso)
    const stay = (types, fn) => () => (types.includes(cur) ? null : fn());

    consider(curve(this.thirst) * 1.45 + keep('drink'), stay(['drink'], () => this.planDrink()));
    consider(curve(this.hunger) * 1.2 + keep('forage') + keep('eatHome') + keep('fish'), stay(['forage', 'eatHome', 'fish'], () => this.planEat()));

    const night = s.isNight();
    let sleepScore = night ? 0.3 + (1 - this.energy) * 0.6 : (this.energy < 0.2 ? 0.7 : 0);
    if (cur === 'sleep') sleepScore += this.energy < 0.97 ? 0.2 : -0.3;
    consider(sleepScore, stay(['sleep'], () => this.planSleep()));

    if (this.carryFood + this.carryWood >= 1 && tribe) consider(0.28 + keep('deliver'), stay(['deliver'], () => this.setAction({ type: 'deliver' }, 'levando provisões para casa')));

    if (adult && tribe) {
      const members = tribe.members.size;
      const foodGoal = members * 5;
      const role = this.role || 'coletor';
      const bonus = (r) => (role === r ? 0.25 : 0);
      const deficit = Math.max(0, 1 - tribe.food / foodGoal);
      const gathering = cur === 'forage' && this.action.forTribe || cur === 'fish' && this.action.forTribe;
      if (tribe.food < foodGoal * 1.5) consider(0.15 + 0.35 * deficit + bonus('coletor') + (gathering ? 0.12 : 0) + (s.season === 2 ? 0.1 : 0), stay(['forage', 'fish'], () => this.planGather()));
      if (role === 'caçador' && tribe.food < foodGoal * 2) consider(0.45 + keep('attack'), stay(['attack'], () => this.planHunt()));
      if (tribe.wantsHut()) {
        if (tribe.wood >= 6 && (tribe.builder === this.id || !tribe.builderActive())) consider(0.42 + bonus('lenhador') + keep('build') * 2, () => (cur === 'build' ? null : this.planBuild()));
        else if (tribe.wood < 8) consider(0.2 + bonus('lenhador') * 1.4 + keep('chop'), stay(['chop'], () => this.planChop()));
      }
      if (tribe.wantsField()) consider(0.2 + bonus('agricultor') * 1.4 + keep('farm'), stay(['farm'], () => this.planFarm()));
      if (this.raid && s.tick < this.raid.until && this.hunger < 0.75 && this.thirst < 0.75) consider(0.62, stay(['raid'], () => this.planRaid()));
      // parceiro e filhos
      if (this.canMate()) {
        const p = this.partner ? s.find(this.partner) : null;
        const crowd = members >= tribe.capacity() + 4 ? 0.4 : members >= tribe.capacity() ? 0.75 : 1;
        if (p && p.alive && p.canMate()) consider((0.6 + 0.3 * this.genes.fert * this.sp.fert) * crowd, () => this.setAction({ type: 'mate', targetId: p.id }, `procurando ${p.name}`));
      }
      if (!this.partner && this.hunger < 0.6) {
        const cand = this.findSuitor(near);
        if (cand) consider(0.35 + this.soc() * 0.25, () => this.setAction({ type: 'socialize', targetId: cand.id, court: true }, `cortejando ${cand.name}`));
      }
    }
    if (!tribe && adult) consider(0.35, () => this.planJoin());

    // socializar
    if (!night && this.hunger < 0.6 && this.thirst < 0.6) {
      const friend = near.find((o) => o !== this && o.sapient && o.alive && (o.tribe === tribe || (o.tribe && tribe && s.relation(o.tribe, tribe) > -20)) && Math.hypot(o.x - this.x, o.y - this.y) < 5);
      if (friend) consider(this.soc() * 0.28 + keep('socialize'), () => this.setAction({ type: 'socialize', targetId: friend.id }, `conversando com ${friend.name}`));
      // briga com estranhos de tribos rivais
      if (adult && tribe) {
        const rival = near.find((o) => o.sapient && o.alive && o.tribe && o.tribe !== tribe && o.isAdult() && s.relation(o.tribe, tribe) < -30);
        if (rival && r() < this.agg() * this.agg() * 0.06) {
          s.chronicle(1, `${this.name} (${tribe.name}) provocou uma briga com ${rival.name} (${rival.tribe.name}).`, [this.id, rival.id]);
          this.setAction({ type: 'attack', targetId: rival.id, hunting: false }, `brigando com ${rival.name}`);
          return;
        }
      }
    }
    // voltar para casa quando longe demais
    if (home) {
      const d = Math.hypot(home.x - this.x, home.y - this.y);
      const lim = tribe ? tribe.radius() * 1.6 : 12;
      if (d > lim && !this.raid) consider(0.15 + Math.min(0.3, d / 150), () => this.setAction({ type: 'wander', tx: home.x, ty: home.y }, 'voltando para casa'));
    }
    if (!adult) {
      const mom = this.mother ? s.find(this.mother) : null;
      if (mom && mom.alive && Math.hypot(mom.x - this.x, mom.y - this.y) > 4) consider(0.18, () => this.setAction({ type: 'wander', tx: mom.x, ty: mom.y }, `seguindo ${mom.name}`));
    }
    choice();
  }

  canMate() {
    if (!this.isAdult() || this.pregnant) return false;
    if (this.sex === 'F' && this.age > this.lifespan * 0.7) return false;
    if (this.hunger > 0.6 || this.thirst > 0.6) return false;
    return this.sim.tick - this.lastBirth > TICKS_PER_YEAR * (this.species === 'elf' ? 3 : 1);
  }

  findSuitor(near) {
    let best = null, bs = -1e9;
    for (const o of near) {
      if (o === this || !o.alive || o.species !== this.species || o.sex === this.sex || o.partner || !o.isAdult()) continue;
      if (o.tribe !== this.tribe) continue;
      if (o.id === this.mother || o.id === this.father || o.mother === this.id || o.father === this.id) continue;
      if (o.mother && o.mother === this.mother) continue;
      const sc = (this.rel.get(o.id) || 0) - Math.hypot(o.x - this.x, o.y - this.y);
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }

  flee(from) {
    const s = this.sim, w = s.world;
    let ax = this.x - from.x, ay = this.y - from.y;
    const d = Math.hypot(ax, ay) || 1;
    ax /= d; ay /= d;
    const home = this.homePos();
    let tx = this.x + ax * 8, ty = this.y + ay * 8;
    if (home) {
      const hx = home.x - this.x, hy = home.y - this.y;
      const hd = Math.hypot(hx, hy);
      if (hd > 3 && (hx * ax + hy * ay) / hd > 0) { tx = home.x; ty = home.y; }
    }
    const spot = w.findNearest(tx, ty, 4, (i, x, y) => w.passable(x, y));
    if (!spot) return;
    this.setAction({ type: 'flee', tx: spot[0] + 0.5, ty: spot[1] + 0.5, fromId: from.id }, from.species === 'dragon' ? 'fugindo do dragão!' : `fugindo de ${from.sapient ? from.name : 'um ' + from.sp.name.toLowerCase()}`);
  }

  eat(units) {
    this.hunger = Math.max(0, this.hunger - units * FOOD_VALUE);
  }

  planWander() {
    const s = this.sim, w = s.world, r = s.rng;
    const home = this.homePos();
    let cx = this.x, cy = this.y, rad = 7;
    if (home && this.sapient) {
      rad = this.tribe ? this.tribe.radius() : 8;
      if (Math.hypot(home.x - this.x, home.y - this.y) > rad) { cx = home.x; cy = home.y; rad = 4; }
    }
    const spot = w.findNearest(cx + r.range(-rad, rad), cy + r.range(-rad, rad), 3, (i, x, y) => w.passable(x, y));
    if (spot) this.setAction({ type: 'wander', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, this.sapient ? r.pick(['passeando', 'observando os arredores', 'perambulando', 'pensando na vida']) : 'vagando');
  }

  planDrink() {
    const w = this.sim.world;
    const spot = w.findNearest(this.x, this.y, Math.round(this.vision() * 2.5), (i) => w.nearWater[i] === 1) || this.memWater;
    if (!spot) return this.explore('procurando água');
    this.setAction({ type: 'drink', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, 'indo beber água');
  }

  findFoodTile(min) {
    const w = this.sim.world;
    return w.findNearest(this.x, this.y, Math.round(this.vision()), (i) => w.food[i] >= min);
  }

  planEat() {
    const s = this.sim, tribe = this.tribe;
    if (tribe && tribe.food >= 1 && Math.hypot(tribe.home.x - this.x, tribe.home.y - this.y) < 30) {
      return this.setAction({ type: 'eatHome' }, 'indo comer no acampamento');
    }
    const spot = this.findFoodTile(0.6);
    if (spot) return this.setAction({ type: 'forage', tx: spot[0] + 0.5, ty: spot[1] + 0.5, forTribe: false }, 'colhendo frutos para comer');
    if (this.isAdult()) {
      const prey = this.findPrey();
      if (prey) return this.setAction({ type: 'attack', targetId: prey.id, hunting: true }, 'caçando um cervo');
      const water = s.world.findNearest(this.x, this.y, 6, (i) => s.world.nearWater[i] === 1);
      if (water) return this.setAction({ type: 'fish', tx: water[0] + 0.5, ty: water[1] + 0.5, forTribe: false }, 'pescando');
    }
    if (this.memFood) return this.setAction({ type: 'forage', tx: this.memFood[0] + 0.5, ty: this.memFood[1] + 0.5, forTribe: false }, 'lembrou de um lugar com comida');
    this.explore('procurando comida');
  }

  findPrey() {
    const near = this.sim.nearby(this.x, this.y, this.vision());
    let best = null, bd = 1e9;
    for (const o of near) {
      if (o.species !== 'deer' || !o.alive) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  explore(thought) {
    const s = this.sim, w = s.world, r = s.rng;
    const ang = r() * Math.PI * 2;
    const dist = 10 + r() * 12;
    const spot = w.findNearest(this.x + Math.cos(ang) * dist, this.y + Math.sin(ang) * dist, 5, (i, x, y) => w.passable(x, y));
    if (spot) this.setAction({ type: 'wander', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, thought);
  }

  planSleep() {
    const home = this.homePos();
    const tribe = this.tribe;
    let tx = this.x, ty = this.y;
    if (home && Math.hypot(home.x - this.x, home.y - this.y) < 16) {
      const hut = tribe && tribe.huts.length ? tribe.huts[this.id % tribe.huts.length] : null;
      tx = hut ? hut.x + 0.5 : home.x + ((this.id % 5) - 2) * 0.5;
      ty = hut ? hut.y + 0.9 : home.y + (((this.id / 5) | 0) % 5 - 2) * 0.5;
    }
    this.setAction({ type: 'sleep', tx, ty }, 'indo dormir');
  }

  planGather() {
    const s = this.sim, w = s.world, tribe = this.tribe;
    if (this.carryFood >= CARRY_MAX) return this.setAction({ type: 'deliver' }, 'levando comida ao estoque');
    const nearHome = Math.hypot(tribe.home.x - this.x, tribe.home.y - this.y) < tribe.radius() + 6;
    const spot = w.findNearest(nearHome ? this.x : tribe.home.x, nearHome ? this.y : tribe.home.y, Math.round(tribe.radius() + 10), (i) => w.food[i] >= 1.2);
    if (spot) return this.setAction({ type: 'forage', tx: spot[0] + 0.5, ty: spot[1] + 0.5, forTribe: true }, w.terrain[w.idx(spot[0], spot[1])] === T.FARM ? 'colhendo na roça' : 'coletando comida para a tribo');
    const prey = this.findPrey();
    if (prey) return this.setAction({ type: 'attack', targetId: prey.id, hunting: true }, 'caçando para a tribo');
    const water = w.findNearest(tribe.home.x, tribe.home.y, 10, (i) => w.nearWater[i] === 1);
    if (water) return this.setAction({ type: 'fish', tx: water[0] + 0.5, ty: water[1] + 0.5, forTribe: true }, 'pescando para a tribo');
    this.explore('buscando terras férteis');
  }

  planHunt() {
    const prey = this.findPrey();
    if (prey) return this.setAction({ type: 'attack', targetId: prey.id, hunting: true }, 'caçando para a tribo');
    const tribe = this.tribe;
    // procura rastros de caça ao redor da aldeia
    const s = this.sim, r = s.rng, w = s.world;
    const ang = r() * Math.PI * 2, d = tribe.radius() + 6 + r() * 10;
    const spot = w.findNearest(tribe.home.x + Math.cos(ang) * d, tribe.home.y + Math.sin(ang) * d, 5, (i, x, y) => w.passable(x, y));
    if (spot) this.setAction({ type: 'wander', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, 'procurando rastros de caça');
  }

  planChop() {
    const w = this.sim.world;
    if (this.carryWood >= 3) return this.setAction({ type: 'deliver' }, 'levando madeira');
    const spot = w.findNearest(this.x, this.y, 18, (i) => w.wood[i] >= 1);
    if (!spot) return this.explore('procurando árvores');
    this.setAction({ type: 'chop', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, 'cortando lenha');
  }

  planBuild() {
    const s = this.sim, w = s.world, tribe = this.tribe, r = s.rng;
    const rad = 2 + Math.sqrt(tribe.huts.length) * 1.4;
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.floor(tribe.home.x + r.range(-rad, rad)), y = Math.floor(tribe.home.y + r.range(-rad, rad));
      if (!w.passable(x, y) || tribe.hutAt(x, y) || (Math.abs(x - tribe.home.x) < 1 && Math.abs(y - tribe.home.y) < 1)) continue;
      if (s.tribes.some((t) => t.alive && t.hutAt(x, y))) continue;
      tribe.builder = this.id;
      return this.setAction({ type: 'build', tx: x + 0.5, ty: y + 0.5, bx: x, by: y }, 'construindo uma cabana');
    }
    this.planChop();
  }

  planFarm() {
    const s = this.sim, w = s.world, tribe = this.tribe, r = s.rng;
    const rad = tribe.radius() + 1;
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.floor(tribe.home.x + r.range(-rad, rad)), y = Math.floor(tribe.home.y + r.range(-rad, rad));
      if (!w.inside(x, y)) continue;
      const t = w.tile(x, y);
      if ((t !== T.GRASS && t !== T.SAND && t !== T.HILLS) || s.tribes.some((tt) => tt.alive && tt.hutAt(x, y))) continue;
      if (Math.abs(x + 0.5 - tribe.home.x) < 1.5 && Math.abs(y + 0.5 - tribe.home.y) < 1.5) continue;
      return this.setAction({ type: 'farm', tx: x + 0.5, ty: y + 0.5, bx: x, by: y }, 'preparando uma roça');
    }
    this.planGather();
  }

  planRaid() {
    const s = this.sim;
    const enemy = s.tribeById(this.raid.enemy);
    if (!enemy || !enemy.alive || !s.atWar(this.tribe, enemy)) { this.raid = null; return this.planWander(); }
    this.setAction({ type: 'raid', tx: enemy.home.x, ty: enemy.home.y, enemy: enemy.id }, `marchando contra a ${enemy.name}`);
  }

  planJoin() {
    const s = this.sim;
    let best = null, bd = 1e9;
    for (const t of s.tribes) {
      if (!t.alive || t.race !== this.species) continue;
      const d = Math.hypot(t.home.x - this.x, t.home.y - this.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best && bd < 80) return this.setAction({ type: 'join', tribeId: best.id, tx: best.home.x, ty: best.home.y }, `buscando abrigo na ${best.name}`);
    // encontra outro errante para fundar uma tribo
    const near = s.nearby(this.x, this.y, this.vision() * 2);
    const mate = near.find((o) => o !== this && o.alive && o.species === this.species && !o.tribe && o.isAdult());
    if (mate) { s.foundTribe(this.species, [this, mate], this.x, this.y); return; }
    this.explore('vagando sem povo');
  }

  // ---------- execução ----------
  perform() {
    const a = this.action;
    if (!a) return;
    const s = this.sim, w = s.world;
    switch (a.type) {
      case 'wander': {
        if (this.goTo(a.tx, a.ty) !== 0 || s.tick - a.start > 400) this.done();
        break;
      }
      case 'flee': {
        this.sprinting = true;
        const st = this.goTo(a.tx, a.ty, 0.6);
        if (st !== 0 || s.tick - a.start > 60) this.done();
        break;
      }
      case 'drink': {
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) { this.memWater = null; return this.done(); }
        if (st === 1 && ++a.work >= 12) {
          this.thirst = 0;
          this.memWater = [a.tx | 0, a.ty | 0];
          this.done();
        }
        break;
      }
      case 'forage': {
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) return this.done();
        if (st === 1 && ++a.work >= 12) {
          const i = w.idx(a.tx | 0, a.ty | 0);
          const want = a.forTribe ? CARRY_MAX - this.carryFood : Math.max(0.5, Math.ceil(this.hunger / FOOD_VALUE));
          const take = Math.min(w.food[i], want, 2);
          w.food[i] -= take;
          if (take > 0.3) this.memFood = [a.tx | 0, a.ty | 0];
          if (a.forTribe) {
            this.carryFood += take;
            if (this.carryFood >= CARRY_MAX - 0.3) this.setAction({ type: 'deliver' }, 'levando comida ao estoque');
            else {
              const next = w.findNearest(this.x, this.y, 6, (j) => w.food[j] >= 1.2);
              if (next) this.setAction({ type: 'forage', tx: next[0] + 0.5, ty: next[1] + 0.5, forTribe: true }, this.thought);
              else this.setAction({ type: 'deliver' }, 'levando comida ao estoque');
            }
          } else {
            this.eat(take);
            this.done();
          }
        }
        break;
      }
      case 'fish': {
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) return this.done();
        if (st === 1 && ++a.work >= 45) {
          const skill = this.species === 'elf' ? 0.6 : this.species === 'human' ? 0.55 : 0.45;
          if (s.rng() < skill) {
            if (a.forTribe) this.carryFood += 1.5;
            else this.eat(1.5);
          }
          if (a.forTribe && this.carryFood < 3 && s.rng() < 0.6) a.work = 0;
          else this.done();
        }
        break;
      }
      case 'eatHome': {
        const t = this.tribe;
        if (!t) return this.done();
        const st = this.goTo(t.home.x, t.home.y, 1.5);
        if (st < 0) return this.done();
        if (st === 1) {
          const take = Math.min(t.food, Math.ceil(this.hunger / FOOD_VALUE));
          t.food -= take;
          this.eat(take);
          this.done();
        }
        break;
      }
      case 'deliver': {
        const t = this.tribe;
        if (!t) return this.done();
        const st = this.goTo(t.home.x, t.home.y, 1.5);
        if (st < 0) return this.done();
        if (st === 1) {
          t.food += this.carryFood;
          t.wood += this.carryWood;
          this.carryFood = 0;
          this.carryWood = 0;
          this.done();
        }
        break;
      }
      case 'chop': {
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) return this.done();
        if (st === 1 && ++a.work >= 35) {
          const i = w.idx(a.tx | 0, a.ty | 0);
          if (w.wood[i] >= 1) { w.wood[i] -= 1; this.carryWood += 1; }
          if (this.carryWood >= 3) this.setAction({ type: 'deliver' }, 'levando madeira');
          else this.done();
        }
        break;
      }
      case 'build': {
        const t = this.tribe;
        if (!t) return this.done();
        const st = this.goTo(a.tx, a.ty, 0.9);
        if (st < 0) { t.builder = null; return this.done(); }
        if (st === 1 && ++a.work >= 150) {
          t.builder = null;
          if (t.wood >= 6 && !t.hutAt(a.bx, a.by)) {
            t.wood -= 6;
            t.addHut(a.bx, a.by, this);
            this.fame += 0.5;
          }
          this.done();
        }
        break;
      }
      case 'farm': {
        const t = this.tribe;
        if (!t) return this.done();
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) return this.done();
        if (st === 1 && ++a.work >= 110) {
          const tt = w.tile(a.bx, a.by);
          if (tt !== T.FARM && tt !== T.RIVER && w.passable(a.bx, a.by) && t.wantsField()) {
            w.makeFarm(a.bx, a.by);
            t.fields.push({ x: a.bx, y: a.by });
            if (t.fields.length === 1) s.chronicle(2, `A ${t.name} plantou sua primeira roça.`, [this.id]);
          }
          this.done();
        }
        break;
      }
      case 'sleep': {
        if (!a.asleep) {
          const st = this.goTo(a.tx, a.ty, 0.6);
          if (st !== 0 || s.tick - a.start > 300) { a.asleep = true; this.thought = 'dormindo'; }
        } else if (this.energy >= 1 && !s.isNight()) this.done();
        else if (this.energy >= 1 && s.rng() < 0.01) this.done();
        break;
      }
      case 'attack': {
        const o = s.find(a.targetId);
        if (!o || !o.alive) return this.done();
        const reach = this.sapient ? (a.hunting || o.species === 'dragon' ? REACH[this.species] : Math.min(REACH[this.species], 1.6)) : this.sp.size + o.sp.size + 0.4;
        const st = this.chase(o, reach);
        if (st < 0 || s.tick - a.start > 500) return this.done();
        if (st === 1) this.attack(o, a.hunting);
        break;
      }
      case 'mate': {
        const o = s.find(a.targetId);
        if (!o || !o.alive || !o.canMate() || !this.canMate()) return this.done();
        const st = this.chase(o, 1.0);
        if (st < 0 || s.tick - a.start > 400) return this.done();
        if (st === 1 && ++a.work >= 25) {
          const f = this.sex === 'F' ? this : o;
          const m = f === this ? o : this;
          if (s.rng() < 0.55 * f.sp.fert * f.genes.fert + 0.15) f.conceive(m);
          else { this.lastBirth = s.tick - TICKS_PER_YEAR * 0.7; o.lastBirth = this.lastBirth; }
          this.done();
        }
        break;
      }
      case 'socialize': {
        const o = s.find(a.targetId);
        if (!o || !o.alive) return this.done();
        const st = this.chase(o, 1.2);
        if (st < 0 || s.tick - a.start > 300) return this.done();
        if (st === 1 && ++a.work >= 30) {
          const inc = 5 + 10 * this.soc() * s.rng();
          this.rel.set(o.id, Math.min(100, (this.rel.get(o.id) || 0) + inc));
          o.rel.set(this.id, Math.min(100, (o.rel.get(this.id) || 0) + inc * 0.8));
          if (o.tribe && this.tribe && o.tribe !== this.tribe) s.adjustRelation(o.tribe, this.tribe, 1.5);
          if (a.court && !this.partner && !o.partner && o.species === this.species && o.sex !== this.sex && o.isAdult() && this.rel.get(o.id) > 25 && (o.rel.get(this.id) || 0) > 15) {
            this.partner = o.id;
            o.partner = this.id;
            this.log(`Uniu-se a ${o.name}.`);
            o.log(`Uniu-se a ${this.name}.`);
            if (this.isLeader() || o.isLeader()) s.chronicle(1, `${this.name} e ${o.name} se uniram na ${this.tribe?.name}.`, [this.id, o.id]);
          }
          this.done();
        }
        break;
      }
      case 'raid': {
        const enemy = s.tribeById(a.enemy);
        if (!enemy || !enemy.alive || !this.raid || s.tick > this.raid.until) { this.raid = null; return this.done(); }
        const st = this.goTo(a.tx, a.ty, 2);
        if (st < 0) { this.raid = null; return this.done(); }
        if (st === 1) {
          const loot = Math.min(enemy.food, CARRY_MAX);
          enemy.food -= loot;
          this.carryFood += loot;
          if (enemy.huts.length && s.rng() < 0.35) {
            const hut = enemy.huts.pop();
            s.fx.push({ type: 'fire', x: hut.x + 0.5, y: hut.y + 0.5, t: s.tick });
            s.chronicle(2, `${this.name} da ${this.tribe.name} incendiou uma cabana da ${enemy.name}.`, [this.id]);
            s.adjustRelation(enemy, this.tribe, -8);
          }
          this.fame += 1;
          this.log(`Saqueou o acampamento da ${enemy.name}.`);
          this.raid = null;
          this.setAction({ type: 'deliver' }, 'voltando com o saque');
        }
        break;
      }
      case 'join': {
        const t = s.tribeById(a.tribeId);
        if (!t || !t.alive || this.tribe) return this.done();
        const st = this.goTo(a.tx, a.ty, 2);
        if (st < 0) return this.done();
        if (st === 1) {
          t.add(this);
          this.log(`Foi acolhido(a) pela ${t.name}.`);
          s.chronicle(1, `${this.name}, sem povo, foi acolhido(a) pela ${t.name}.`, [this.id]);
          this.done();
        }
        break;
      }
      case 'graze': {
        const st = this.goTo(a.tx, a.ty);
        if (st < 0) return this.done();
        if (st === 1 && ++a.work >= 20) {
          const i = w.idx(a.tx | 0, a.ty | 0);
          const take = Math.min(w.food[i], 1.2);
          w.food[i] -= take;
          this.hunger = Math.max(0, this.hunger - take * 0.45);
          this.done();
        }
        break;
      }
      case 'lair': {
        const st = this.goTo(a.tx, a.ty, 0.6);
        if (st !== 0) {
          this.sleepUntil = s.tick + Math.round(s.rng.range(6, 12) * TICKS_PER_YEAR);
          this.hunger = 0;
          s.chronicle(2, `O dragão ${this.name} voltou ao seu covil para dormir.`, [this.id]);
          this.done();
        }
        break;
      }
    }
  }

  // ---------- animais ----------
  decideDeer() {
    const s = this.sim, w = s.world, r = s.rng;
    const near = s.nearby(this.x, this.y, this.vision());
    let danger = null, dd = 1e9;
    for (const o of near) {
      if (o === this || !o.alive) continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      let scary = false;
      if (o.species === 'wolf' || o.species === 'dragon') scary = d < this.vision() * 0.8;
      else if (o.sapient) scary = d < 5 && (o.action?.type === 'attack' ? r() < 0.7 : r() < 0.3);
      if (this.lastAttacker === o.id && s.tick - this.lastHitT < 100) scary = true;
      if (scary && d < dd) { dd = d; danger = o; }
    }
    if (danger) return this.flee(danger);
    if (this.thirst > 0.5) return this.planDrink();
    if (this.hunger > 0.35) {
      const spot = this.findFoodTile(0.5);
      if (spot) return this.setAction({ type: 'graze', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, 'pastando');
      return this.explore('procurando pasto');
    }
    // reprodução na primavera
    if (s.season === 0 && this.sex === 'F' && this.canMate()) {
      let males = 0, herd = 0, male = null;
      for (const o of s.nearby(this.x, this.y, 16)) {
        if (o.species !== 'deer' || !o.alive) continue;
        herd++;
        if (o.sex === 'M' && o.isAdult()) { males++; male = o; }
      }
      if (male && herd < 16 && s.countOf('deer') < 350) { this.conceive(male); this.thought = 'prenhe'; }
    }
    // manter a manada unida
    let cx = 0, cy = 0, n = 0;
    for (const o of near) if (o.species === 'deer' && o !== this) { cx += o.x; cy += o.y; n++; }
    if (n && r() < 0.6) {
      const spot = w.findNearest(cx / n + r.range(-3, 3), cy / n + r.range(-3, 3), 3, (i, x, y) => w.passable(x, y));
      if (spot) return this.setAction({ type: 'wander', tx: spot[0] + 0.5, ty: spot[1] + 0.5 }, 'seguindo a manada');
    }
    this.planWander();
  }

  decideWolf() {
    const s = this.sim, w = s.world, r = s.rng;
    const near = s.nearby(this.x, this.y, this.hunger > 0.4 ? this.vision() * 2.2 : this.vision());
    // perigo: dragão ou grupos armados
    let threat = null, allies = 0, hostile = 0;
    for (const o of near) {
      if (o === this || !o.alive) continue;
      if (o.species === 'wolf') allies++;
      if (o.species === 'dragon') threat = o;
      if (o.sapient && o.isAdult()) hostile++;
    }
    if (threat || (this.hp < this.maxHp() * 0.35 && this.lastAttacker)) {
      const src = threat || s.find(this.lastAttacker);
      if (src) return this.flee(src);
    }
    if (this.lastAttacker && s.tick - this.lastHitT < 100) {
      const src = s.find(this.lastAttacker);
      if (src && src.alive && hostile <= allies + 1) return this.setAction({ type: 'attack', targetId: src.id, hunting: false }, 'revidando');
      if (src) return this.flee(src);
    }
    if (this.action?.type === 'attack' && s.tick - this.action.start < 200) return;
    if (this.thirst > 0.5) return this.planDrink();
    if (this.hunger > 0.4) {
      let prey = null, bs = -1e9;
      for (const o of near) {
        if (!o.alive || o === this) continue;
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        let sc = -1e9;
        if (o.species === 'deer') sc = 10 - d;
        else if (o.sapient && this.hunger > 0.7) {
          // humanoides só quando estão sozinhos ou são fracos
          const guards = s.nearby(o.x, o.y, 4).filter((q) => q.sapient && q.isAdult() && q !== o).length;
          if (guards <= allies && (!o.isAdult() || o.hp < o.maxHp() * 0.5 || allies >= 2)) sc = 4 - d;
        }
        if (sc > bs) { bs = sc; prey = o; }
      }
      if (prey && bs > -1e8) return this.setAction({ type: 'attack', targetId: prey.id, hunting: true }, prey.sapient ? `caçando ${prey.name}` : 'caçando');
      return this.explore('farejando presas');
    }
    if (s.season === 0 && this.sex === 'F' && this.canMate() && s.countOf('wolf') < Math.max(6, s.countOf('deer') / 6)) {
      const male = near.find((o) => o.species === 'wolf' && o.alive && o.sex === 'M' && o.isAdult());
      if (male) { this.conceive(male); this.thought = 'prenhe'; }
    }
    // alcateia se mantém perto da toca
    if (this.home && Math.hypot(this.home.x - this.x, this.home.y - this.y) > 14) {
      return this.setAction({ type: 'wander', tx: this.home.x, ty: this.home.y }, 'voltando à toca');
    }
    this.planWander();
  }

  decideDragon() {
    const s = this.sim, r = s.rng;
    if (s.tick < this.sleepUntil) return;
    if (!this.wokeAt || this.wokeAt < this.sleepUntil) {
      this.wokeAt = s.tick;
      this.hunger = 0.8;
      s.chronicle(3, `O dragão ${this.name} despertou faminto!`, [this.id]);
    }
    const tired = s.tick - this.wokeAt > TICKS_PER_YEAR * 0.4;
    if (this.hp < this.maxHp() * 0.3 || this.hunger < 0.2 || tired) {
      if (this.action?.type !== 'lair') this.setAction({ type: 'lair', tx: this.home.x, ty: this.home.y }, 'voltando ao covil');
      return;
    }
    if (this.lastAttacker && s.tick - this.lastHitT < 120) {
      const src = s.find(this.lastAttacker);
      if (src && src.alive) return this.setAction({ type: 'attack', targetId: src.id, hunting: false }, `atacando ${src.name}`);
    }
    if (this.action?.type === 'attack' && s.tick - this.action.start < 200) return;
    const near = s.nearby(this.x, this.y, this.vision());
    let prey = null, bd = 1e9;
    for (const o of near) {
      if (o === this || !o.alive || o.species === 'dragon') continue;
      const d = Math.hypot(o.x - this.x, o.y - this.y) - (o.species === 'deer' ? 8 : 0);
      if (d < bd) { bd = d; prey = o; }
    }
    if (prey) return this.setAction({ type: 'attack', targetId: prey.id, hunting: true }, prey.sapient ? `caçando ${prey.name}` : 'caçando');
    if (this.action?.type === 'wander' && this.action.raid) return;
    // voa até um assentamento
    const targets = s.tribes.filter((t) => t.alive);
    if (targets.length && r() < 0.6) {
      const t = r.pick(targets);
      s.chronicle(2, `O dragão ${this.name} foi visto voando em direção à ${t.name}!`, [this.id]);
      return this.setAction({ type: 'wander', tx: t.home.x, ty: t.home.y, raid: true }, `sobrevoando a ${t.name}`);
    }
    this.explore('rondando os céus');
  }

  // queimar cabanas ao sobrevoar
  dragonBurn() {
    const s = this.sim;
    for (const t of s.tribes) {
      if (!t.alive) continue;
      for (let i = t.huts.length - 1; i >= 0; i--) {
        const h = t.huts[i];
        if (Math.hypot(h.x + 0.5 - this.x, h.y + 0.5 - this.y) < 1.5 && s.rng() < 0.02) {
          t.huts.splice(i, 1);
          s.fx.push({ type: 'fire', x: h.x + 0.5, y: h.y + 0.5, t: s.tick });
          s.chronicle(2, `O dragão ${this.name} incendiou uma cabana da ${t.name}.`, [this.id]);
        }
      }
    }
  }
}

export { mixGenes };
