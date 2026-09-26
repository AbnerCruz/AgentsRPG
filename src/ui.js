// Painéis HTML: crônica, povos, ficha da criatura e gráfico de população.
import { SPECIES, RACES, TICKS_PER_YEAR } from './data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(app) {
    this.app = app;
    this.tab = 'chron';
    this.shownLog = 0;
    this.minImp = 2;
    this.chronList = $('chronList');
    this.bindTabs();
    $('impFilter').addEventListener('change', (e) => { this.minImp = Number(e.target.value); this.rebuildChron(); });
    $('panel').addEventListener('click', (e) => this.onPanelClick(e));
    // não redesenha o painel no meio de um toque, senão o clique se perde
    $('panel').addEventListener('pointerdown', () => { this.holding = true; });
    window.addEventListener('pointerup', () => { setTimeout(() => { this.holding = false; }, 50); });
    $('panelToggle').addEventListener('click', () => $('panel').classList.toggle('hide'));
    this.initChart();
  }

  reset(sim) {
    this.sim = sim;
    this.shownLog = 0;
    this.chronList.innerHTML = '';
    this.rebuildChron();
    $('seedInput').value = sim.seed;
    this.renderTab(true);
  }

  bindTabs() {
    for (const b of document.querySelectorAll('#tabs button')) {
      b.addEventListener('click', () => this.showTab(b.dataset.tab));
    }
  }

  showTab(tab) {
    this.tab = tab;
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    for (const s of document.querySelectorAll('.tab')) s.classList.toggle('on', s.id === 'tab-' + tab);
    $('panel').classList.remove('hide');
    this.renderTab(true);
  }

  onPanelClick(e) {
    const el = e.target.closest('[data-id],[data-tribe],[data-act]');
    if (!el) return;
    if (el.dataset.id) {
      const c = this.sim.find(Number(el.dataset.id));
      if (c) this.app.select(c, true);
    } else if (el.dataset.tribe) {
      const t = this.sim.tribeById(Number(el.dataset.tribe));
      if (t) { this.app.focus(t.home.x, t.home.y); this.showTab('tribes'); }
    } else if (el.dataset.act === 'follow') {
      this.app.renderer.follow = !this.app.renderer.follow;
      this.renderTab(true);
    } else if (el.dataset.act === 'notable') {
      this.app.selectRandomNotable();
    }
  }

  // ---------- atualização periódica ----------
  update() {
    const s = this.sim;
    $('date').textContent = `${s.dateLabel()} · ${s.isNight() ? 'noite' : 'dia'}`;
    const pop = RACES.map((k) => `${SPECIES[k].plural} <b>${s.countOf(k)}</b>`).join(' · ');
    const tribes = s.tribes.filter((t) => t.alive).length;
    $('pop').innerHTML = `${pop} · ${tribes} tribos${s.wars.size ? ` · <span class="war">${s.wars.size} guerra${s.wars.size > 1 ? 's' : ''}</span>` : ''}`;
    this.appendChron();
    this.renderTab(false);
  }

  renderTab(force) {
    if (!this.sim) return;
    if (!force) {
      if (this.holding) return;
      const now = performance.now();
      if (this.tab !== 'world' && now - (this.lastTabRender || 0) < 900) return;
      this.lastTabRender = now;
    }
    if (this.tab === 'tribes') this.renderTribes();
    else if (this.tab === 'who') this.renderWho();
    else if (this.tab === 'world') this.drawChart();
  }

  // ---------- crônica ----------
  evHtml(e, fresh) {
    const refs = e.refs && e.refs.length ? ` data-id="${e.refs[0]}"` : '';
    return `<div class="ev i${e.imp}${refs ? ' has-ref' : ''}${fresh ? ' new' : ''}"${refs}><span class="d">${this.sim.dateLabel(e.t)}</span>${esc(e.text)}</div>`;
  }
  rebuildChron() {
    if (!this.sim) return;
    const log = this.sim.log;
    const items = [];
    for (let i = log.length - 1; i >= 0 && items.length < 300; i--) if (log[i].imp >= this.minImp) items.push(this.evHtml(log[i], false));
    this.chronList.innerHTML = items.join('') || '<p class="muted">Nada ainda. O mundo acabou de nascer.</p>';
    this.shownLog = log.length;
  }
  appendChron() {
    const log = this.sim.log;
    if (this.shownLog > log.length) { this.rebuildChron(); return; }
    if (this.shownLog === log.length) return;
    const fresh = [];
    for (let i = this.shownLog; i < log.length; i++) {
      const e = log[i];
      if (e.imp >= this.minImp) fresh.push(this.evHtml(e, true));
      if (e.imp >= 3 && this.sim.tick - e.t < 400) this.toast(e.text);
    }
    this.shownLog = log.length;
    if (!fresh.length) return;
    if (this.chronList.querySelector('p.muted')) this.chronList.innerHTML = '';
    this.chronList.insertAdjacentHTML('afterbegin', fresh.reverse().join(''));
    while (this.chronList.children.length > 300) this.chronList.lastChild.remove();
  }
  toast(text) {
    const box = $('toast');
    const el = document.createElement('div');
    el.className = 't';
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), 6000);
  }

  // ---------- povos ----------
  renderTribes() {
    const s = this.sim;
    const alive = s.tribes.filter((t) => t.alive).sort((a, b) => b.members.size - a.members.size);
    const dead = s.tribes.filter((t) => !t.alive).slice(-12).reverse();
    let html = '';
    for (const t of alive) {
      const rels = alive.filter((o) => o !== t).map((o) => {
        const v = Math.round(s.relation(t, o));
        const war = s.atWar(t, o);
        const mood = war ? '<span class="war">em guerra</span>' : v > 30 ? 'amigos' : v > 0 ? 'cordiais' : v > -30 ? 'desconfiados' : 'hostis';
        return `<div class="rel"><span class="link" data-tribe="${o.id}">${esc(o.name)}</span><span>${mood} (${v > 0 ? '+' : ''}${v})</span></div>`;
      }).join('');
      const adults = t.adults();
      html += `<div class="card">
        <h3><span class="sw" style="background:${t.color}"></span><span class="link" data-tribe="${t.id}">${esc(t.name)}</span></h3>
        <dl class="kv">
          <dt>Povo</dt><dd>${t.sp.plural}</dd>
          <dt>Líder</dt><dd>${t.leader ? `<span class="link" data-id="${t.leader.id}">${esc(t.leader.fullName())}</span>` : '—'}</dd>
          <dt>Membros</dt><dd>${t.members.size} (${adults} adultos, ${t.members.size - adults} jovens) · auge ${t.peak}</dd>
          <dt>Aldeia</dt><dd>${t.huts.length} cabanas · ${t.fields.length} roças</dd>
          <dt>Estoque</dt><dd>${Math.round(t.food)} comida · ${Math.round(t.wood)} madeira</dd>
          <dt>Fundada</dt><dd>${s.dateLabel(t.founded)} · ${t.births} nascimentos · ${t.deaths} mortes</dd>
        </dl>
        ${rels ? `<div class="rels">${rels}</div>` : ''}
      </div>`;
    }
    if (dead.length) {
      html += '<h3 class="muted" style="font-family:Cinzel,serif">Povos extintos</h3>';
      for (const t of dead) html += `<div class="card dead"><h3><span class="sw" style="background:${t.color}"></span>${esc(t.name)}</h3><div class="small muted">${t.sp.plural} · ${s.dateLabel(t.founded)} até ${s.dateLabel(t.died || s.tick)} · auge de ${t.peak} membros</div></div>`;
    }
    const el = $('tab-tribes');
    if (el.innerHTML !== html) el.innerHTML = html || '<p class="muted">Nenhum povo vive neste mundo.</p>';
  }

  // ---------- ficha da criatura ----------
  renderWho() {
    const c = this.app.renderer.selected;
    const el = $('tab-who');
    if (!c) {
      el.innerHTML = '<p class="muted">Toque numa criatura no mapa para acompanhar sua vida.</p><button data-act="notable">Mostrar alguém notável</button>';
      return;
    }
    const s = this.sim;
    const link = (id) => { const o = s.find(id); return o ? `<span class="link" data-id="${o.id}">${esc(o.name)}</span>${o.alive ? '' : ' †'}` : '—'; };
    const bar = (label, v, color) => `<span>${label}</span><div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${color}"></i></div>`;
    const age = Math.floor(c.ageYears());
    const sexWord = c.sapient ? (c.sex === 'F' ? 'mulher' : 'homem') : c.sex === 'F' ? 'fêmea' : 'macho';
    const tags = [];
    if (c.isLeader()) tags.push('Líder');
    if (c.role && c.sapient && c.isAdult()) tags.push(c.role[0].toUpperCase() + c.role.slice(1));
    if (!c.isAdult() && c.sapient) tags.push('Criança');
    if (c.pregnant) tags.push('Grávida');
    if (c.raid) tags.push('Em campanha');
    if (c.kills) tags.push(`${c.kills} abates`);
    if (c.grudges.size) tags.push(`Jurou vingança (${c.grudges.size})`);
    const status = c.alive ? `<div class="thought">“${esc(c.thought || '...')}”</div>` : `<div class="thought">Morreu: ${esc(c.deathCause || '?')} (${s.dateLabel(c.deathT)}).</div>`;
    const g = c.genes;
    const trait = (v, lo, hi) => (v > 1.08 ? hi : v < 0.92 ? lo : null);
    const traits = [trait(g.str, 'franzino', 'forte'), trait(g.spd, 'lento', 'veloz'), trait(g.vis, 'míope', 'olhos de águia'), trait(g.life, 'frágil', 'longevo'),
      c.agg() > 0.6 ? 'agressivo' : c.agg() < 0.2 ? 'pacífico' : null, c.soc() > 0.65 ? 'sociável' : c.soc() < 0.35 ? 'solitário' : null].filter(Boolean);
    let html = `<div class="who-head">
      <h2>${esc(c.fullName())}</h2>
      <div class="sub"><span class="sw" style="background:${c.sp.color}"></span> ${c.sp.name}, ${sexWord}, ${age} anos${c.tribe ? ` · <span class="link" data-tribe="${c.tribe.id}">${esc(c.tribe.name)}</span>` : c.sapient ? ' · sem povo' : ''}</div>
      <div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join('')}${traits.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    </div>
    ${status}
    <div class="row"><button data-act="follow" class="${this.app.renderer.follow ? 'on' : ''}">${this.app.renderer.follow ? 'Seguindo' : 'Seguir no mapa'}</button><button data-act="notable">Outro notável</button></div>`;
    if (c.alive) {
      html += `<div class="bars">
        ${bar('Vida', c.hp / c.maxHp(), '#7ccf8a')}
        ${bar('Fome', c.hunger, '#e0b45a')}
        ${bar('Sede', c.thirst, '#5fb3e4')}
        ${c.sapient ? bar('Energia', c.energy, '#b9a8ff') : ''}
      </div>`;
    }
    if (c.sapient) {
      const kids = c.children.map(link).join(', ');
      html += `<div class="card"><dl class="kv">
        <dt>Mãe</dt><dd>${c.mother ? link(c.mother) : '—'}</dd>
        <dt>Pai</dt><dd>${c.father ? link(c.father) : '—'}</dd>
        <dt>Parceiro(a)</dt><dd>${c.partner ? link(c.partner) : '—'}</dd>
        <dt>Filhos</dt><dd>${kids || '—'}</dd>
        <dt>Fama</dt><dd>${Math.round(c.fame)}</dd>
      </dl></div>`;
      const bio = c.history.slice().reverse().map((h) => `<div><span class="d">${s.dateLabel(h.t)}</span>${esc(h.text)}</div>`).join('');
      html += `<h3 style="font-family:Cinzel,serif;margin:10px 0 6px">Biografia</h3><div class="bio">${bio || '<span class="muted">Uma vida ainda sem história.</span>'}</div>`;
    }
    el.innerHTML = html;
  }

  // ---------- gráfico de população ----------
  initChart() {
    this.chart = $('chart');
    this.series = RACES.map((k) => ({ key: k, name: SPECIES[k].plural, color: SPECIES[k].color }));
    $('chartLegend').innerHTML = this.series.map((s) => `<span><i class="sw" style="background:${s.color}"></i>${s.name}</span>`).join('');
    this.hoverX = null;
    const move = (e) => {
      const r = this.chart.getBoundingClientRect();
      this.hoverX = (e.clientX - r.left) / r.width;
      this.drawChart();
    };
    this.chart.addEventListener('pointermove', move);
    this.chart.addEventListener('pointerdown', move);
    this.chart.addEventListener('pointerleave', () => { this.hoverX = null; $('chartTip').hidden = true; this.drawChart(); });
  }

  drawChart() {
    const s = this.sim, cv = this.chart;
    if (!s || !cv.offsetWidth) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.offsetWidth, H = cv.offsetHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const hist = s.history;
    if (hist.length < 2) return;
    const pad = { l: 32, r: 44, t: 10, b: 20 };
    const t0 = hist[0].t, t1 = Math.max(hist[hist.length - 1].t, t0 + 1);
    let maxV = 10;
    for (const h of hist) for (const se of this.series) maxV = Math.max(maxV, h.pops[se.key]);
    maxV = niceMax(maxV);
    const X = (t) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
    const Y = (v) => H - pad.b - (v / maxV) * (H - pad.t - pad.b);
    // grade recessiva
    ctx.strokeStyle = '#2a2e36';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#858073';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let k = 0; k <= 4; k++) {
      const v = (maxV / 4) * k, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), pad.l - 4, y + 3);
    }
    ctx.textAlign = 'center';
    const years = (t1 - t0) / TICKS_PER_YEAR;
    const step = Math.max(1, niceMax(years / 5));
    for (let yv = Math.ceil(t0 / TICKS_PER_YEAR / step) * step; yv * TICKS_PER_YEAR <= t1; yv += step) {
      ctx.fillText(`ano ${yv + 1}`, X(yv * TICKS_PER_YEAR), H - 6);
    }
    // linhas
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    const ends = [];
    for (const se of this.series) {
      ctx.strokeStyle = se.color;
      ctx.beginPath();
      hist.forEach((h, i) => { const x = X(h.t), y = Y(h.pops[se.key]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      ends.push({ se, y: Y(hist[hist.length - 1].pops[se.key]) });
    }
    // rótulos diretos no fim das linhas, sem sobreposição
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
    ctx.textAlign = 'left';
    ctx.font = '10px Inter, system-ui, sans-serif';
    for (const e of ends) {
      ctx.fillStyle = e.se.color;
      ctx.fillRect(W - pad.r + 4, e.y - 3, 6, 6);
      ctx.fillStyle = '#b7b2a6';
      ctx.fillText(e.se.name.slice(0, 5), W - pad.r + 12, e.y + 3);
    }
    // camada de hover
    const tip = $('chartTip');
    if (this.hoverX != null) {
      const tx = t0 + ((this.hoverX * W - pad.l) / (W - pad.l - pad.r)) * (t1 - t0);
      let best = hist[0];
      for (const h of hist) if (Math.abs(h.t - tx) < Math.abs(best.t - tx)) best = h;
      const x = X(best.t);
      ctx.strokeStyle = '#858073';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
      for (const se of this.series) {
        ctx.fillStyle = se.color;
        ctx.strokeStyle = '#15171c';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, Y(best.pops[se.key]), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      tip.hidden = false;
      tip.innerHTML = `<div class="small muted">${s.dateLabel(best.t)}</div>` + this.series.map((se) => `<div class="r"><i class="sw" style="background:${se.color}"></i>${se.name}: <b>${best.pops[se.key]}</b></div>`).join('')
        + `<div class="r small muted">Cervos ${best.pops.deer} · Lobos ${best.pops.wolf}</div>`;
      tip.style.left = `${Math.min(W - tip.offsetWidth - 4, Math.max(4, x + 10))}px`;
    }
    this.renderTable();
  }

  renderTable() {
    const s = this.sim;
    const rows = [];
    const perYear = new Map();
    for (const h of s.history) perYear.set(Math.floor(h.t / TICKS_PER_YEAR) + 1, h);
    const years = [...perYear.keys()].slice(-10).reverse();
    for (const y of years) {
      const h = perYear.get(y);
      rows.push(`<tr><td>Ano ${y}</td>${this.series.map((se) => `<td>${h.pops[se.key]}</td>`).join('')}<td>${h.pops.deer}</td><td>${h.pops.wolf}</td></tr>`);
    }
    const html = `<table class="t"><tr><th>Ano</th>${this.series.map((se) => `<th>${se.name}</th>`).join('')}<th>Cervos</th><th>Lobos</th></tr>${rows.join('')}</table>`;
    const el = $('chartTable');
    if (el.innerHTML !== html) el.innerHTML = html;
  }
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
