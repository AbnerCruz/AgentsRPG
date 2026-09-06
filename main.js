// main.js — bootstrap da aplicação e wiring de UI. Sem framework: DOM puro.

import { openDB, put, get, getAll, del, uid, exportAllToZip, importFromZipFile } from './db.js';
import { OpenRouterClient } from './openrouter.js';
import { estimateTokens, fmtUSD } from './tokens.js';
import { MemoryStore } from './memory.js';
import { Agent } from './agent.js';
import { SRD5E, abilityModifier } from './srd5e.js';
import { rollDice, extractPdfText, findRelevantExcerpts, getCachedRule, setCachedRule } from './rules.js';
import { SessionController } from './session.js';
import { GridMap, saveArtifact, listArtifacts, deleteArtifact, saveGeneratedImage } from './tools.js';

let cfg = null;
let orClient = null;
let sessionCtrl = null;
let gridMap = null;
let modelsCache = [];

const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function boot() {
  await openDB();
  cfg = await SessionController.loadConfig();
  orClient = new OpenRouterClient({ apiKey: cfg.apiKey, managementKey: cfg.managementKey });
  sessionCtrl = new SessionController({ config: cfg });

  wireTabs();
  wireConfigScreen();
  wireSessionZero();
  wireTable();
  wireMemoryViewer();
  wireArtifacts();
  wireExportImport();

  fillConfigForm();
  await refreshAgentsList();
  await refreshArtifactsList();
}

// ---------- Navegação por abas ----------
function wireTabs() {
  $all('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $all('.tab-btn').forEach(b => b.classList.remove('active'));
      $all('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---------- Configuração ----------
function fillConfigForm() {
  $('#cfg-api-key').value = cfg.apiKey || '';
  $('#cfg-mgmt-key').value = cfg.managementKey || '';
  $('#cfg-caixa').value = cfg.caixaTotalUSD || 0;
  $('#cfg-sessoes-semana').value = cfg.sessoesPorSemana || 1;
  $('#cfg-modelo-agentes').value = cfg.modeloAgentes || 'openai/gpt-oss-20b';
  $('#cfg-modelo-mestre').value = cfg.modeloMestre || 'openai/gpt-oss-120b';
  $('#cfg-modelo-imagem').value = cfg.modeloImagem || '';
  $('#cfg-sistema').value = cfg.sistemaRegras || 'dnd5e-srd';
}

function wireConfigScreen() {
  $('#btn-save-config').addEventListener('click', async () => {
    cfg.apiKey = $('#cfg-api-key').value.trim();
    cfg.managementKey = $('#cfg-mgmt-key').value.trim();
    cfg.caixaTotalUSD = parseFloat($('#cfg-caixa').value || '0');
    cfg.sessoesPorSemana = parseInt($('#cfg-sessoes-semana').value || '1', 10);
    cfg.modeloAgentes = $('#cfg-modelo-agentes').value.trim();
    cfg.modeloMestre = $('#cfg-modelo-mestre').value.trim();
    cfg.modeloImagem = $('#cfg-modelo-imagem').value.trim();
    cfg.sistemaRegras = $('#cfg-sistema').value;
    await SessionController.saveConfig(cfg);
    orClient.setKeys({ apiKey: cfg.apiKey, managementKey: cfg.managementKey });
    setStatus('#cfg-status', 'Configuração salva localmente no navegador.', 'ok');
  });

  $('#btn-sync-balance').addEventListener('click', async () => {
    setStatus('#cfg-status', 'Consultando saldo na OpenRouter...', 'info');
    try {
      const credits = await orClient.getCredits();
      $('#cfg-saldo-real').textContent = fmtUSD(credits.available);
      setStatus('#cfg-status', `Saldo disponível na OpenRouter: ${fmtUSD(credits.available)}. Defina o caixa do site com valor igual ou menor.`, 'ok');
      if (cfg.caixaTotalUSD > credits.available) {
        setStatus('#cfg-status', `Atenção: o caixa configurado (${fmtUSD(cfg.caixaTotalUSD)}) é maior que o saldo real disponível.`, 'warn');
      }
    } catch (e) {
      setStatus('#cfg-status', e.message, 'error');
    }
  });

  $('#btn-load-models').addEventListener('click', async () => {
    setStatus('#cfg-status', 'Carregando lista de modelos...', 'info');
    try {
      modelsCache = await orClient.listModels();
      renderModelMetrics();
      setStatus('#cfg-status', `${modelsCache.length} modelos carregados. Métricas de custo abaixo.`, 'ok');
    } catch (e) {
      setStatus('#cfg-status', e.message, 'error');
    }
  });
}

function renderModelMetrics() {
  const wanted = [cfg.modeloAgentes, cfg.modeloMestre, cfg.modeloImagem].filter(Boolean);
  const rows = modelsCache.filter(m => wanted.includes(m.id));
  const tbody = $('#model-metrics-body');
  tbody.innerHTML = '';
  for (const m of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.id}</td><td>${m.contextLength ?? '—'}</td>
      <td>$${Number(m.pricing?.prompt || 0).toFixed(8)}</td>
      <td>$${Number(m.pricing?.completion || 0).toFixed(8)}</td>
      <td>${m.modality}</td>`;
    tbody.appendChild(tr);
  }
}

function setStatus(sel, text, kind = 'info') {
  const el = $(sel);
  el.textContent = text;
  el.className = `status status-${kind}`;
}

// ---------- Sessão Zero (upload de PDFs, geração de ficha/regras) ----------
function wireSessionZero() {
  $('#btn-process-pdfs').addEventListener('click', async () => {
    const files = $('#s0-pdf-input').files;
    if (!files.length) { setStatus('#s0-status', 'Anexe pelo menos um PDF.', 'warn'); return; }
    setStatus('#s0-status', 'Extraindo texto dos PDFs (sem custo de IA nesta etapa)...', 'info');
    const rulesetId = cfg.sistemaRegras === 'custom' ? 'custom' : 'dnd5e-srd';
    let totalPages = 0;
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const { pages } = await extractPdfText(buf);
      totalPages += pages.length;
      await setCachedRule(rulesetId, `pdf::${file.name}`, { pages, uploadedAt: Date.now() });
    }
    setStatus('#s0-status', `${files.length} PDF(s) processados (${totalPages} páginas). Regras extraídas ficam em cache — só são lidas de novo se precisar buscar algo novo.`, 'ok');
  });

  $('#btn-generate-template').addEventListener('click', async () => {
    if (cfg.sistemaRegras !== 'custom') {
      setStatus('#s0-status', 'Sistema padrão D&D 5e (SRD) selecionado: o template de ficha já está embutido, sem gasto de IA.', 'ok');
      renderSheetTemplatePreview(SRD5E.characterSheetTemplate);
      return;
    }
    // Sistema customizado: procura template já extraído; não achando, busca nas regras e propõe.
    setStatus('#s0-status', 'Procurando template de ficha nos PDFs anexados...', 'info');
    const cached = await getCachedRule('custom', 'sheet_template');
    if (cached) {
      renderSheetTemplatePreview(cached.value);
      setStatus('#s0-status', 'Template de ficha encontrado em cache.', 'ok');
      return;
    }
    setStatus('#s0-status', 'Nenhum template em cache — não é possível gerar sem chamar a IA sobre os PDFs já extraídos na etapa anterior. Extraia os PDFs primeiro.', 'warn');
  });
}

function renderSheetTemplatePreview(template) {
  const container = $('#s0-template-preview');
  container.innerHTML = '<h4>Template de ficha</h4>';
  const ul = document.createElement('ul');
  for (const f of template.fields) {
    const li = document.createElement('li');
    li.textContent = `${f.label} (${f.type})`;
    ul.appendChild(li);
  }
  container.appendChild(ul);
}

// ---------- Mesa (sessão ativa, agentes, chat, dados, mapa) ----------
async function refreshAgentsList() {
  const agents = await getAll('agents');
  const list = $('#agents-list');
  list.innerHTML = '';
  for (const a of agents) {
    const div = document.createElement('div');
    div.className = 'agent-card';
    div.innerHTML = `<strong>${a.name}</strong> <span class="tag">${a.role}</span><br><small>${a.model}</small>`;
    list.appendChild(div);
  }
}

function wireTable() {
  $('#btn-new-agent').addEventListener('click', async () => {
    const name = $('#new-agent-name').value.trim();
    const role = $('#new-agent-role').value;
    if (!name) return;
    const model = role === 'master' ? cfg.modeloMestre : (role === 'assistant' ? cfg.modeloMestre : cfg.modeloAgentes);
    const agent = new Agent({ name, role, model, sheet: {} });
    await agent.save();
    $('#new-agent-name').value = '';
    await refreshAgentsList();
    setStatus('#table-status', `Agente "${name}" criado (${role}).`, 'ok');
  });

  $('#btn-start-session').addEventListener('click', async () => {
    try {
      const credits = await orClient.getCredits();
      const caixaRestante = Math.min(cfg.caixaTotalUSD, credits.available);
      const masterPricing = modelsCache.find(m => m.id === cfg.modeloMestre)?.pricing;
      const s = await sessionCtrl.startSession({
        caixaRestanteUSD: caixaRestante,
        sessoesRestantes: cfg.sessoesPorSemana,
        masterModelPricing: masterPricing,
      });
      setStatus('#table-status', `Sessão iniciada. Limite desta sessão: ${fmtUSD(s.limiteSessaoUSD)} (reserva de fechamento: ${fmtUSD(s.reservaFechamentoUSD)}).`, 'ok');
      renderSessionMetrics();
    } catch (e) {
      setStatus('#table-status', e.message, 'error');
    }
  });

  $('#btn-send-input').addEventListener('click', handleSceneInput);

  $('#btn-roll-dice').addEventListener('click', () => {
    const notation = $('#dice-notation').value.trim() || '1d20';
    try {
      const result = rollDice(notation);
      appendLog(`🎲 ${notation}: [${result.rolls.join(', ')}]${result.mod ? (result.mod > 0 ? '+' + result.mod : result.mod) : ''} = ${result.total}`);
    } catch (e) {
      setStatus('#table-status', e.message, 'error');
    }
  });

  $('#btn-init-map').addEventListener('click', () => {
    const canvas = $('#grid-canvas');
    gridMap = new GridMap(canvas, { cols: 20, rows: 14, cellSize: 30 });
    gridMap.render();
  });

  $('#btn-add-token').addEventListener('click', () => {
    if (!gridMap) return;
    const name = $('#token-name').value.trim() || '?';
    gridMap.addToken({ name, x: 0, y: 0, speedMeters: 9 });
    $('#token-name').value = '';
  });

  $('#btn-finish-session').addEventListener('click', async () => {
    if (!sessionCtrl.current) return;
    const credits = await orClient.getCredits().catch(() => null);
    const caixaAtual = credits ? Math.min(cfg.caixaTotalUSD, credits.available) : cfg.caixaTotalUSD;
    const { sessionSummary, sobraUSD, novoCaixaUSD } = await sessionCtrl.finishSession({ caixaAtualUSD: caixaAtual });
    cfg.caixaTotalUSD = novoCaixaUSD;
    await SessionController.saveConfig(cfg);
    setStatus('#table-status', `Sessão encerrada. Gasto: ${fmtUSD(sessionSummary.gastoAcumuladoUSD)} | Sobra devolvida ao caixa: ${fmtUSD(sobraUSD)} | Novo caixa: ${fmtUSD(novoCaixaUSD)}.`, 'ok');
    renderSessionMetrics();
  });
}

function renderSessionMetrics() {
  const m = sessionCtrl.getMetrics();
  const el = $('#session-metrics');
  if (!m) { el.textContent = 'Nenhuma sessão ativa.'; return; }
  el.innerHTML = `
    Status: <strong>${m.status}</strong> |
    Gasto: ${fmtUSD(m.gastoAcumuladoUSD)} / ${fmtUSD(m.limiteSessaoUSD)} (${m.pctUsado.toFixed(1)}%) |
    Restante até o fechamento forçado: ${fmtUSD(m.restanteAntesDoFechamentoUSD)} |
    Chamadas de IA: ${m.totalChamadas}
  `;
}

async function handleSceneInput() {
  const input = $('#scene-input').value.trim();
  if (!input) return;
  if (!sessionCtrl.current) { setStatus('#table-status', 'Inicie uma sessão primeiro.', 'warn'); return; }

  appendLog(`🧑 Jogador: ${input}`);
  $('#scene-input').value = '';

  const agents = (await getAll('agents')).map(a => new Agent(a));
  const master = agents.find(a => a.role === 'master');
  const sceneContext = $('#scene-context').value || '(início da sessão)';

  const forceClosing = sessionCtrl.shouldForceClosingSummary();

  if (master) {
    await runAgentTurn(master, sceneContext, input, forceClosing);
    if (forceClosing) {
      setStatus('#table-status', 'Limite artificial atingido: resumo de fechamento gerado. Sessão pronta para encerrar.', 'warn');
      return;
    }
  }

  if (!forceClosing) {
    for (const a of agents.filter(a => a.role === 'player')) {
      await runAgentTurn(a, sceneContext, input, false);
    }
  }
  renderSessionMetrics();
}

async function runAgentTurn(agent, sceneContext, input, forceClosing) {
  const extraSystem = forceClosing
    ? 'ATENÇÃO: o limite de tokens desta sessão foi atingido. Gere APENAS um resumo de fechamento da cena atual (o que aconteceu, onde os personagens ficaram, ganchos pendentes) para catalogar como memória. Não avance a história.'
    : '';
  const result = await agent.act(orClient, { sceneContext, incomingInput: input, extraSystem, maxTokens: forceClosing ? 350 : 450 });
  appendLog(`${agent.role === 'master' ? '🎭 Mestre' : '🧝 ' + agent.name}: ${result.text}`);

  const pricing = modelsCache.find(m => m.id === agent.model)?.pricing;
  const custoUSD = OpenRouterClient.estimateCostUSD(pricing, result.promptTokens, result.completionTokens);
  await sessionCtrl.registerCall({ agentId: agent.id, modelId: agent.model, promptTokens: result.promptTokens, completionTokens: result.completionTokens, custoUSD });

  // registra o turno como memória do próprio agente (curta+longa via IA, uma vez)
  await agent.remember(orClient, `${forceClosing ? '[Resumo de fechamento] ' : ''}Cena: ${sceneContext}. Input: ${input}. Resposta: ${result.text}`);
}

function appendLog(text) {
  const log = $('#scene-log');
  const p = document.createElement('p');
  p.textContent = text;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

// ---------- Memória ----------
function wireMemoryViewer() {
  $('#btn-load-memories').addEventListener('click', async () => {
    const agents = await getAll('agents');
    const select = $('#mem-agent-select');
    select.innerHTML = agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  });
  $('#btn-show-memories').addEventListener('click', async () => {
    const agentId = $('#mem-agent-select').value;
    if (!agentId) return;
    const store = new MemoryStore(agentId);
    const shorts = await store.allShort();
    const el = $('#memories-output');
    el.innerHTML = shorts.map(m => `<div class="mem-card"><strong>${m.tags.join(', ')}</strong><p>${m.text}</p></div>`).join('') || '<p>Sem memórias ainda.</p>';
  });
}

// ---------- Artefatos ----------
async function refreshArtifactsList() {
  const artifacts = await listArtifacts();
  const el = $('#artifacts-list');
  el.innerHTML = artifacts.map(a => `<div class="artifact-card" data-id="${a.id}">
    <strong>${a.title}</strong> <span class="tag">${a.type}</span>
    <div class="artifact-actions"><button data-edit="${a.id}">Editar</button><button data-del="${a.id}">Excluir</button></div>
  </div>`).join('') || '<p>Nenhum artefato ainda.</p>';

  $all('[data-edit]', el).forEach(btn => btn.addEventListener('click', () => editArtifact(btn.dataset.edit, artifacts)));
  $all('[data-del]', el).forEach(btn => btn.addEventListener('click', async () => { await deleteArtifact(btn.dataset.del); await refreshArtifactsList(); }));
}

function editArtifact(id, artifacts) {
  const art = artifacts.find(a => a.id === id);
  if (!art) return;
  $('#art-id').value = art.id;
  $('#art-title').value = art.title;
  $('#art-type').value = art.type;
  $('#art-content').value = typeof art.content === 'string' ? art.content : JSON.stringify(art.content, null, 2);
}

function wireArtifacts() {
  $('#btn-save-artifact').addEventListener('click', async () => {
    const id = $('#art-id').value || undefined;
    const title = $('#art-title').value.trim();
    const type = $('#art-type').value;
    const content = $('#art-content').value;
    if (!title) return;
    await saveArtifact({ id, type, title, content });
    $('#art-id').value = ''; $('#art-title').value = ''; $('#art-content').value = '';
    await refreshArtifactsList();
  });

  $('#btn-generate-image').addEventListener('click', async () => {
    const prompt = $('#img-prompt').value.trim();
    if (!prompt || !cfg.modeloImagem) { setStatus('#table-status', 'Defina o prompt e o modelo de imagem nas configurações.', 'warn'); return; }
    setStatus('#table-status', 'Gerando imagem...', 'info');
    try {
      const { images } = await orClient.generateImage(prompt, { model: cfg.modeloImagem });
      if (images[0]) {
        await saveGeneratedImage({ title: prompt.slice(0, 60), dataUrl: images[0], promptUsed: prompt });
        await refreshArtifactsList();
        setStatus('#table-status', 'Imagem gerada e salva no acervo de artefatos.', 'ok');
      } else {
        setStatus('#table-status', 'O modelo não retornou imagem.', 'warn');
      }
    } catch (e) {
      setStatus('#table-status', e.message, 'error');
    }
  });
}

// ---------- Export / Import ----------
function wireExportImport() {
  $('#btn-export').addEventListener('click', async () => {
    const blob = await exportAllToZip();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mesa-rpg-ia-save-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
  });

  $('#btn-import').addEventListener('click', () => $('#import-file-input').click());
  $('#import-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importFromZipFile(file);
    setStatus('#table-status', 'Save importado. Recarregando...', 'ok');
    setTimeout(() => location.reload(), 800);
  });
}

boot();
