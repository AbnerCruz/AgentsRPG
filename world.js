// world.js — o cenário 2D topdown. O site gera e desenha o mapa; os agentes apenas
// consomem (se localizam, enxergam, se movem). Nenhum agente desenha nada.

export const TILE = { FLOOR: 0, WALL: 1, DOOR: 2, WATER: 3, TREE: 4 };

export class World {
  constructor({ cols = 42, rows = 30 } = {}) {
    this.cols = cols; this.rows = rows;
    this.tiles = new Array(cols * rows).fill(TILE.WALL);
    this.tokens = [];
    this.tipo = 'masmorra';
    this.nome = 'Cenário';
    this.explored = new Set(); // tiles já vistos pelo grupo (névoa de guerra)
  }

  idx(x, y) { return y * this.cols + x; }
  at(x, y) { return (x < 0 || y < 0 || x >= this.cols || y >= this.rows) ? TILE.WALL : this.tiles[this.idx(x, y)]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.tiles[this.idx(x, y)] = t; }
  blocks(x, y) { const t = this.at(x, y); return t === TILE.WALL || t === TILE.TREE; }
  walkable(x, y) { const t = this.at(x, y); return t === TILE.FLOOR || t === TILE.DOOR; }

  // --- Geração procedural. O tipo vem do mestre (IA pede "masmorra"/"floresta"/"vila"),
  // mas o desenho é feito aqui, de graça, sem gastar tokens.
  static generate(tipo = 'masmorra', { cols = 42, rows = 30 } = {}) {
    const w = new World({ cols, rows });
    w.tipo = tipo;
    if (tipo === 'floresta') w._genFloresta();
    else if (tipo === 'vila' || tipo === 'cidade') w._genVila();
    else if (tipo === 'caverna') w._genCaverna();
    else w._genMasmorra();
    return w;
  }

  _genMasmorra() {
    const rooms = [];
    const tries = 40;
    for (let i = 0; i < tries && rooms.length < 9; i++) {
      const rw = 4 + Math.floor(Math.random() * 7);
      const rh = 3 + Math.floor(Math.random() * 5);
      const rx = 1 + Math.floor(Math.random() * (this.cols - rw - 2));
      const ry = 1 + Math.floor(Math.random() * (this.rows - rh - 2));
      const r = { x: rx, y: ry, w: rw, h: rh };
      if (rooms.some(o => rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y)) continue;
      rooms.push(r);
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) this.set(x, y, TILE.FLOOR);
    }
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      const ax = Math.floor(a.x + a.w / 2), ay = Math.floor(a.y + a.h / 2);
      const bx = Math.floor(b.x + b.w / 2), by = Math.floor(b.y + b.h / 2);
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) this.set(x, ay, TILE.FLOOR);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) this.set(bx, y, TILE.FLOOR);
    }
    this.rooms = rooms;
    this.spawn = rooms[0] ? { x: Math.floor(rooms[0].x + rooms[0].w / 2), y: Math.floor(rooms[0].y + rooms[0].h / 2) } : { x: 2, y: 2 };
  }

  _genCaverna() {
    for (let i = 0; i < this.tiles.length; i++) this.tiles[i] = Math.random() < 0.45 ? TILE.WALL : TILE.FLOOR;
    for (let pass = 0; pass < 4; pass++) {
      const next = [...this.tiles];
      for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) if (this.at(x + dx, y + dy) === TILE.WALL) walls++;
        next[this.idx(x, y)] = walls >= 5 ? TILE.WALL : TILE.FLOOR;
      }
      this.tiles = next;
    }
    for (let x = 0; x < this.cols; x++) { this.set(x, 0, TILE.WALL); this.set(x, this.rows - 1, TILE.WALL); }
    for (let y = 0; y < this.rows; y++) { this.set(0, y, TILE.WALL); this.set(this.cols - 1, y, TILE.WALL); }
    this.spawn = this._firstFloor();
  }

  _genFloresta() {
    this.tiles.fill(TILE.FLOOR);
    for (let i = 0; i < this.cols * this.rows * 0.18; i++) {
      this.set(Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows), TILE.TREE);
    }
    const ry = Math.floor(this.rows / 2) + Math.floor(Math.random() * 4 - 2);
    for (let x = 0; x < this.cols; x++) { this.set(x, ry, TILE.FLOOR); this.set(x, ry + 1, TILE.FLOOR); }
    for (let i = 0; i < 3; i++) {
      const cx = 5 + Math.floor(Math.random() * (this.cols - 10)), cy = 3 + Math.floor(Math.random() * (this.rows - 6));
      for (let y = cy; y < cy + 3; y++) for (let x = cx; x < cx + 4; x++) this.set(x, y, TILE.WATER);
    }
    this.spawn = { x: 2, y: ry };
  }

  _genVila() {
    this.tiles.fill(TILE.FLOOR);
    for (let i = 0; i < 7; i++) {
      const bw = 4 + Math.floor(Math.random() * 4), bh = 3 + Math.floor(Math.random() * 3);
      const bx = 2 + Math.floor(Math.random() * (this.cols - bw - 4)), by = 2 + Math.floor(Math.random() * (this.rows - bh - 4));
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
        const edge = (x === bx || x === bx + bw - 1 || y === by || y === by + bh - 1);
        this.set(x, y, edge ? TILE.WALL : TILE.FLOOR);
      }
      this.set(bx + Math.floor(bw / 2), by + bh - 1, TILE.DOOR);
    }
    this.spawn = { x: Math.floor(this.cols / 2), y: this.rows - 3 };
  }

  _firstFloor() {
    for (let y = 1; y < this.rows - 1; y++) for (let x = 1; x < this.cols - 1; x++) if (this.walkable(x, y)) return { x, y };
    return { x: 1, y: 1 };
  }

  freeSpotNear(x, y, radius = 6) {
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.walkable(nx, ny) && !this.tokens.some(t => t.x === nx && t.y === ny)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  addToken(tok) {
    const spot = this.freeSpotNear(tok.x ?? this.spawn.x, tok.y ?? this.spawn.y);
    const t = { id: tok.id, name: tok.name, kind: tok.kind || 'pc', color: tok.color || '#c99a3b', visionRadius: tok.visionRadius || 8, ...spot };
    this.tokens.push(t);
    return t;
  }

  tokenOf(id) { return this.tokens.find(t => t.id === id); }

  moveToken(id, x, y) {
    const t = this.tokenOf(id);
    if (!t) return { ok: false, reason: 'token inexistente' };
    if (!this.walkable(x, y)) return { ok: false, reason: 'destino bloqueado' };
    if (this.tokens.some(o => o.id !== id && o.x === x && o.y === y)) return { ok: false, reason: 'casa ocupada' };
    t.x = x; t.y = y;
    return { ok: true };
  }

  // --- Campo de visão (raycast simples, bloqueado por paredes/árvores) ---
  fov(token) {
    const seen = new Set();
    const R = token.visionRadius;
    for (let a = 0; a < 360; a += 2) {
      const rad = a * Math.PI / 180;
      const dx = Math.cos(rad), dy = Math.sin(rad);
      let px = token.x + 0.5, py = token.y + 0.5;
      for (let step = 0; step < R * 2; step++) {
        px += dx * 0.5; py += dy * 0.5;
        const cx = Math.floor(px), cy = Math.floor(py);
        if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) break;
        const dist = Math.hypot(cx - token.x, cy - token.y);
        if (dist > R) break;
        seen.add(`${cx},${cy}`);
        if (this.blocks(cx, cy)) break;
      }
    }
    seen.add(`${token.x},${token.y}`);
    return seen;
  }

  // Descrição textual do que um agente enxerga — é ISTO que vai no prompt dele.
  describeVision(tokenId) {
    const t = this.tokenOf(tokenId);
    if (!t) return 'Você não está posicionado no mapa.';
    const seen = this.fov(t);
    const others = this.tokens.filter(o => o.id !== tokenId && seen.has(`${o.x},${o.y}`));
    const bearing = (o) => {
      const dx = o.x - t.x, dy = o.y - t.y;
      const dist = Math.round(Math.hypot(dx, dy));
      const dir = [
        Math.abs(dy) > Math.abs(dx) * 0.5 ? (dy < 0 ? 'norte' : 'sul') : '',
        Math.abs(dx) > Math.abs(dy) * 0.5 ? (dx < 0 ? 'oeste' : 'leste') : '',
      ].filter(Boolean).join('-') || 'ao lado';
      return `${o.name} (${dist} casas a ${dir})`;
    };
    let exits = [];
    for (const [dx, dy, nome] of [[0, -1, 'norte'], [0, 1, 'sul'], [-1, 0, 'oeste'], [1, 0, 'leste']]) {
      let d = 0;
      while (d < t.visionRadius && this.walkable(t.x + dx * (d + 1), t.y + dy * (d + 1))) d++;
      if (d >= 2) exits.push(`${nome} (${d} casas livres)`);
    }
    const terreno = { masmorra: 'corredores de pedra', caverna: 'rocha úmida', floresta: 'mata fechada', vila: 'ruas de terra batida', cidade: 'ruas de terra batida' }[this.tipo] || 'terreno aberto';
    return [
      `Posição: (${t.x},${t.y}) em ${this.nome} — ${terreno}.`,
      `Passagens: ${exits.length ? exits.join('; ') : 'nenhuma visível'}.`,
      `À vista: ${others.length ? others.map(bearing).join('; ') : 'ninguém além de você'}.`,
    ].join(' ');
  }

  updateExplored() {
    for (const t of this.tokens) if (t.kind === 'pc') for (const k of this.fov(t)) this.explored.add(k);
  }

  serialize() {
    return { id: 'current', cols: this.cols, rows: this.rows, tiles: Array.from(this.tiles), tokens: this.tokens, tipo: this.tipo, nome: this.nome, spawn: this.spawn, explored: Array.from(this.explored) };
  }

  static deserialize(d) {
    const w = new World({ cols: d.cols, rows: d.rows });
    w.tiles = d.tiles; w.tokens = d.tokens; w.tipo = d.tipo; w.nome = d.nome; w.spawn = d.spawn;
    w.explored = new Set(d.explored || []);
    return w;
  }
}

// ---------- Renderização ----------
const COLORS = {
  [TILE.FLOOR]: '#2a2f38',
  [TILE.WALL]: '#14171d',
  [TILE.DOOR]: '#6b4f2a',
  [TILE.WATER]: '#1e3a4a',
  [TILE.TREE]: '#1f3226',
};

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.cell = 22;
    this.cam = { x: 0, y: 0 };
    this.focusId = null;
    this.hoverCell = null;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = r.width; this.viewH = r.height;
  }

  centerOn(token) {
    if (!token) return;
    this.cam.x = token.x * this.cell - this.viewW / 2 + this.cell / 2;
    this.cam.y = token.y * this.cell - this.viewH / 2 + this.cell / 2;
  }

  screenToCell(sx, sy) {
    const r = this.canvas.getBoundingClientRect();
    return { x: Math.floor((sx - r.left + this.cam.x) / this.cell), y: Math.floor((sy - r.top + this.cam.y) / this.cell) };
  }

  draw() {
    const { ctx, world, cell } = this;
    if (!this.viewW) this.resize();
    ctx.fillStyle = '#0d0f13';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const focus = this.focusId ? world.tokenOf(this.focusId) : null;
    const visible = focus ? world.fov(focus) : null;

    const x0 = Math.max(0, Math.floor(this.cam.x / cell));
    const y0 = Math.max(0, Math.floor(this.cam.y / cell));
    const x1 = Math.min(world.cols, x0 + Math.ceil(this.viewW / cell) + 1);
    const y1 = Math.min(world.rows, y0 + Math.ceil(this.viewH / cell) + 1);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const key = `${x},${y}`;
        const isVisible = !visible || visible.has(key);
        const wasExplored = world.explored.has(key);
        if (!isVisible && !wasExplored) continue;
        const sx = x * cell - this.cam.x, sy = y * cell - this.cam.y;
        ctx.fillStyle = COLORS[world.at(x, y)] || '#2a2f38';
        ctx.fillRect(sx, sy, cell, cell);
        if (!isVisible) { ctx.fillStyle = 'rgba(6,8,11,0.62)'; ctx.fillRect(sx, sy, cell, cell); }
        ctx.strokeStyle = 'rgba(233,226,207,0.045)';
        ctx.strokeRect(sx + 0.5, sy + 0.5, cell - 1, cell - 1);
      }
    }

    if (this.hoverCell && world.walkable(this.hoverCell.x, this.hoverCell.y)) {
      ctx.strokeStyle = 'rgba(201,154,59,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.hoverCell.x * cell - this.cam.x + 1, this.hoverCell.y * cell - this.cam.y + 1, cell - 2, cell - 2);
      ctx.lineWidth = 1;
    }

    for (const t of world.tokens) {
      const key = `${t.x},${t.y}`;
      if (visible && !visible.has(key)) continue;
      const sx = t.x * cell - this.cam.x + cell / 2, sy = t.y * cell - this.cam.y + cell / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, cell * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      if (t.id === this.focusId) { ctx.strokeStyle = '#e9e2cf'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
      ctx.fillStyle = '#0d0f13';
      ctx.font = `600 ${Math.floor(cell * 0.34)}px 'IBM Plex Sans',sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((t.name || '?').slice(0, 2).toUpperCase(), sx, sy + 1);
    }
  }
}
