// Desenho do mundo em canvas 2D: terreno em textura, criaturas vetoriais, efeitos e ciclo dia/noite.
import { T } from './data.js';

const TP = 4; // pixels por tile na textura do terreno

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const C = {
  deep: hex('#1b3552'), water: hex('#2b5a86'), river: hex('#3d7db3'), sand: hex('#cdb57c'),
  grassDry: hex('#9c9a58'), grass: hex('#4e8a3a'), forest: hex('#2e5a2a'), tree: hex('#1f421d'),
  hills: hex('#8a7a58'), hillsDark: hex('#6f6246'), mountain: hex('#6d6a66'), snow: hex('#e9ecef'),
  soil: hex('#6b4f2e'), crop: hex('#c9b546'), winter: hex('#dfe7ec'),
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, scale: 6 };
    this.selected = null;
    this.follow = false;
    this.lastTerrain = -1e9;
  }

  setSim(sim) {
    this.sim = sim;
    const w = sim.world;
    this.tex = document.createElement('canvas');
    this.tex.width = w.W * TP;
    this.tex.height = w.H * TP;
    this.tctx = this.tex.getContext('2d');
    this.img = this.tctx.createImageData(this.tex.width, this.tex.height);
    this.lastTerrain = -1e9;
    this.fit();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.dpr = dpr;
  }

  // Área do canvas coberta pelo painel no celular: o centro da câmera fica acima dela.
  // No celular o canvas ocupa a tela toda; barra e painel cobrem as bordas.
  insets() {
    if (window.innerWidth > 820) return [0, 0];
    const bar = document.getElementById('bar');
    const p = document.getElementById('panel');
    const top = bar ? bar.getBoundingClientRect().bottom : 0;
    const bottom = p && !p.classList.contains('hide') ? p.getBoundingClientRect().height : 46;
    return [top, bottom];
  }
  center() {
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr;
    const [top, bottom] = this.insets();
    return [vw / 2, top + (vh - top - bottom) / 2];
  }

  fit() {
    if (!this.sim) return;
    const { W, H } = this.sim.world;
    const [top, bottom] = this.insets();
    const vw = this.canvas.width / this.dpr, vh = this.canvas.height / this.dpr - top - bottom;
    this.cam.scale = Math.max(2, Math.min(vw / W, vh / H) * 1.05);
    this.cam.x = W / 2;
    this.cam.y = H / 2;
  }

  screenToWorld(sx, sy) {
    const [cx, cy] = this.center();
    return [(sx - cx) / this.cam.scale + this.cam.x, (sy - cy) / this.cam.scale + this.cam.y];
  }

  zoomAt(sx, sy, factor) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.cam.scale = Math.max(2, Math.min(48, this.cam.scale * factor));
    const [nx, ny] = this.screenToWorld(sx, sy);
    this.cam.x += wx - nx;
    this.cam.y += wy - ny;
  }

  // Redesenha a textura do terreno (vegetação, roças e estação mudam com o tempo).
  paintTerrain() {
    const s = this.sim, w = s.world, d = this.img.data;
    const winter = s.season === 3 ? 0.45 : s.season === 2 ? 0.08 : 0;
    const TW = w.W * TP;
    for (let y = 0; y < w.H; y++) {
      for (let x = 0; x < w.W; x++) {
        const i = y * w.W + x;
        const t = w.terrain[i];
        const sh = w.shade[i];
        const ratio = w.foodCap[i] > 0 ? w.food[i] / w.foodCap[i] : 0;
        let base, detail = null, pattern = 0;
        switch (t) {
          case T.DEEP: base = C.deep; break;
          case T.WATER: base = mix(C.water, C.deep, 0.2 * sh); break;
          case T.RIVER: base = C.river; break;
          case T.SAND: base = mix(C.sand, C.grassDry, ratio * 0.3); break;
          case T.GRASS: base = mix(C.grassDry, C.grass, 0.25 + 0.75 * ratio); break;
          case T.FOREST: base = mix(C.grass, C.forest, 0.6); detail = C.tree; pattern = Math.min(4, Math.round(w.wood[i] / 3)); break;
          case T.HILLS: base = mix(C.hills, C.hillsDark, sh); break;
          case T.MOUNTAIN: base = mix(C.mountain, C.snow, Math.max(0, (w.elev[i] - 0.72) * 3.5)); break;
          case T.FARM: base = C.soil; detail = mix(C.soil, C.crop, ratio); pattern = 9; break;
          default: base = C.grass;
        }
        const wt = t === T.DEEP || t === T.WATER || t === T.RIVER ? 0 : winter * (t === T.MOUNTAIN ? 0.3 : 1);
        if (wt) { base = mix(base, C.winter, wt); if (detail) detail = mix(detail, C.winter, wt * 0.6); }
        const jitter = (sh - 0.5) * 14;
        for (let py = 0; py < TP; py++) {
          for (let px = 0; px < TP; px++) {
            let c = base;
            if (detail) {
              if (pattern === 9) { if (py % 2 === 0) c = detail; }
              else {
                const k = (px + py * 3 + x * 7 + y * 13) % 5;
                if (k < pattern && (px + py) % 2 === 0) c = detail;
              }
            }
            const o = ((y * TP + py) * TW + x * TP + px) * 4;
            d[o] = c[0] + jitter; d[o + 1] = c[1] + jitter; d[o + 2] = c[2] + jitter; d[o + 3] = 255;
          }
        }
      }
    }
    this.tctx.putImageData(this.img, 0, 0);
  }

  draw(now) {
    const s = this.sim, ctx = this.ctx;
    if (!s) return;
    if (now - this.lastTerrain > 600) { this.paintTerrain(); this.lastTerrain = now; }
    if (this.follow && this.selected && this.selected.alive) { this.cam.x += (this.selected.x - this.cam.x) * 0.15; this.cam.y += (this.selected.y - this.cam.y) * 0.15; }
    const dpr = this.dpr, vw = this.canvas.width / dpr, vh = this.canvas.height / dpr;
    const sc = this.cam.scale;
    const [ccx, ccy] = this.center();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1a2a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ccx - this.cam.x * sc), dpr * (ccy - this.cam.y * sc));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.tex, 0, 0, s.world.W, s.world.H);

    const [x0, y0] = this.screenToWorld(0, 0);
    const [x1, y1] = this.screenToWorld(vw, vh);
    const vis = (x, y, m = 2) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
    const px = 1 / sc; // um pixel de tela em unidades do mundo

    // territórios e aldeias
    for (const t of s.tribes) {
      if (!t.alive) continue;
      ctx.beginPath();
      ctx.arc(t.home.x, t.home.y, t.radius(), 0, Math.PI * 2);
      ctx.fillStyle = t.color + '12';
      ctx.fill();
      ctx.strokeStyle = t.color + (s.wars.size && [...s.wars.values()].some((w) => w.a === t.id || w.b === t.id) ? 'cc' : '55');
      ctx.lineWidth = px * 1.5;
      ctx.setLineDash([px * 5, px * 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const h of t.huts) if (vis(h.x, h.y)) drawHut(ctx, h.x + 0.5, h.y + 0.5, t.color);
    }

    // criaturas
    const tick = s.tick;
    const list = s.creatures;
    for (let k = 0; k < list.length; k++) {
      const c = list[k];
      if (!c.alive || !vis(c.x, c.y)) continue;
      drawCreature(ctx, c, tick, px);
    }

    // fogueiras (antes do escurecimento, o brilho vem depois)
    for (const t of s.tribes) if (t.alive && vis(t.home.x, t.home.y)) drawFire(ctx, t.home.x, t.home.y, tick, 0.35);

    // efeitos
    for (const f of s.fx) {
      const age = tick - f.t;
      if (!vis(f.x, f.y, 6)) continue;
      if (f.type === 'arrow' && age < 6) {
        ctx.strokeStyle = '#f3e3b0';
        ctx.lineWidth = px * 1.2;
        const k2 = age / 6;
        ctx.beginPath();
        ctx.moveTo(f.x + (f.x2 - f.x) * k2, f.y + (f.y2 - f.y) * k2);
        ctx.lineTo(f.x + (f.x2 - f.x) * Math.min(1, k2 + 0.3), f.y + (f.y2 - f.y) * Math.min(1, k2 + 0.3));
        ctx.stroke();
      } else if (f.type === 'slash' && age < 5) {
        ctx.strokeStyle = '#ffffffcc';
        ctx.lineWidth = px * 1.5;
        ctx.beginPath();
        ctx.arc(f.x2, f.y2, 0.35 + age * 0.05, -1 + age * 0.4, 0.6 + age * 0.4);
        ctx.stroke();
      } else if (f.type === 'death' && age < 300) {
        ctx.globalAlpha = 1 - age / 300;
        ctx.strokeStyle = '#e6dccb';
        ctx.lineWidth = px * 1.5;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 0.35); ctx.lineTo(f.x, f.y + 0.3);
        ctx.moveTo(f.x - 0.2, f.y - 0.12); ctx.lineTo(f.x + 0.2, f.y - 0.12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'fire' && age < 400) {
        drawFire(ctx, f.x, f.y, tick + f.x * 10, 0.7 * (1 - age / 400) + 0.2);
      }
    }

    // seleção
    const sel = this.selected;
    if (sel && sel.alive) {
      ctx.strokeStyle = '#ffe28a';
      ctx.lineWidth = px * 2;
      ctx.beginPath();
      ctx.arc(sel.x, sel.y, sel.sp.size + 0.35 + Math.sin(now / 200) * 0.05, 0, Math.PI * 2);
      ctx.stroke();
      if (sel.path && sel.path.length) {
        ctx.strokeStyle = '#ffe28a88';
        ctx.lineWidth = px * 1.5;
        ctx.setLineDash([px * 3, px * 3]);
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y);
        for (let i = sel.pathI || 0; i < sel.path.length; i++) ctx.lineTo(sel.path[i][0], sel.path[i][1]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // noite e brilho das fogueiras
    const dark = darkness(s.dayFrac);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(8, 12, 36, ${dark * 0.5})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ccx - this.cam.x * sc), dpr * (ccy - this.cam.y * sc));
      ctx.globalCompositeOperation = 'lighter';
      for (const t of s.tribes) {
        if (!t.alive || !vis(t.home.x, t.home.y, 8)) continue;
        const r = 3 + Math.sin(tick * 0.3 + t.id) * 0.2;
        const g = ctx.createRadialGradient(t.home.x, t.home.y, 0, t.home.x, t.home.y, r);
        g.addColorStop(0, `rgba(255, 150, 60, ${0.45 * dark})`);
        g.addColorStop(1, 'rgba(255, 120, 40, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(t.home.x - r, t.home.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // rótulos (em pixels de tela, sempre legíveis)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const toScreen = (x, y) => [(x - this.cam.x) * sc + ccx, (y - this.cam.y) * sc + ccy];
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of s.tribes) {
      if (!t.alive || !vis(t.home.x, t.home.y, 4)) continue;
      const [sx, sy] = toScreen(t.home.x, t.home.y - t.radius() - 0.5);
      label(ctx, `${t.name} · ${t.members.size}`, sx, sy, t.color);
    }
    if (sc >= 14) {
      ctx.font = '11px Inter, system-ui, sans-serif';
      for (const c of list) {
        if (!c.alive || !vis(c.x, c.y) || !(c.notable() || c === sel)) continue;
        const [sx, sy] = toScreen(c.x, c.y - c.sp.size - 0.5);
        label(ctx, c.fullName(), sx, sy, '#f4eee0');
      }
    }
    if (sel && sel.alive) {
      const [sx, sy] = toScreen(sel.x, sel.y + sel.sp.size + 0.6);
      ctx.font = 'italic 12px Inter, system-ui, sans-serif';
      label(ctx, `${sel.name}: ${sel.thought}`, sx, sy + 12, '#ffe28a');
    }
  }

  // Procura a criatura (ou cabana) mais próxima de um ponto da tela.
  pick(sx, sy) {
    const s = this.sim;
    const [wx, wy] = this.screenToWorld(sx, sy);
    const rad = Math.max(1, 14 / this.cam.scale);
    let best = null, bd = rad;
    for (const c of s.nearby(wx, wy, rad + 1)) {
      const d = Math.hypot(c.x - wx, c.y - wy) - (c.sapient ? 0.3 : 0) - c.sp.size * 0.5;
      if (d < bd) { bd = d; best = c; }
    }
    if (best) return { creature: best };
    for (const t of s.tribes) {
      if (!t.alive) continue;
      if (Math.hypot(t.home.x - wx, t.home.y - wy) < 1.5 || t.huts.some((h) => Math.abs(h.x + 0.5 - wx) < 0.7 && Math.abs(h.y + 0.5 - wy) < 0.7)) return { tribe: t };
    }
    return null;
  }
}

function darkness(f) {
  // 0 = meio-dia, 1 = meia-noite; transições suaves no amanhecer e no crepúsculo
  if (f >= 0.08 && f < 0.68) return 0;
  if (f >= 0.68 && f < 0.78) return (f - 0.68) / 0.1;
  if (f >= 0.78 || f < 0.0) return 1;
  return 1 - f / 0.08;
}

function label(ctx, text, x, y, color) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHut(ctx, x, y, color) {
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - 0.36, y - 0.1, 0.72, 0.45);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 0.46, y - 0.08);
  ctx.lineTo(x, y - 0.48);
  ctx.lineTo(x + 0.46, y - 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1c10';
  ctx.fillRect(x - 0.08, y + 0.08, 0.16, 0.27);
}

function drawFire(ctx, x, y, tick, size) {
  const f = Math.sin(tick * 0.9) * 0.05 + Math.sin(tick * 1.7) * 0.03;
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5 + f, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd35a';
  ctx.beginPath();
  ctx.arc(x, y - 0.05, size * 0.25 + f * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCreature(ctx, c, tick, px) {
  const sp = c.sp;
  let r = sp.size * (c.isAdult() ? 1 : 0.55 + 0.45 * (c.ageYears() / Math.max(0.1, sp.adult)));
  const asleep = c.action?.asleep || (c.species === 'dragon' && tick < c.sleepUntil);
  const x = c.x, y = c.y;
  ctx.globalAlpha = asleep ? 0.65 : 1;
  const fill = c.hitFlash > 0 ? '#ffffff' : sp.color;
  switch (sp.shape) {
    case 'circle':
    case 'square':
    case 'diamond':
    case 'triangle': {
      ctx.beginPath();
      shapePath(ctx, sp.shape, x, y, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (c.tribe) {
        ctx.strokeStyle = c.tribe.color;
        ctx.lineWidth = Math.max(px * 1.5, r * 0.28);
        ctx.stroke();
      }
      if (c.isLeader()) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y - r * 1.05);
        ctx.lineTo(x - r * 0.6, y - r * 1.55);
        ctx.lineTo(x - r * 0.2, y - r * 1.3);
        ctx.lineTo(x, y - r * 1.65);
        ctx.lineTo(x + r * 0.2, y - r * 1.3);
        ctx.lineTo(x + r * 0.6, y - r * 1.55);
        ctx.lineTo(x + r * 0.6, y - r * 1.05);
        ctx.closePath();
        ctx.fill();
      }
      if (c.carryFood + c.carryWood >= 1) {
        ctx.fillStyle = c.carryWood > c.carryFood ? '#9b6b3c' : '#e04b4b';
        ctx.beginPath();
        ctx.arc(x + r * 0.9, y + r * 0.5, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'deer': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.2, r * 0.75, c.dir, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8d2b0';
      ctx.beginPath();
      ctx.arc(x + Math.cos(c.dir) * r * 1.1, y + Math.sin(c.dir) * r * 1.1, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wolf': {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.3, r * 0.7, c.dir, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d6168';
      ctx.beginPath();
      const hx = x + Math.cos(c.dir) * r * 1.3, hy = y + Math.sin(c.dir) * r * 1.3;
      ctx.moveTo(hx + Math.cos(c.dir) * r * 0.6, hy + Math.sin(c.dir) * r * 0.6);
      ctx.lineTo(hx + Math.cos(c.dir + 2.2) * r * 0.5, hy + Math.sin(c.dir + 2.2) * r * 0.5);
      ctx.lineTo(hx + Math.cos(c.dir - 2.2) * r * 0.5, hy + Math.sin(c.dir - 2.2) * r * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'dragon': {
      const flap = asleep ? 0.2 : Math.sin(tick * 0.35) * 0.5 + 0.6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(asleep ? 0 : c.dir);
      ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : '#a82620';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, 0);
        ctx.lineTo(-r * 0.6, side * r * (1.2 + flap));
        ctx.lineTo(r * 0.5, side * r * (0.9 + flap * 0.6));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(-r * 1.8, r * 0.2);
      ctx.lineTo(-r * 0.8, r * 0.18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 1.0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
  }
  ctx.globalAlpha = 1;
  if (asleep && tick % 60 < 40) {
    ctx.fillStyle = '#dfe8ff';
    ctx.font = `${r * 1.1}px sans-serif`;
    ctx.fillText('z', x + r * 0.7, y - r * 0.8 - (tick % 60) * r * 0.01);
  }
  if (c.hp < c.maxHp() * 0.7 && !asleep) {
    const w = Math.max(0.6, r * 2);
    ctx.fillStyle = '#000a';
    ctx.fillRect(x - w / 2, y + r + 0.12, w, 0.1);
    ctx.fillStyle = c.hp < c.maxHp() * 0.3 ? '#e66767' : '#e0b45a';
    ctx.fillRect(x - w / 2, y + r + 0.12, w * Math.max(0, c.hp / c.maxHp()), 0.1);
  }
}

function shapePath(ctx, shape, x, y, r) {
  switch (shape) {
    case 'circle': ctx.arc(x, y, r, 0, Math.PI * 2); break;
    case 'square': ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); break;
    case 'diamond': ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r, y); ctx.closePath(); break;
    case 'triangle': ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.05, y + r * 0.8); ctx.lineTo(x - r * 1.05, y + r * 0.8); ctx.closePath(); break;
  }
}
