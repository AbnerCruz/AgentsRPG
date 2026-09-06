// director.js — a orquestração da mesa. Adapta-se inteiramente ao modo escolhido:
//   'mestre-ia'  → IA narra, jogador tem um personagem, agentes completam o grupo
//   'mestre-eu'  → jogador narra; um agente auxiliar traduz a narração para os agentes
//   'so-ia'      → ninguém humano joga; loop automático com play/pause
//
// O mestre pode acionar FERRAMENTAS REAIS do site via JSON: gerar mapa, criar artefato,
// pedir rolagem, mover NPC. Ele não desenha nem inventa ferramenta — ele requisita.

import { put, getAll, uid } from './db.js';
import { World } from './world.js';
import { SceneBuffer } from './memory.js';
import { Agent, clean } from './agent.js';
import { rollDice } from './srd5e.js';
import { saveArtifact, findArtifact } from './artifacts.js';

const MASTER_TOOLS = `Você narra e conduz. Responda SOMENTE JSON:
{"narracao":"...","mapa":{"tipo":"masmorra|caverna|floresta|vila","nome":"..."}|null,"artefato":{"tipo":"npc|local|item|gancho|aventura","titulo":"...","conteudo":"..."}|null,"rolagem":"1d20+3"|null,"paraQuem":["nome"]|null}
"narracao" = 2-4 frases vivas, no presente, descrevendo o que acontece e o que o grupo percebe. Sem meta-comentário.
"mapa" só quando o grupo muda de cenário. "artefato" só quando surge algo que merece registro permanente.
Nunca repita descrições já ditas. Reaja ao que os personagens acabaram de fazer.`;

export class Director {
  constructor({ or, cfg, world, onEvent, onCost }) {
    this.or = or;
    this.cfg = cfg;
    this.world = world;
    this.scene = new SceneBuffer(12);
    this.onEvent = onEvent;   // (tipo, payload) → UI
    this.onCost = onCost;     // (custoUSD, tokens) → orçamento
    this.master = null;
    this.players = [];
    this.playerAgent = null;  // personagem do jogador humano (quando existe)
    this.running = false;
    this.turnIndex = 0;
    this.sceneName = 'Início';
  }

  log(speaker, text, kind = 'fala') {
    this.scene.push(speaker, kind, text);
    this.onEvent?.('log', { speaker, text, kind });
  }

  bill(r) { this.onCost?.(r.cost || 0, (r.inTokens || 0) + (r.outTokens || 0)); }

  async loadCast() {
    const all = (await getAll('agents')).map(a => new Agent(a));
    this.master = all.find(a => a.role === 'master') || null;
    this.players = all.filter(a => a.role === 'pc');
    this.playerAgent = this.cfg.modo === 'mestre-ia' ? this.players.find(a => a.id === this.cfg.playerAgentId) || null : null;
  }

  // ---- Abertura: o mestre CONSULTA se já existe aventura antes de inventar ----
  async openCampaign() {
    if (this.cfg.modo === 'mestre-eu') {
      this.log('Sistema', 'Você é o mestre. Narre a cena de abertura no campo abaixo.', 'sistema');
      return;
    }
    const existente = await findArtifact('aventura');
    const contexto = await this._campaignContext();

    const instr = existente
      ? `Já existe uma aventura registrada. Retome-a exatamente de onde parou, sem recriar nada:\n${trim(existente.conteudo, 1200)}`
      : `Não há aventura registrada. Crie a premissa inicial desta campanha e registre-a como artefato (tipo "aventura"), depois abra a primeira cena.`;

    const r = await this.or.chat([
      { role: 'system', content: `${MASTER_TOOLS}\n\nMaterial de apoio disponível:\n${contexto || '(nenhum material anexado — use fantasia medieval padrão do SRD 5e)'}` },
      { role: 'user', content: `${instr}\n\nGrupo: ${this.players.map(p => `${p.sheet?.nome || p.name} (${p.sheet?.raca} ${p.sheet?.classe})`).join('; ') || 'ainda sem personagens'}.` },
    ], { model: this.cfg.modeloMestre, maxTokens: 480, json: true });
    this.bill(r);
    await this._applyMaster(r);
  }

  async _campaignContext() {
    const arts = await getAll('artifacts');
    const refs = arts.filter(a => ['regras', 'ambientacao', 'aventura', 'gancho'].includes(a.tipo)).slice(0, 6);
    return refs.map(a => `[${a.tipo}] ${a.titulo}: ${trim(a.conteudo, 400)}`).join('\n');
  }

  // Executa o que o mestre requisitou: mapa, artefato, rolagem.
  async _applyMaster(r) {
    let o;
    try { o = JSON.parse(clean(r.text)); } catch { o = { narracao: r.text }; }

    if (o.mapa?.tipo) {
      const w = World.generate(o.mapa.tipo, { cols: this.world.cols, rows: this.world.rows });
      w.nome = o.mapa.nome || o.mapa.tipo;
      for (const t of this.world.tokens) w.addToken({ ...t, x: w.spawn.x, y: w.spawn.y });
      Object.assign(this.world, w);
      this.sceneName = w.nome;
      this.onEvent?.('mapa', { nome: w.nome, tipo: w.tipo });
    }

    if (o.artefato?.titulo) {
      const id = await saveArtifact({ tipo: o.artefato.tipo || 'nota', titulo: o.artefato.titulo, conteudo: o.artefato.conteudo || '', origem: 'mestre' });
      this.onEvent?.('artefato', { id, titulo: o.artefato.titulo, tipo: o.artefato.tipo });
    }

    if (o.narracao) this.log('Mestre', o.narracao, 'narracao');

    if (o.rolagem) {
      try {
        const d = rollDice(o.rolagem);
        this.log('Dados', `${d.notation} → [${d.rolls.join(', ')}] = ${d.total}`, 'dados');
      } catch { /* notação inválida do modelo: ignora silenciosamente */ }
    }
    return o;
  }

  // ---- Um turno completo da mesa ----
  async runTurn(playerInput = null) {
    if (this.cfg.modo === 'mestre-eu') return this._turnPlayerMaster(playerInput);
    return this._turnAiMaster(playerInput);
  }

  async _turnAiMaster(playerInput) {
    if (playerInput) {
      const nome = this.playerAgent?.sheet?.nome || 'Você';
      this.log(nome, playerInput, 'jogador');
    }

    // 1) Agentes agem — cada um lê o que os outros acabaram de fazer (contexto compartilhado)
    for (const ag of this.players) {
      if (this.playerAgent && ag.id === this.playerAgent.id) continue; // o humano joga esse
      if (!this.running && this.cfg.modo === 'so-ia') break;
      const tok = this.world.tokens.find(t => t.id === ag.id);
      const vision = tok ? this.world.describeVision(ag.id) : 'Ainda não posicionado.';
      const r = await ag.act(this.or, {
        scene: this.sceneName,
        vision,
        sceneLog: this.scene.render(ag.sheet?.nome || ag.name),
      });
      this.bill(r);
      const a = r.action;
      if (a.mover && tok) {
        const mv = this.world.moveToken(ag.id, a.mover.x, a.mover.y);
        if (mv.ok) this.onEvent?.('mover', { id: ag.id });
      }
      if (a.fala) this.log(ag.sheet?.nome || ag.name, a.fala + (a.acao ? ` [${a.acao}]` : ''), 'fala');
      this.world.updateExplored();
      this.onEvent?.('redraw');
    }

    // 2) Mestre reage a tudo que aconteceu na rodada
    const r = await this.or.chat([
      { role: 'system', content: MASTER_TOOLS },
      { role: 'user', content: `Cena: ${this.sceneName}\n\nRodada:\n${this.scene.render()}\n\nNarre o desdobramento.` },
    ], { model: this.cfg.modeloMestre, maxTokens: 400, json: true });
    this.bill(r);
    await this._applyMaster(r);
    this.turnIndex++;
  }

  // Jogador é o mestre: o auxiliar traduz a narração dele para instrução aos agentes.
  async _turnPlayerMaster(narration) {
    if (!narration) return;
    this.log('Mestre (você)', narration, 'narracao');

    const aux = await this.or.chat([
      { role: 'system', content: `Você é o auxiliar do mestre humano. Traduza a narração dele em instrução objetiva para os personagens jogadores, sem inventar eventos novos. Responda SOMENTE JSON: {"instrucao":"...","paraQuem":["nome"]|null}` },
      { role: 'user', content: `Personagens em cena: ${this.players.map(p => p.sheet?.nome || p.name).join(', ')}\n\nNarração do mestre: ${narration}` },
    ], { model: this.cfg.modeloMestre, maxTokens: 160, json: true });
    this.bill(aux);

    let inst;
    try { inst = JSON.parse(clean(aux.text)); } catch { inst = { instrucao: narration, paraQuem: null }; }

    const alvos = inst.paraQuem?.length
      ? this.players.filter(p => inst.paraQuem.some(n => (p.sheet?.nome || p.name).toLowerCase().includes(String(n).toLowerCase())))
      : this.players;

    for (const ag of (alvos.length ? alvos : this.players)) {
      const tok = this.world.tokens.find(t => t.id === ag.id);
      const r = await ag.act(this.or, {
        scene: this.sceneName,
        vision: tok ? this.world.describeVision(ag.id) : 'Ainda não posicionado.',
        sceneLog: this.scene.render(ag.sheet?.nome || ag.name),
        extra: `Instrução do mestre para você: ${inst.instrucao}`,
      });
      this.bill(r);
      const a = r.action;
      if (a.mover && tok) { const mv = this.world.moveToken(ag.id, a.mover.x, a.mover.y); if (mv.ok) this.onEvent?.('mover', { id: ag.id }); }
      if (a.fala) this.log(ag.sheet?.nome || ag.name, a.fala + (a.acao ? ` [${a.acao}]` : ''), 'fala');
      this.world.updateExplored();
      this.onEvent?.('redraw');
    }
    this.turnIndex++;
  }

  // Modo só-IA: loop automático em tempo real, com play/pause.
  async loop() {
    while (this.running) {
      await this.runTurn();
      if (this.onEvent?.('checkBudget')) break;
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  // Fechamento obrigatório quando o limite artificial é atingido.
  async closingSummary() {
    const r = await this.or.chat([
      { role: 'system', content: 'Encerre a sessão: resuma em 3-5 frases o que aconteceu, onde os personagens ficaram e quais ganchos estão pendentes. SOMENTE JSON: {"narracao":"...","artefato":{"tipo":"aventura","titulo":"...","conteudo":"..."}}' },
      { role: 'user', content: this.scene.render(null, 20) },
    ], { model: this.cfg.modeloMestre, maxTokens: 420, json: true });
    this.bill(r);
    await this._applyMaster(r);

    // grava o resumo na memória de todo mundo (uma vez, no fim — não por turno)
    const resumo = this.scene.lastText();
    for (const ag of this.players) { const rr = await ag.remember(this.or, resumo); this.bill(rr); }
  }

  async saveWorld() { await put('world', this.world.serialize()); }
}

const trim = (t, n) => String(t || '').slice(0, n);
