// Ponto de entrada: laço de simulação, câmera e entrada do usuário.
import { Sim } from './sim.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';

const BASE_TPS = 20; // ticks por segundo na velocidade 1×
const FRAME_BUDGET_MS = 28;

class App {
  constructor() {
    this.canvas = document.getElementById('view');
    this.renderer = new Renderer(this.canvas);
    this.ui = new UI(this);
    this.speed = 4;
    this.acc = 0;
    this.lastFrame = performance.now();
    this.lastUi = 0;
    this.bindInput();
    this.bindControls();
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    const q = new URLSearchParams(location.search).get('seed');
    this.newWorld(q ? Number(q) : Math.floor(Math.random() * 1e6));
    requestAnimationFrame((t) => this.frame(t));
  }

  newWorld(seed) {
    this.sim = new Sim(seed);
    this.renderer.setSim(this.sim);
    this.renderer.selected = null;
    this.renderer.follow = false;
    this.ui.reset(this.sim);
    const url = new URL(location.href);
    url.searchParams.set('seed', this.sim.seed);
    history.replaceState(null, '', url);
  }

  setSpeed(v) {
    this.speed = v;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', Number(b.dataset.s) === v);
  }

  frame(now) {
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.speed > 0) {
      this.acc += dt * BASE_TPS * this.speed;
      const start = performance.now();
      while (this.acc >= 1) {
        this.sim.step();
        this.acc -= 1;
        if (performance.now() - start > FRAME_BUDGET_MS) { this.acc = Math.min(this.acc, BASE_TPS); break; }
      }
    }
    this.renderer.draw(now);
    if (now - this.lastUi > 300) { this.ui.update(); this.lastUi = now; }
    requestAnimationFrame((t) => this.frame(t));
  }

  select(c, center) {
    this.renderer.selected = c;
    if (center && c.alive) { this.focus(c.x, c.y); this.renderer.follow = true; }
    this.ui.showTab('who');
  }

  focus(x, y) {
    this.renderer.cam.x = x;
    this.renderer.cam.y = y;
    if (this.renderer.cam.scale < 12) this.renderer.cam.scale = 14;
  }

  selectRandomNotable() {
    const pool = this.sim.creatures.filter((c) => c.alive && c.sapient && c.notable());
    const list = pool.length ? pool : this.sim.creatures.filter((c) => c.alive && c.sapient);
    if (!list.length) return;
    this.select(list[Math.floor(Math.random() * list.length)], true);
  }

  bindControls() {
    for (const b of document.querySelectorAll('#speed button')) b.addEventListener('click', () => this.setSpeed(Number(b.dataset.s)));
    this.setSpeed(this.speed);
    document.getElementById('newWorld').addEventListener('click', () => this.newWorld(Number(document.getElementById('seedInput').value) || 1));
    document.getElementById('randWorld').addEventListener('click', () => this.newWorld(Math.floor(Math.random() * 1e6)));
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.speed ? 0 : 4); }
      const map = { Digit1: 0, Digit2: 1, Digit3: 4, Digit4: 16, Digit5: 64 };
      if (e.code in map) this.setSpeed(map[e.code]);
      if (e.code === 'KeyF' && this.renderer.selected) this.renderer.follow = !this.renderer.follow;
    });
  }

  bindInput() {
    const cv = this.canvas;
    const pointers = new Map();
    let moved = 0, pinchDist = 0;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      cv.classList.add('dragging');
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      const r = this.renderer;
      if (pointers.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) r.follow = false;
        r.cam.x -= dx / r.cam.scale;
        r.cam.y -= dy / r.cam.scale;
      } else if (pointers.size === 2) {
        moved += 10;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = cv.getBoundingClientRect();
        if (pinchDist > 0) r.zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / pinchDist);
        pinchDist = d;
      }
    });
    const up = (e) => {
      const had = pointers.delete(e.pointerId);
      if (!pointers.size) cv.classList.remove('dragging');
      if (had && moved < 6 && pointers.size === 0) {
        const rect = cv.getBoundingClientRect();
        const hit = this.renderer.pick(e.clientX - rect.left, e.clientY - rect.top);
        if (hit?.creature) this.select(hit.creature, false);
        else if (hit?.tribe) this.ui.showTab('tribes');
      }
      if (pointers.size < 2) pinchDist = 0;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      this.renderer.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
}

new App();
