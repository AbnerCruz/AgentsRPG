// main.js — bootstrap e interface. Canvas primeiro, controles só quando necessários.

import { openDB, put, get, getAll, del, uid, exportZip, importZip } from './db.js';
import { OpenRouter } from './openrouter.js';
import { World, Renderer } from './world.js';
import { Agent } from './agent.js';
import { Director } from './director.js';
import { Budget } from './budget.js';
import { importPdf, listArtifacts, removeArtifact, saveArtifact } from './artifacts.js';
import { rollDice } from './srd5e.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let cfg, or, world, rend, dir, budget;

// ---------------- boot ----------------
(async function boot() {
  await openDB();
  cfg = (await get('config', 'main')) || {
    id: 'main', apiKey: '', mgmtKey: '', caixaUSD: 0, sessoesPorSemana: 1,
    modeloAgentes: '', modeloMestre: '', modeloImagem: '', modo: 'mestre-ia', qtdAgentes: 3, playerAgentId: null,
  };
  or = new OpenRouter({ apiKey: cfg.apiKey, managementKey: cfg.mgmtKey });
  budget = new Budget(cfg);

  wireCanvas();
  wirePanel();
  wireComposer();
  wireSetup();

  const saved = await get('world', 'current');
  if (cfg.apiKey && saved && (await getAll('agents')).length) {
    await resume(saved);
  } else {
    $('#setup').hidden = false;
  }
})();

// ---------------- canvas ----------------
function wireCanvas() {
  const c = $('#stage');
  let drag = null;

  const onDown = (e) => {
    const p = e.touches ? e.touches[0] : e;
    drag = { x: p.clientX, y: p.clientY, camx: rend?.cam.x, camy: rend?.cam.y, moved: false };
  };
  const onMove = (e) => {
    if (!rend) return;
    const p = e.touches ? e.touches[0] : e;
    if (drag) {
      const dx = p.clientX - drag.x, dy = p.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      rend.cam.x = drag.camx - dx; rend.cam.y = drag.camy - dy;
      rend.draw();
    } else if (!e.touches) {
      rend.hoverCell = rend.screenToCell(p.clientX, p.clientY);
      rend.draw();
    }
  };
  const onUp = (e) => {
    if (rend && drag && !drag.moved) {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const cell = rend.screenToCell(p.clientX, p.clientY);
      const tok = world?.tokens.find(t => t.x === cell.x && t.y === cell.y);
      if (tok) showSheet(tok.id); else $('#sheet-pop').hidden = true;
    }
    drag = null;
  };

  c.addEventListener('mousedown', onDown); c.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('mousemove', onMove); c.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp); c.addEventListener('touchend', onUp);

  c.addEventListener('wheel', (e) => {
    if (!rend) return;
    e.preventDefault();
    rend.cell = Math.max(12, Math.min(46, rend.cell + (e.deltaY < 0 ? 2 : -2)));
    rend.draw();
  }, { passive: false });

  window.addEventListener('resize', () => { if (rend) { rend.resize(); rend.draw(); } });
}

async function showSheet(agentId) {
  const ag = await Agent.load(agentId);
  const pop = $('#sheet-pop');
  if (!ag || !ag.sheet) { pop.hidden = true; return; }
  const s = ag.sheet;
  pop.innerHTML = `
    <h3>${s.nome}</h3>
    <div class="sub">${s.raca} ${s.classe} · nível ${s.nivel} · PV ${s.pv_atual}/${s.pv_max} · CA ${s.ca}</div>
    <div class="attrs">${Object.entries(s.atributos).map(([k, v]) => `<div><span>${k.slice(0, 3)}</span><b>${v}</b></div>`).join('')}</div>
    <p>${s.traco || ''}</p>
    <p><em>${s.objetivo || ''}</em></p>
    <p>Perícias: ${s.pericias.join(', ')}</p>
    <p>Itens: ${s.inventario.join(', ')}</p>`;
  pop.hidden = false;
}

// ---------------- painel ----------------
function wirePanel() {
  $('#btn-menu').onclick = async () => { $('#panel').hidden = false; await renderCast(); await renderArts(); fillSettings(); };
  $('#panel-close').onclick = () => { $('#panel').hidden = true; };

  $$('.pnav').forEach(b => b.onclick = () => {
    $$('.pnav').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ['elenco', 'acervo', 'ajustes'].forEach(p => { $(`#p-${p}`).hidden = (p !== b.dataset.p); });
  });

  $('.filedrop').onclick = () => $('#pdf-in').click();
  $('#pdf-in').onchange = (e) => ingestPdfs(e.target.files, '#import-progress', '#import-label', renderArts);

  $('#f-save').onclick = async () => {
    cfg.caixaUSD = parseFloat($('#f-caixa').value || 0);
    cfg.sessoesPorSemana = +$('#f-sessoes').value;
    cfg.modeloAgentes = $('#f-m-agentes').value;
    cfg.modeloMestre = $('#f-m-mestre').value;
    cfg.modeloImagem = $('#f-m-imagem').value;
    await put('config', cfg);
    $('#panel').hidden = true;
  };

  $('#btn-export').onclick = async () => {
    const blob = await exportZip();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mesa-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
  };
  $('#btn-import').onclick = () => $('#import-in').click();
  $('#import-in').onchange = async (e) => { if (e.target.files[0]) { await importZip(e.target.files[0]); location.reload(); } };

  $('#btn-end').onclick = async () => {
    if (!budget.session) return;
    feed('Sistema', 'Encerrando a sessão...', 'sistema');
    await dir.closingSummary();
    const r = await budget.finish();
    feed('Sistema', `Sessão encerrada. Gasto ${usd(r.gasto)} · sobra ${usd(r.sobra)} volta ao caixa (${usd(r.caixa)}).`, 'sistema');
    await dir.saveWorld();
    $('#panel').hidden = true;
  };
}

async function renderCast() {
  const agents = await getAll('agents');
  $('#p-elenco').innerHTML = agents.map(a => `
    <div class="cast" data-id="${a.id}">
      <span class="dot" style="background:${a.color}"></span>
      <div><b>${a.sheet?.nome || a.name}</b>
      <small>${a.role === 'master' ? 'mestre' : `${a.sheet?.raca || ''} ${a.sheet?.classe || ''} · PV ${a.sheet?.pv_atual ?? '—'}`}</small></div>
    </div>`).join('') || '<small style="color:var(--dim)">Nenhum agente ainda.</small>';
  $$('#p-elenco .cast').forEach(el => el.onclick = () => { $('#panel').hidden = true; showSheet(el.dataset.id); });
}

async function renderArts() {
  const arts = await listArtifacts();
  $('#art-list').innerHTML = arts.map(a => `
    <div class="art"><div><b>${a.titulo}</b><small>${a.tipo}${a.paginas ? ` · ${a.paginas}p` : ''} · ${a.origem}</small></div>
    <button data-del="${a.id}">✕</button></div>`).join('') || '<small style="color:var(--dim)">Acervo vazio.</small>';
  $$('#art-list [data-del]').forEach(b => b.onclick = async () => { await removeArtifact(b.dataset.del); renderArts(); });
}

function fillSettings() {
  $('#f-caixa').value = cfg.caixaUSD || '';
  $('#f-sessoes').value = cfg.sessoesPorSemana || 1;
  fillModelSelects(['#f-m-agentes', '#f-m-mestre'], '#f-m-imagem');
}

// ---------------- PDFs com progresso real ----------------
async function ingestPdfs(files, progressSel, labelSel, done) {
  if (!files?.length) return;
  const wrap = $(progressSel), bar = $(progressSel + ' .pbar i'), label = $(labelSel);
  wrap.hidden = false;
  let fi = 0;
  for (const f of files) {
    fi++;
    try {
      const res = await importPdf(f, (p, total, nome) => {
        bar.style.width = `${(p / total) * 100}%`;
        label.textContent = `${nome} — página ${p}/${total} (arquivo ${fi}/${files.length})`;
      });
      label.textContent = `${f.name} → artefato "${res.tipo}" (${res.paginas} páginas)`;
    } catch (e) {
      label.textContent = `Falha em ${f.name}: ${e.message}`;
    }
  }
  setTimeout(() => { wrap.hidden = true; bar.style.width = '0'; }, 1600);
  await done?.();
}

// ---------------- setup ----------------
function wireSetup() {
  const step = (n) => { $$('.step').forEach(s => s.classList.toggle('active', +s.dataset.step === n)); };

  $('#s-next0').onclick = async () => {
    const api = $('#s-api').value.trim(), mgmt = $('#s-mgmt').value.trim();
    if (!api) { $('#s-err0').textContent = 'A API key é obrigatória.'; return; }
    $('#s-err0').textContent = 'conectando...';
    or.setKeys({ apiKey: api, managementKey: mgmt });
    try {
      const b = await or.balance({ force: true });
      cfg.apiKey = api; cfg.mgmtKey = mgmt;
      await put('config', cfg);
      $('#s-saldo').textContent = usd(b.available);
      $('#s-caixa').value = (b.available * 0.5).toFixed(2);
      $('#s-err0').textContent = '';
      await fillModelSelects(['#s-m-agentes', '#s-m-mestre'], '#s-m-imagem');
      step(1);
    } catch (e) { $('#s-err0').textContent = e.message; }
  };

  $('#s-next1').onclick = () => {
    cfg.caixaUSD = parseFloat($('#s-caixa').value || 0);
    cfg.sessoesPorSemana = +$('#s-sessoes').value;
    step(2);
  };

  $('#s-next2').onclick = () => {
    cfg.modeloAgentes = $('#s-m-agentes').value;
    cfg.modeloMestre = $('#s-m-mestre').value;
    cfg.modeloImagem = $('#s-m-imagem').value;
    step(3);
  };

  $$('.choice').forEach(b => b.onclick = () => {
    $$('.choice').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    cfg.modo = b.dataset.modo;
  });
  $$('.choice')[0].classList.add('on');

  $('#s-pdf').onchange = (e) => ingestPdfs(e.target.files, '#s-progress', '#s-plabel');

  $('#s-start').onclick = async () => {
    cfg.qtdAgentes = +$('#s-qtd').value;
    await put('config', cfg);
    $('#s-start').disabled = true;
    await startCampaign();
  };
}

async function fillModelSelects(textSels, imgSel) {
  try {
    const [txt, img] = await Promise.all([or.textModels(), or.imageModels()]);
    const opt = (m) => `<option value="${m.id}">${m.name} — $${(m.inPrice * 1e6).toFixed(2)}/M in · $${(m.outPrice * 1e6).toFixed(2)}/M out</option>`;
    for (const sel of textSels) {
      const el = $(sel); if (!el) continue;
      el.innerHTML = txt.map(opt).join('');
      const pref = sel.includes('mestre') ? (cfg.modeloMestre || 'openai/gpt-oss-120b') : (cfg.modeloAgentes || 'openai/gpt-oss-20b');
      el.value = txt.some(m => m.id === pref) ? pref : txt[0]?.id;
    }
    const ie = $(imgSel);
    if (ie) {
      ie.innerHTML = '<option value="">nenhum</option>' + img.map(opt).join('');
      if (cfg.modeloImagem && img.some(m => m.id === cfg.modeloImagem)) ie.value = cfg.modeloImagem;
    }
  } catch (e) { boot_log(`modelos: ${e.message}`); }
}

function boot_log(t) {
  const el = $('#boot-log'); if (!el) return;
  const d = document.createElement('div'); d.textContent = t; el.appendChild(d);
}

// ---------------- início e retomada ----------------
async function startCampaign() {
  boot_log('gerando cenário...');
  world = World.generate('masmorra');
  world.nome = 'Sala inicial';
  rend = new Renderer($('#stage'), world);
  rend.resize();

  boot_log('criando o mestre...');
  const master = new Agent({ name: 'Mestre', role: 'master', model: cfg.modeloMestre });
  await master.save();

  const amb = (await listArtifacts('ambientacao'))[0];
  const grupo = [];
  const nAgents = cfg.modo === 'mestre-ia' ? cfg.qtdAgentes : cfg.qtdAgentes;

  for (let i = 0; i < nAgents; i++) {
    boot_log(`criando personagem ${i + 1}/${nAgents}...`);
    const ag = new Agent({ name: `Agente ${i + 1}`, role: 'pc', model: cfg.modeloAgentes });
    await ag.save();
    const r = await ag.buildSheet(or, { ambientacao: amb ? amb.titulo : '', grupo });
    grupo.push(`${ag.sheet.nome} (${ag.sheet.raca} ${ag.sheet.classe})`);
    world.addToken({ id: ag.id, name: ag.sheet.nome, kind: 'pc', color: ag.color, visionRadius: Math.round(ag.sheet.visao / 1.5) });
  }

  // No modo "IA mestra", o primeiro personagem é o do jogador humano.
  if (cfg.modo === 'mestre-ia') {
    const first = (await getAll('agents')).find(a => a.role === 'pc');
    cfg.playerAgentId = first?.id || null;
  }
  await put('config', cfg);

  world.updateExplored();
  await launch();
  boot_log('abrindo a cena...');
  await dir.openCampaign();
  $('#setup').hidden = true;
}

async function resume(savedWorld) {
  world = World.deserialize(savedWorld);
  rend = new Renderer($('#stage'), world);
  rend.resize();
  await launch();
  feed('Sistema', 'Campanha retomada.', 'sistema');
}

async function launch() {
  or.startAutoSync();
  or.onBalance = (b) => { const el = $('#saldo-live'); if (el) el.textContent = usd(b.available); };

  dir = new Director({
    or, cfg, world,
    onEvent: (tipo, p) => {
      if (tipo === 'log') feed(p.speaker, p.text, p.kind);
      else if (tipo === 'redraw') rend.draw();
      else if (tipo === 'mapa') { rend.world = world; $('#scene-name').textContent = p.nome; rend.draw(); }
      else if (tipo === 'artefato') feed('Acervo', `Novo artefato: ${p.titulo}`, 'sistema');
      else if (tipo === 'checkBudget') return budget.mustClose();
    },
    onCost: (c, t) => {
      budget.register(c, t);
      updateBudgetBar();
      if (budget.mustClose()) forceClose();
    },
  });
  await dir.loadCast();

  const focus = cfg.modo === 'mestre-ia' ? cfg.playerAgentId : (world.tokens[0]?.id || null);
  rend.focusId = focus;
  rend.centerOn(world.tokenOf(focus));
  rend.draw();

  const bal = await or.balance().catch(() => ({ available: cfg.caixaUSD }));
  budget.start({ saldoProvedor: bal.available, modeloMestrePrice: or.priceOf(cfg.modeloMestre) });
  updateBudgetBar();

  $('#scene-name').textContent = world.nome;

  if (cfg.modo === 'so-ia') {
    $('#say').hidden = true; $('#btn-send').hidden = true;
    $('#btn-play').hidden = false;
    $('#btn-play').onclick = async () => {
      dir.running = !dir.running;
      $('#btn-play').textContent = dir.running ? '❚❚' : '▶';
      if (dir.running) await dir.loop();
    };
  } else if (cfg.modo === 'mestre-eu') {
    $('#say').placeholder = 'Narre a cena...';
  }
}

let closing = false;
async function forceClose() {
  if (closing || !budget.session) return;
  closing = true;
  dir.running = false;
  feed('Sistema', 'Limite da sessão atingido — fechando a cena.', 'sistema');
  await dir.closingSummary();
  const r = await budget.finish();
  feed('Sistema', `Sessão encerrada. Gasto ${usd(r.gasto)} · sobra ${usd(r.sobra)} volta ao caixa.`, 'sistema');
  await dir.saveWorld();
  $('#say').disabled = true;
  closing = false;
}

// ---------------- entrada do jogador ----------------
function wireComposer() {
  const send = async () => {
    const v = $('#say').value.trim();
    if (!v || !dir) return;
    $('#say').value = '';
    $('#say').disabled = true;

    // atalho local de dados: "/d20+3" rola sem gastar token nenhum
    if (v.startsWith('/')) {
      try { const d = rollDice(v.slice(1)); feed('Dados', `${d.notation} → [${d.rolls.join(', ')}] = ${d.total}`, 'dados'); }
      catch { feed('Sistema', 'Notação inválida. Ex: /1d20+3', 'sistema'); }
      $('#say').disabled = false; return;
    }

    try { await dir.runTurn(v); await dir.saveWorld(); }
    catch (e) { feed('Sistema', e.message, 'sistema'); }
    $('#say').disabled = false;
    $('#say').focus();
  };
  $('#btn-send').onclick = send;
  $('#say').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

// ---------------- utilidades de UI ----------------
function feed(who, text, kind = 'fala') {
  const el = document.createElement('div');
  el.className = `line ${kind}`;
  el.innerHTML = kind === 'narracao' || kind === 'sistema' || kind === 'dados'
    ? `<span class="${kind}">${esc(text)}</span>`
    : `<span class="who">${esc(who)}</span> ${esc(text)}`;
  $('#feed').appendChild(el);
  $('#feed').scrollTop = $('#feed').scrollHeight;
  while ($('#feed').children.length > 60) $('#feed').firstChild.remove();
}

function updateBudgetBar() {
  const s = budget.session;
  if (!s) return;
  const pct = budget.pct();
  const bar = $('#budget-bar');
  bar.querySelector('i').style.width = `${pct}%`;
  bar.className = pct > 88 ? 'crit' : pct > 65 ? 'warn' : '';
  $('#budget-text').textContent = `${usd(s.gasto)} / ${usd(s.limite)}`;
}

const usd = (v) => v == null ? '—' : (Math.abs(v) < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`);
const esc = (t) => String(t).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
