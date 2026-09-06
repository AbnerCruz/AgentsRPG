// memory.js — memória por agente + o CORO DA CENA (contexto compartilhado).
//
// O erro da versão anterior: cada agente falava no vácuo. Agora existe um buffer único de cena
// que registra tudo que foi dito/feito por todos (jogador, mestre, agentes), e cada agente recebe
// as últimas falas desse buffer no prompt. É assim que eles reagem uns aos outros.
//
// Economia: o buffer é curto (últimas N falas), e a memória longa continua sendo filtrada
// por tags em JS puro (custo zero) antes de qualquer chamada de IA.

import { put, get, getAll, del, uid } from './db.js';

// ---------- Contexto compartilhado da cena ----------
export class SceneBuffer {
  constructor(maxTurns = 12) {
    this.turns = []; // { speaker, role, text, ts }
    this.maxTurns = maxTurns;
  }

  push(speaker, role, text) {
    this.turns.push({ speaker, role, text, ts: Date.now() });
    if (this.turns.length > this.maxTurns * 2) this.turns = this.turns.slice(-this.maxTurns);
  }

  // O que os agentes leem. Exclui a própria fala do agente pra não duplicar tokens.
  render(excludeSpeaker = null, limit = null) {
    const t = this.turns.slice(-(limit || this.maxTurns));
    const lines = t.filter(x => x.speaker !== excludeSpeaker).map(x => `${x.speaker}: ${x.text}`);
    return lines.length ? lines.join('\n') : '(a cena acaba de começar)';
  }

  lastText() {
    return this.turns.length ? this.turns[this.turns.length - 1].text : '';
  }

  clear() { this.turns = []; }
}

// ---------- Memória de longo prazo por agente ----------
export class MemoryStore {
  constructor(agentId) { this.agentId = agentId; }

  async add({ longText, shortText, tags }) {
    const id = uid('mem');
    await put('memories_long', { id, agentId: this.agentId, text: longText, createdAt: Date.now() });
    await put('memories_short', { id: `s_${id}`, agentId: this.agentId, longId: id, text: shortText, tags: norm(tags), createdAt: Date.now() });
  }

  async shorts() {
    return (await getAll('memories_short')).filter(m => m.agentId === this.agentId).sort((a, b) => b.createdAt - a.createdAt);
  }

  async longOf(shortId) {
    const s = (await getAll('memories_short')).find(m => m.id === shortId);
    return s ? get('memories_long', s.longId) : null;
  }

  // Filtro 100% JS — nenhuma chamada de IA para decidir o que é relevante.
  async relevant(context, max = 6) {
    const all = await this.shorts();
    if (!all.length) return [];
    const ctx = new Set(tok(context));
    const scored = all.map(m => {
      let s = 0;
      for (const t of m.tags) if (ctx.has(t)) s += 3;
      for (const w of tok(m.text)) if (ctx.has(w)) s += 1;
      return { m, s };
    }).sort((a, b) => b.s - a.s || b.m.createdAt - a.m.createdAt);
    const hits = scored.filter(x => x.s > 0).slice(0, max);
    return (hits.length ? hits : scored.slice(0, 3)).map(x => x.m);
  }
}

export function renderMemories(list) {
  return list.length ? list.map(m => `- ${m.text}`).join('\n') : '(nada relevante lembrado)';
}

const STOP = new Set(['de', 'da', 'do', 'a', 'o', 'e', 'que', 'em', 'um', 'uma', 'para', 'com', 'no', 'na', 'os', 'as', 'se', 'por', 'foi', 'ao', 'ele', 'ela', 'seu', 'sua']);
const tok = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const norm = (tags) => (Array.isArray(tags) ? tags : String(tags || '').split(',')).map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 6);
