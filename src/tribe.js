// Tribos: lar, estoque, cabanas, liderança e relações com outros povos.
import { SPECIES, makeTribeName, TICKS_PER_YEAR } from './data.js';

export class Tribe {
  constructor(sim, race, x, y) {
    this.sim = sim;
    this.id = sim.nextTribeId++;
    this.race = race;
    this.name = makeTribeName(sim.rng, race);
    this.color = sim.pickTribeColor();
    this.home = { x, y };
    this.food = 25;
    this.wood = 0;
    this.huts = [];
    this.fields = [];
    this.members = new Set();
    this.leader = null;
    this.relations = new Map();
    this.founded = sim.tick;
    this.alive = true;
    this.famineDays = 0;
    this.lastMigration = -1e9;
    this.builder = null;
    this.births = 0;
    this.deaths = 0;
    this.peak = 0;
  }

  get sp() { return SPECIES[this.race]; }
  radius() { return 6 + Math.sqrt(this.huts.length) * 2.5; }
  capacity() { return 8 + this.huts.length * this.sp.hutsPer; }
  wantsField() { return this.huts.length > 0 && this.fields.length < this.huts.length * this.sp.farmsPerHut; }
  wantsHut() { return this.members.size + 2 > this.capacity() && this.huts.length < 40; }
  hutAt(x, y) { return this.huts.some((h) => h.x === x && h.y === y); }
  builderActive() {
    if (!this.builder) return false;
    const b = this.sim.find(this.builder);
    if (b && b.alive && b.action?.type === 'build') return true;
    this.builder = null;
    return false;
  }

  add(c) {
    if (c.tribe && c.tribe !== this) c.tribe.remove(c);
    c.tribe = this;
    this.members.add(c);
    if (this.members.size > this.peak) this.peak = this.members.size;
  }
  remove(c) {
    this.members.delete(c);
    if (c.tribe === this) c.tribe = null;
    if (this.leader === c) this.leader = null;
  }

  addHut(x, y, builder) {
    this.huts.push({ x, y, built: this.sim.tick });
    const n = this.huts.length;
    if (n === 1) this.sim.chronicle(2, `A ${this.name} ergueu sua primeira cabana.`, builder ? [builder.id] : []);
    else if (n % 5 === 0) this.sim.chronicle(2, `A ${this.name} já é uma aldeia de ${n} cabanas.`, []);
    if (builder) builder.log(`Construiu uma cabana para a ${this.name}.`);
  }

  chooseLeader() {
    let best = null, bs = -1e9;
    for (const c of this.members) {
      if (!c.isAdult()) continue;
      const sc = c.fame * 2 + c.strength() * 1.5 + c.soc() * 6 + c.ageYears() / c.sp.adult * 2;
      if (sc > bs) { bs = sc; best = c; }
    }
    if (best && best !== this.leader) {
      const old = this.leader;
      this.leader = best;
      best.fame += 2;
      best.log(`Tornou-se líder da ${this.name}.`);
      this.sim.chronicle(2, `${best.fullName()} tornou-se líder da ${this.name}${old ? '' : ''}.`, [best.id]);
    }
  }

  // Divide o trabalho conforme as necessidades da tribo.
  assignRoles() {
    const adults = [...this.members].filter((c) => c.isAdult());
    if (!adults.length) return;
    adults.sort((a, b) => b.strength() * (0.5 + b.agg()) - a.strength() * (0.5 + a.agg()));
    const n = adults.length;
    const want = [];
    const hunters = this.race === 'orc' ? Math.ceil(n / 4) : Math.floor(n / 6);
    for (let i = 0; i < hunters; i++) want.push('caçador');
    if (this.wantsHut()) for (let i = 0; i < Math.max(1, Math.round(n / 6)); i++) want.push('lenhador');
    if (this.wantsField()) for (let i = 0; i < Math.max(1, Math.round(n / 8)); i++) want.push('agricultor');
    for (let i = 0; i < n; i++) {
      const c = adults[i];
      const role = i < want.length ? want[i] : 'coletor';
      if (c.role !== role) c.role = role;
    }
  }

  adults() { let n = 0; for (const c of this.members) if (c.isAdult()) n++; return n; }

  daily() {
    const s = this.sim;
    if (!this.alive) return;
    if (this.members.size === 0) {
      this.alive = false;
      this.died = s.tick;
      s.chronicle(3, `A ${this.name} desapareceu da face do mundo.`, []);
      return;
    }
    if (this.members.size === 1) {
      const last = [...this.members][0];
      if (last.isAdult()) {
        this.remove(last);
        this.alive = false;
        this.died = s.tick;
        last.log(`Último sobrevivente da ${this.name}, partiu sem povo.`);
        s.chronicle(3, `${last.name} é o último da ${this.name}, que deixa de existir.`, [last.id]);
        return;
      }
    }
    if (!this.leader || !this.leader.alive || this.leader.tribe !== this) this.chooseLeader();
    else if (s.rng() < 0.02) this.chooseLeader();

    this.assignRoles();
    this.food *= 0.994;
    this.food = Math.min(this.food, this.members.size * 14 + 20);
    this.wood = Math.min(this.wood, 40);

    // fome prolongada leva à migração
    let hungry = 0;
    for (const c of this.members) if (c.hunger > 0.7) hungry++;
    if (this.food < 1 && hungry > this.members.size * 0.4) this.famineDays++;
    else this.famineDays = Math.max(0, this.famineDays - 1);
    if (this.famineDays >= 4 && s.tick - this.lastMigration > TICKS_PER_YEAR * 2) this.migrate();

    // cisma: tribos grandes demais se dividem
    if (this.members.size >= 28 && s.rng() < 0.03) this.schism();
  }

  migrate() {
    const s = this.sim;
    const site = s.findSite(this.race, this.home.x, this.home.y, 45, this);
    if (!site) return;
    this.famineDays = 0;
    this.lastMigration = s.tick;
    const lost = this.huts.length;
    this.huts = [];
    this.fields = [];
    this.home = { x: site[0] + 0.5, y: site[1] + 0.5 };
    s.chronicle(2, `Assolada pela fome, a ${this.name} abandonou ${lost ? lost + ' cabanas' : 'seu acampamento'} e migrou em busca de terras férteis.`, this.leader ? [this.leader.id] : []);
    for (const c of this.members) { c.log('Migrou com seu povo para novas terras.'); c.action = null; c.needDecide = true; }
  }

  schism() {
    const s = this.sim;
    const cands = [...this.members].filter((c) => c.isAdult() && c !== this.leader);
    if (cands.length < 6) return;
    cands.sort((a, b) => (b.fame + b.soc() * 5 + b.agg() * 3) - (a.fame + a.soc() * 5 + a.agg() * 3));
    const founder = cands[0];
    const site = s.findSite(this.race, this.home.x, this.home.y, 50, this, 22);
    if (!site) return;
    const nt = new Tribe(s, this.race, site[0] + 0.5, site[1] + 0.5);
    s.tribes.push(nt);
    const share = Math.floor(this.members.size * 0.4);
    const followers = [founder];
    // seguem o fundador: parceiro, filhos e quem gosta dele
    const pool = [...this.members].filter((c) => c !== founder && c !== this.leader);
    pool.sort((a, b) => score(b) - score(a));
    function score(c) {
      let v = c.rel.get(founder.id) || 0;
      if (founder.partner === c.id) v += 200;
      if (c.mother === founder.id || c.father === founder.id) v += 150;
      return v;
    }
    for (const c of pool) {
      if (followers.length >= share) break;
      followers.push(c);
    }
    // filhos acompanham as mães
    for (const c of [...this.members]) {
      if (!c.isAdult() && followers.some((f) => f.id === c.mother) && !followers.includes(c)) followers.push(c);
    }
    for (const c of followers) {
      nt.add(c);
      c.action = null;
      c.needDecide = true;
      c.log(`Partiu com ${founder.name} para fundar a ${nt.name}.`);
    }
    const give = this.food * 0.35;
    this.food -= give;
    nt.food = give;
    nt.leader = founder;
    founder.fame += 3;
    const rel = s.relation(this, nt);
    s.setRelation(this, nt, founder.agg() > 0.6 ? -30 : 10 + rel * 0);
    s.chronicle(3, `Cisma! ${founder.fullName()} rompeu com a ${this.name} e partiu com ${followers.length} seguidores para fundar a ${nt.name}.`, [founder.id]);
  }
}
