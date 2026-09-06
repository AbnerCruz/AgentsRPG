// main.js — bootstrap e interface. Canvas primeiro, controles só quando necessários.

import { openDB, put, get, getAll, exportZip, importZip } from './db.js';
import { OpenRouter } from './openrouter.js';
import { World, Renderer } from './world.js';
import { Agent } from './agent.js';
import { Director } from './director.js';
import { Budget } from './budget.js';
import { importPdf, listArtifacts, removeArtifact, CATEGORIAS, rotuloDe, corDe } from './artifacts.js';
import { rollDice } from './srd5e.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let cfg, or, world, rend, dir, budget;

// ---------------- boot ----------------
(async function boot() {
  await openDB();
  cfg = (await get('config', 'main')) || {
    id: 'main', apiKey: '', mgmtKey: '', caixaUSD: 0, sessoesPorSemana: 1,
    modeloAgentes: '', modeloMestre: '', modeloImagem: '', modo: 'mestre-ia',
    qtdAgentes: 3, playerAgentId: null, iniciada: false,
  };
  or = new OpenRouter({ apiKey: cfg.apiKey, managementKey: cfg.mgmtKey });
  budget = new Budget(cfg);

  wireCanvas(); wirePanel(); wireComposer(); wireSetup(); fillCategorySelects();

  // Retomada: basta ter chaves e elenco. Se o mapa se perdeu, gera um novo em vez de
  // jogar o jogador de volta para a tela de chaves (era o bug).
  const agents = await getAll('agents');
  if (cfg.apiKey && cfg.iniciada && agents.length) {
    try { await resume(); } catch (e) { $('#setup').hidden = false; bootLog(`falha ao retomar: ${e.message}`); }
  } else {
    $('#setup').hidden = false;
  }
})();

// ---------------- canvas ----------------
function wireCanvas() {
  const c = $('#stage');
  let drag = null;

  const down = (e) => {
    const p = e.touches ? e.touches[0] : e;
    drag = { x: p.clientX, y: p.clientY, cx: rend?.cam.x, cy: rend?.cam.y, moved: false };
  };
  const move = (e) => {
    if (!rend) return;
    const p = e.touches ? e.touches[0] : e;
    if (drag) {
      const dx = p.clientX - drag.x, dy = p.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      rend.cam.x = drag.cx - dx; rend.cam.y = drag.cy - dy;
      rend.draw();
    } else if (!e.touches) {
      rend.hoverCell = rend.screenToCell(p.clientX, p.clientY);
      rend.draw();
    }
  };
  const up = (e) => {
    if (rend && drag && !drag.moved) {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const cell = rend.screenToCell(p.clientX, p.clientY);
      const tok = world?.tokens.find(t => t.x === cell.x && t.y === cell.y);
      if (tok) showSheet(tok.id); else $('#sheet-pop').hidden = true;
    }
    drag = null;
  };

  c.addEventListener('mousedown', down); c.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('mousemove', move); c.addEventListener('touchmove', move, { passive: true });
  window.addEventListener('mouseup', up); c.addEventListener('touchend', up);
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
  if (!ag?.sheet) { pop.hidden = true; return; }
  const s = ag.sheet;
  pop.innerHTML = `
    <h3>${esc(s.nome)}</h3>
    <div class="sub">${s.raca} ${s.classe} · nível ${s.nivel} · PV ${s.pv_atual}/${s.pv_max} · CA ${s.ca}</div>
    <div class="attrs">${Object.entries(s.atributos).map(([k, v]) => `<div><span>${k.slice(0, 3)}</span><b>${v}</b></div>`).join('')}</div>
    <p>${esc(s.traco || '')}</p><p><em>${esc(s.objetivo || '')}</em></p>
    <p>Perícias: ${s.pericias.join(', ')}</p><p>Itens: ${s.inventario.join(', ')}</p>`;
  pop.hidden = false;
}

// ---------------- categorias de material ----------------
function fillCategorySelects() {
  const opts = Object.entries(CATEGORIAS).filter(([k]) => k !== 'nota')
    .map(([k, v]) => `<option value="${k}">${v.rotulo}</option>`).join('');
  for (const [selId, helpId] of [['#cat-sel', '#cat-help'], ['#s-cat', '#s-cat-help']]) {
    const sel = $(selId), help = $(helpId);
    if (!sel) continue;
    sel.innerHTML = opts;
    sel.value = 'regras';
    const upd = () => { if (help) help.textContent = CATEGORIAS[sel.value]?.ajuda || ''; };
    sel.onchange = upd; upd();
  }
}

// ---------------- painel ----------------
function wirePanel() {
  $('#btn-menu').onclick = async () => { $('#panel').hidden = false; await renderCast(); await renderArts(); await fillSettings(); };
  $('#panel-close').onclick = () => { $('#panel').hidden = true; };

  $$('.pnav').forEach(b => b.onclick = () => {
    $$('.pnav').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    ['elenco', 'acervo', 'ajustes'].forEach(p => { $(`#p-${p}`).hidden = (p !== b.dataset.p); });
  });

  $('.filedrop').onclick = () => $('#pdf-in').click();
  $('#pdf-in').onchange = (e) => ingest(e.target.files, $('#cat-sel').value, '#import-progress', '#import-label', renderArts);

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
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await exportZip());
    a.download = `mesa-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
  };
  $('#btn-import').onclick = () => $('#import-in').click();
  $('#import-in').onchange = async (e) => { if (e.target.files[0]) { await importZip(e.target.files[0]); location.reload(); } };

  $('#btn-end').onclick = async () => {
    if (!budget.session) return;
    feed('Sistema', 'Encerrando a sessão...', 'sistema');
    try { await dir.closingSummary(); } catch (e) { feed('Sistema', e.message, 'sistema'); }
    const r = await budget.finish();
    feed('Sistema', `Encerrada. Gasto ${usd(r.gasto)} · sobra ${usd(r.sobra)} volta ao caixa (${usd(r.caixa)}).`, 'sistema');
    await dir.saveWorld();
    $('#panel').hidden = true;
  };
}

async function renderCast() {
  const agents = await getAll('agents');
  $('#p-elenco').innerHTML = agents.map(a => `
    <div class="cast" data-id="${a.id}">
      <span class="dot" style="background:${a.color}"></span>
      <div><b>${esc(a.sheet?.nome || a.name)}</b>
      <small>${a.role === 'master' ? 'mestre' : `${a.sheet?.raca || ''} ${a.sheet?.classe || ''} · PV ${a.sheet?.pv_atual ?? '—'}`}</small></div>
    </div>`).join('') || '<small class="muted">Nenhum agente ainda.</small>';
  $$('#p-elenco .cast').forEach(el => el.onclick = () => { $('#panel').hidden = true; showSheet(el.dataset.id); });
}

async function renderArts() {
  const arts = await listArtifacts();
  const grupos = {};
  for (const a of arts) (grupos[a.tipo] ||= []).push(a);
  $('#art-list').innerHTML = Object.entries(grupos).map(([tipo, items]) => `
    <div class="artgroup">
      <h4 style="color:${corDe(tipo)}">${rotuloDe(tipo)} <span>${items.length}</span></h4>
      ${items.map(a => `<div class="art" style="border-color:${corDe(tipo)}">
        <div><b>${esc(a.titulo)}</b><small>${a.paginas ? `${a.paginas} páginas · ` : ''}${a.origem}</small></div>
        <button data-del="${a.id}">✕</button></div>`).join('')}
    </div>`).join('') || '<small class="muted">Acervo vazio. Anexe regras, uma aventura ou material de ambientação acima.</small>';
  $$('#art-list [data-del]').forEach(b => b.onclick = async () => { await removeArtifact(b.dataset.del); renderArts(); });
}

async function fillSettings() {
  $('#f-caixa').value = cfg.caixaUSD || '';
  $('#f-sessoes').value = cfg.sessoesPorSemana || 1;
  await fillModelSelects(['#f-m-agentes', '#f-m-mestre'], '#f-m-imagem');
}

// ---------------- importação com progresso ----------------
async function ingest(files, categoria, progressSel, labelSel, done) {
  if (!files?.length) return;
  const wrap = $(progressSel), bar = $(progressSel + ' .pbar i'), label = $(labelSel);
  wrap.hidden = false;
  let i = 0;
  for (const f of files) {
    i++;
    try {
      const res = await importPdf(f, categoria, (p, total, nome) => {
        bar.style.width = `${(p / total) * 100}%`;
        label.textContent = `${nome} — página ${p}/${total} (arquivo ${i}/${files.length})`;
      });
      label.textContent = `${f.name} → ${rotuloDe(res.tipo)} (${res.paginas} páginas)`;
    } catch (e) { label.textContent = `Falha em ${f.name}: ${e.message}`; }
  }
  setTimeout(() => { wrap.hidden = true; bar.style.width = '0'; }, 1800);
  await done?.();
}

// ---------------- setup ----------------
function wireSetup() {
  const step = n => $$('.step').forEach(s => s.classList.toggle('active', +s.dataset.step === n));

  $('#s-next0').onclick = async () => {
    const api = $('#s-api').value.trim(), mgmt = $('#s-mgmt').value.trim();
    if (!api) { $('#s-err0').textContent = 'A API key é obrigatória.'; return; }
    $('#s-err0').textContent = 'conectando...';
    or.setKeys({ apiKey: api, managementKey: mgmt });
    try {
      const b = await or.balance({ force: true });
      cfg.apiKey = api; cfg.mgmtKey = mgmt;
      await put('config', cfg);           // salva as chaves já aqui
      $('#s-saldo').textContent = usd(b.available);
      $('#s-caixa').value = (b.available * 0.5).toFixed(2);
      $('#s-err0').textContent = '';
      await fillModelSelects(['#s-m-agentes', '#s-m-mestre'], '#s-m-imagem');
      step(1);
    } catch (e) { $('#s-err0').textContent = e.message; }
  };

  $('#s-next1').onclick = async () => {
    cfg.caixaUSD = parseFloat($('#s-caixa').value || 0);
    cfg.sessoesPorSemana = +$('#s-sessoes').value;
    await put('config', cfg);
    step(2);
  };

  $('#s-next2').onclick = async () => {
    cfg.modeloAgentes = $('#s-m-agentes').value;
    cfg.modeloMestre = $('#s-m-mestre').value;
    cfg.modeloImagem = $('#s-m-imagem').value;
    await put('config', cfg);
    step(3);
  };

  $$('.choice').forEach(b => b.onclick = () => {
    $$('.choice').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    cfg.modo = b.dataset.modo;
  });
  $$('.choice')[0].classList.add('on');

  $('#s-pdf').onchange = (e) => ingest(e.target.files, $('#s-cat').value, '#s-progress', '#s-plabel');

  $('#s-start').onclick = async () => {
    cfg.qtdAgentes = +$('#s-qtd').value;
    await put('config', cfg);
    $('#s-start').disabled = true;
    try {
      await startCampaign();
    } catch (e) {
      bootLog(`ERRO: ${e.message}`);
      $('#s-start').disabled = false;
      $('#s-start').textContent = 'Tentar de novo';
    }
  };
}

async function fillModelSelects(textSels, imgSel) {
  try {
    const { pagos, gratis } = await or.textModels();
    const imgs = await or.imageModels();
    const sug = await or.suggest();

    const opt = m => `<option value="${m.id}">${esc(m.name)} — $${(m.inPrice * 1e6).toFixed(2)}/M in · $${(m.outPrice * 1e6).toFixed(2)}/M out</option>`;
    const optFree = m => `<option value="${m.id}">${esc(m.name)} — grátis</option>`;
    const groups = `<optgroup label="Pagos (do mais barato)">${pagos.map(opt).join('')}</optgroup>` +
      (gratis.length ? `<optgroup label="Gratuitos — limite de uso, evite em sessão longa">${gratis.map(optFree).join('')}</optgroup>` : '');

    for (const sel of textSels) {
      const el = $(sel); if (!el) continue;
      el.innerHTML = groups;
      const atual = sel.includes('mestre') ? cfg.modeloMestre : cfg.modeloAgentes;
      const alvo = [...pagos, ...gratis].some(m => m.id === atual) ? atual : (sel.includes('mestre') ? sug.mestre : sug.agentes);
      el.value = alvo;
    }

    const ie = $(imgSel);
    if (ie) {
      ie.innerHTML = imgs.length
        ? imgs.map(m => `<option value="${m.id}">${esc(m.name)}${m.imgPrice ? ` — $${m.imgPrice.toFixed(4)}/img` : ''}</option>`).join('') + '<option value="">nenhum (desligar imagens)</option>'
        : '<option value="">nenhum modelo de imagem disponível nesta conta</option>';
      ie.value = imgs.some(m => m.id === cfg.modeloImagem) ? cfg.modeloImagem : (sug.imagem || '');
    }
    const help = $('#s-m-help');
    if (help) help.textContent = imgs.length ? `${imgs.length} modelos de imagem disponíveis. O mais barato já vem selecionado.` : 'Nenhum modelo de imagem nesta conta.';
  } catch (e) { bootLog(`modelos: ${e.message}`); }
}

function bootLog(t) {
  const el = $('#boot-log'); if (!el) return;
  const d = document.createElement('div'); d.textContent = t; el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

// ---------------- início e retomada ----------------
async function startCampaign() {
  bootLog('gerando cenário...');
  world = World.generate('masmorra');
  world.nome = 'Sala inicial';
  rend = new Renderer($('#stage'), world);
  rend.resize();

  bootLog('criando o mestre...');
  await new Agent({ name: 'Mestre', role: 'master', model: cfg.modeloMestre }).save();

  const amb = (await listArtifacts('ambientacao'))[0] || (await listArtifacts('aventura'))[0];
  const grupo = [];

  for (let i = 0; i < cfg.qtdAgentes; i++) {
    bootLog(`criando personagem ${i + 1}/${cfg.qtdAgentes}...`);
    const ag = new Agent({ name: `Agente ${i + 1}`, role: 'pc', model: cfg.modeloAgentes });
    await ag.save();
    await ag.buildSheet(or, { ambientacao: amb?.titulo || '', grupo });
    grupo.push(`${ag.sheet.nome} (${ag.sheet.raca} ${ag.sheet.classe})`);
    world.addToken({ id: ag.id, name: ag.sheet.nome, kind: 'pc', color: ag.color, visionRadius: Math.round(ag.sheet.visao / 1.5) });
    bootLog(`  → ${ag.sheet.nome}, ${ag.sheet.raca} ${ag.sheet.classe}`);
  }

  if (cfg.modo === 'mestre-ia') {
    cfg.playerAgentId = (await getAll('agents')).find(a => a.role === 'pc')?.id || null;
  }
  world.updateExplored();

  // Persistir ANTES de qualquer chamada de IA: se a abertura falhar, a campanha não se perde.
  cfg.iniciada = true;
  await put('config', cfg);
  await put('world', world.serialize());

  await launch();

  bootLog('abrindo a cena...');
  try {
    await dir.openCampaign();
    await dir.saveWorld();
  } catch (e) {
    bootLog(`o mestre falhou ao abrir: ${e.message}`);
    feed('Sistema', `O mestre não respondeu (${e.message}). Escreva algo para tentar de novo.`, 'sistema');
  }
  $('#setup').hidden = true;
}

async function resume() {
  const saved = await get('world', 'current');
  world = saved ? World.deserialize(saved) : World.generate('masmorra');
  if (!saved) {
    // mapa perdido, elenco intacto: recoloca os tokens em vez de reiniciar tudo
    for (const a of (await getAll('agents')).filter(x => x.role === 'pc')) {
      world.addToken({ id: a.id, name: a.sheet?.nome || a.name, kind: 'pc', color: a.color, visionRadius: 8 });
    }
    world.updateExplored();
    await put('world', world.serialize());
  }
  rend = new Renderer($('#stage'), world);
  rend.resize();
  await launch();
  feed('Sistema', 'Campanha retomada.', 'sistema');
}

async function launch() {
  or.startAutoSync();
  or.onBalance = b => { const el = $('#saldo-live'); if (el) el.textContent = usd(b.available); };

  dir = new Director({
    or, cfg, world,
    onEvent: (tipo, p) => {
      if (tipo === 'log') feed(p.speaker, p.text, p.kind);
      else if (tipo === 'redraw') rend.draw();
      else if (tipo === 'mapa') { rend.world = world; $('#scene-name').textContent = p.nome; rend.draw(); }
      else if (tipo === 'artefato') feed('Acervo', `Novo registro: ${p.titulo}`, 'sistema');
      else if (tipo === 'checkBudget') return budget.mustClose();
    },
    onCost: (c, t) => { budget.register(c, t); updateBudget(); if (budget.mustClose()) forceClose(); },
  });
  await dir.loadCast();

  const focus = cfg.modo === 'mestre-ia' ? cfg.playerAgentId : world.tokens[0]?.id;
  rend.focusId = focus || null;
  rend.centerOn(world.tokenOf(focus));
  rend.draw();

  const bal = await or.balance().catch(() => ({ available: cfg.caixaUSD }));
  budget.start({ saldoProvedor: bal.available, modeloMestrePrice: or.priceOf(cfg.modeloMestre) });
  updateBudget();
  $('#scene-name').textContent = world.nome;

  if (cfg.modo === 'so-ia') {
    $('#say').hidden = true; $('#btn-send').hidden = true; $('#btn-play').hidden = false;
    $('#btn-play').onclick = async () => {
      dir.running = !dir.running;
      $('#btn-play').textContent = dir.running ? '❚❚' : '▶';
      if (dir.running) { try { await dir.loop(); } catch (e) { feed('Sistema', e.message, 'sistema'); dir.running = false; $('#btn-play').textContent = '▶'; } }
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
  try { await dir.closingSummary(); } catch (e) { feed('Sistema', e.message, 'sistema'); }
  const r = await budget.finish();
  feed('Sistema', `Encerrada. Gasto ${usd(r.gasto)} · sobra ${usd(r.sobra)} volta ao caixa.`, 'sistema');
  await dir.saveWorld();
  $('#say').disabled = true;
  closing = false;
}

// ---------------- entrada ----------------
function wireComposer() {
  const send = async () => {
    const v = $('#say').value.trim();
    if (!v || !dir) return;
    $('#say').value = '';
    if (v.startsWith('/')) {
      try { const d = rollDice(v.slice(1)); feed('Dados', `${d.notation} → [${d.rolls.join(', ')}] = ${d.total}`, 'dados'); }
      catch { feed('Sistema', 'Notação inválida. Ex: /1d20+3', 'sistema'); }
      return;
    }
    $('#say').disabled = true;
    try { await dir.runTurn(v); await dir.saveWorld(); }
    catch (e) { feed('Sistema', e.message, 'sistema'); }
    $('#say').disabled = false; $('#say').focus();
  };
  $('#btn-send').onclick = send;
  $('#say').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

// ---------------- utilidades ----------------
function feed(who, text, kind = 'fala') {
  const el = document.createElement('div');
  el.className = `line ${kind}`;
  el.innerHTML = ['narracao', 'sistema', 'dados'].includes(kind)
    ? `<span class="${kind}">${esc(text)}</span>`
    : `<span class="who">${esc(who)}</span> ${esc(text)}`;
  $('#feed').appendChild(el);
  $('#feed').scrollTop = $('#feed').scrollHeight;
  while ($('#feed').children.length > 60) $('#feed').firstChild.remove();
}

function updateBudget() {
  const s = budget.session; if (!s) return;
  const pct = budget.pct(), bar = $('#budget-bar');
  bar.querySelector('i').style.width = `${pct}%`;
  bar.className = pct > 88 ? 'crit' : pct > 65 ? 'warn' : '';
  $('#budget-text').textContent = `${usd(s.gasto)} / ${usd(s.limite)}`;
}

const usd = v => v == null ? '—' : (Math.abs(v) < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`);
const esc = t => String(t).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
