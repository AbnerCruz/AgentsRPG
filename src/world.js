// Terreno, recursos naturais e caminhos.
import { makeNoise } from './rng.js';
import { T, TERRAIN, SEASON_GROWTH } from './data.js';

export class World {
  constructor(W, H, seed) {
    this.W = W;
    this.H = H;
    const n = W * H;
    this.terrain = new Uint8Array(n);
    this.elev = new Float32Array(n);
    this.food = new Float32Array(n);
    this.foodCap = new Float32Array(n);
    this.wood = new Float32Array(n);
    this.nearWater = new Uint8Array(n);
    this.shade = new Float32Array(n);
    this.generate(seed);
    this.labelRegions();
    // estruturas do A*
    this._g = new Float32Array(n);
    this._from = new Int32Array(n);
    this._stamp = new Uint32Array(n);
    this._closed = new Uint32Array(n);
    this._gen = 0;
  }

  idx(x, y) { return y * this.W + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  tile(x, y) { return this.inside(x, y) ? this.terrain[y * this.W + x] : T.DEEP; }
  passable(x, y) { return this.inside(x, y) && TERRAIN[this.terrain[y * this.W + x]].passable; }
  cost(x, y) { return TERRAIN[this.tile(x, y)].cost; }

  generate(seed) {
    const { W, H } = this;
    const ne = makeNoise(seed * 7 + 1);
    const nm = makeNoise(seed * 13 + 5);
    const nd = makeNoise(seed * 3 + 9);
    const moist = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const dx = (x / W) * 2 - 1, dy = (y / H) * 2 - 1;
        const edge = Math.max(Math.abs(dx), Math.abs(dy));
        const fall = Math.pow(Math.max(0, edge - 0.55) / 0.45, 2);
        this.elev[i] = ne.fbm(x / 38, y / 38, 5) - fall * 0.45 + 0.08 * nd.value(x / 9, y / 9);
        moist[i] = nm.fbm(x / 30, y / 30, 4);
        this.shade[i] = nd.value(x * 0.9, y * 0.9);
      }
    }
    const pct = (arr, p) => {
      const s = Array.from(arr).sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * p))];
    };
    const eDeep = pct(this.elev, 0.14), eWater = pct(this.elev, 0.24), eSand = pct(this.elev, 0.28);
    const eHills = pct(this.elev, 0.86), eMount = pct(this.elev, 0.95);
    const mForest = pct(moist, 0.62), mDesert = pct(moist, 0.1);
    for (let i = 0; i < W * H; i++) {
      const e = this.elev[i], m = moist[i];
      let t;
      if (e < eDeep) t = T.DEEP;
      else if (e < eWater) t = T.WATER;
      else if (e < eSand) t = T.SAND;
      else if (e > eMount) t = T.MOUNTAIN;
      else if (e > eHills) t = T.HILLS;
      else if (m > mForest) t = T.FOREST;
      else if (m < mDesert) t = T.SAND;
      else t = T.GRASS;
      this.terrain[i] = t;
    }
    this.carveRivers(seed, eHills);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const t = this.terrain[i];
        this.foodCap[i] = TERRAIN[t].foodCap * (0.7 + 0.6 * this.shade[i]);
        this.food[i] = this.foodCap[i] * 0.8;
        if (t === T.FOREST) this.wood[i] = 6 + 6 * this.shade[i];
        if (t === T.RIVER) this.nearWater[i] = 1;
        else if (TERRAIN[t].passable) {
          for (let k = 0; k < 8; k++) {
            const tt = this.tile(x + DIRS[k][0], y + DIRS[k][1]);
            if (tt === T.WATER || tt === T.DEEP || tt === T.RIVER) { this.nearWater[i] = 1; break; }
          }
        }
      }
    }
  }

  // Rios nascem nas terras altas e descem pelo relevo até o mar ou formam lagos.
  carveRivers(seed, eHigh) {
    const { W, H } = this;
    let st = (seed * 2654435761) >>> 0;
    const rnd = () => { st = (Math.imul(st ^ (st >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return st / 4294967296; };
    const count = Math.round((W * H) / 1400);
    let made = 0;
    for (let tries = 0; tries < count * 30 && made < count; tries++) {
      let x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      const i0 = y * W + x;
      if (this.elev[i0] < eHigh * 0.92 || this.terrain[i0] === T.MOUNTAIN || this.terrain[i0] === T.RIVER) continue;
      const course = [];
      const seen = new Set();
      let ok = false;
      for (let step = 0; step < 500; step++) {
        const i = y * W + x;
        seen.add(i);
        course.push(i);
        let best = -1, be = Infinity;
        for (let k = 0; k < 4; k++) {
          const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
          if (!this.inside(nx, ny)) continue;
          const ni = ny * W + nx;
          if (seen.has(ni)) continue;
          const tt = this.terrain[ni];
          if (tt === T.WATER || tt === T.DEEP || tt === T.RIVER) { ok = true; best = -2; break; }
          const e = this.elev[ni] + rnd() * 0.012;
          if (tt !== T.MOUNTAIN && e < be) { be = e; best = ni; }
        }
        if (best === -2) break;
        if (best < 0) break;
        if (be > this.elev[i] + 0.02) { // poço: vira lago
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (dx * dx + dy * dy > 5 || !this.inside(x + dx, y + dy)) continue;
            const li = (y + dy) * W + x + dx;
            if (this.terrain[li] !== T.MOUNTAIN) this.terrain[li] = T.WATER;
          }
          ok = true;
          break;
        }
        x = best % W; y = (best / W) | 0;
      }
      if (!ok || course.length < 8) continue;
      for (const i of course) if (this.terrain[i] !== T.WATER) this.terrain[i] = T.RIVER;
      made++;
    }
    this.rivers = made;
  }

  // Rotula áreas conectadas por terra: alvos em outra região são inalcançáveis.
  labelRegions() {
    const { W, H } = this;
    this.region = new Int32Array(W * H);
    const stack = [];
    let label = 0;
    for (let i = 0; i < W * H; i++) {
      if (this.region[i] || !TERRAIN[this.terrain[i]].passable) continue;
      label++;
      this.region[i] = label;
      stack.push(i);
      while (stack.length) {
        const c = stack.pop();
        const cx = c % W, cy = (c / W) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
          if (!this.passable(nx, ny)) continue;
          const ni = ny * W + nx;
          if (this.region[ni]) continue;
          this.region[ni] = label;
          stack.push(ni);
        }
      }
    }
  }
  makeFarm(x, y) {
    const i = this.idx(x, y);
    this.terrain[i] = T.FARM;
    this.foodCap[i] = TERRAIN[T.FARM].foodCap;
    this.food[i] = Math.min(this.food[i], 0.5);
    this.wood[i] = 0;
  }

  regionAt(x, y) { return this.inside(x | 0, y | 0) ? this.region[(y | 0) * this.W + (x | 0)] : 0; }

  // Chamado periodicamente: vegetação e árvores voltam a crescer conforme a estação.
  regrow(season, dtTicks) {
    const g = SEASON_GROWTH[season] * dtTicks / 800;
    const n = this.W * this.H;
    for (let i = 0; i < n; i++) {
      const cap = this.foodCap[i];
      if (cap <= 0) continue;
      const f = this.food[i];
      if (f < cap) this.food[i] = Math.min(cap, f + cap * g * (0.15 + f / cap));
      if (this.terrain[i] === T.FOREST && this.wood[i] < 12) this.wood[i] += dtTicks / 4000;
    }
  }

  // Procura em espiral o tile mais próximo que satisfaz o predicado.
  // Por padrão só aceita tiles da mesma região conectada da origem.
  findNearest(x0, y0, radius, pred, sameRegion = true) {
    x0 |= 0; y0 |= 0;
    const reg = sameRegion ? this.regionAt(x0, y0) : 0;
    if (reg) { const p0 = pred; pred = (i, x, y) => this.region[i] === reg && p0(i, x, y); }
    if (this.inside(x0, y0) && pred(this.idx(x0, y0), x0, y0)) return [x0, y0];
    for (let r = 1; r <= radius; r++) {
      let best = null, bestD = 1e9;
      for (let dy = -r; dy <= r; dy++) {
        const step = (dy === -r || dy === r) ? 1 : 2 * r;
        for (let dx = -r; dx <= r; dx += step) {
          const x = x0 + dx, y = y0 + dy;
          if (!this.inside(x, y)) continue;
          if (!pred(this.idx(x, y), x, y)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = [x, y]; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.35);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.passable(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  }

  // A* em grade 8-direções, sem cortar quinas. Retorna lista de centros de tile ou null.
  findPath(sx, sy, tx, ty, limit = 9000) {
    const { W } = this;
    if (!this.passable(tx, ty)) return null;
    const rs = this.region[sy * W + sx];
    if (rs && rs !== this.region[ty * W + tx]) return null;
    if (sx === tx && sy === ty) return [[tx + 0.5, ty + 0.5]];
    const gen = ++this._gen;
    const g = this._g, from = this._from, stamp = this._stamp, closed = this._closed;
    const heap = new Heap();
    const s = sy * W + sx, goal = ty * W + tx;
    g[s] = 0; stamp[s] = gen; from[s] = -1;
    heap.push(s, octile(sx, sy, tx, ty));
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal) break;
      if (++expanded > limit) return null;
      const cx = cur % W, cy = (cur / W) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (!this.passable(nx, ny)) continue;
        if (k >= 4 && (!this.passable(cx + DIRS[k][0], cy) || !this.passable(cx, cy + DIRS[k][1]))) continue;
        const ni = ny * W + nx;
        if (closed[ni] === gen) continue;
        const ng = g[cur] + (k >= 4 ? 1.414 : 1) * TERRAIN[this.terrain[ni]].cost;
        if (stamp[ni] !== gen || ng < g[ni]) {
          stamp[ni] = gen; g[ni] = ng; from[ni] = cur;
          heap.push(ni, ng + octile(nx, ny, tx, ty));
        }
      }
    }
    if (closed[goal] !== gen) return null;
    const path = [];
    for (let c = goal; c !== -1 && c !== s; c = from[c]) path.push([(c % W) + 0.5, ((c / W) | 0) + 0.5]);
    path.reverse();
    return path;
  }
}

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
}

class Heap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    let i = k.length;
    k.push(key); p.push(pri);
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= pri) break;
      k[i] = k[par]; p[i] = p[par]; i = par;
    }
    k[i] = key; p[i] = pri;
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && p[c + 1] < p[c]) c++;
        if (p[c] >= lp) break;
        k[i] = k[c]; p[i] = p[c]; i = c;
      }
      k[i] = lk; p[i] = lp;
    }
    return top;
  }
}
