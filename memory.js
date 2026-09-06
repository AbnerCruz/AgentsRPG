// memory.js — memória de cada agente (incluindo o mestre).
//
// Arquitetura de economia:
// 1) Cada memória LONGA (detalhada) tem uma memória CURTA associada (1-2 frases) + tags.
// 2) Quando o agente precisa de contexto, filtramos as memórias CURTAS por tag/palavra-chave
//    usando JS PURO (custo zero de IA) — nunca mandamos todas as memórias pra IA analisar.
// 3) Só as memórias curtas pré-filtradas (top N por relevância) vão pro prompt da IA.
// 4) Se o agente precisar de detalhe adicional sobre uma memória curta específica, SÓ ENTÃO
//    a memória longa correspondente é anexada ao prompt (sob demanda, não em bloco).
//
// A memória curta + tags é gerada pela própria IA do agente (mesmo modelo), mas isso só
// acontece UMA VEZ, no momento em que o fato é registrado — não repetidamente por turno.

import { put, get, getAll, del, uid } from './db.js';

export class MemoryStore {
  constructor(agentId) {
    this.agentId = agentId;
  }

  async addMemory({ longText, shortText, tags }) {
    const id = uid('mem');
    const long = { id, agentId: this.agentId, text: longText, createdAt: Date.now() };
    const short = { id: `short_${id}`, agentId: this.agentId, longId: id, text: shortText, tags: normalizeTags(tags), createdAt: Date.now() };
    await put('memories_long', long);
    await put('memories_short', short);
    return { long, short };
  }

  async allShort() {
    const all = await getAll('memories_short');
    return all.filter(m => m.agentId === this.agentId).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getLong(longId) {
    return get('memories_long', longId);
  }

  async deleteMemory(longId) {
    await del('memories_long', longId);
    await del('memories_short', `short_${longId}`);
  }

  // Filtro 100% em JS, custo zero de tokens de IA.
  // context: string livre (ex: última fala da cena, ação declarada, nome de personagens envolvidos)
  async filterRelevant(context, { maxResults = 8 } = {}) {
    const shorts = await this.allShort();
    if (shorts.length === 0) return [];
    const contextTokens = tokenize(context);
    const contextTagsGuess = new Set(contextTokens);

    const scored = shorts.map(mem => {
      let score = 0;
      for (const tag of mem.tags) {
        if (contextTagsGuess.has(tag)) score += 3; // match direto de tag
      }
      const memWords = tokenize(mem.text);
      for (const w of memWords) {
        if (contextTagsGuess.has(w)) score += 1; // match de palavra no texto curto
      }
      // leve viés de recência (memórias recentes um pouco mais relevantes em empate)
      return { mem, score };
    });

    scored.sort((a, b) => b.score - a.score || b.mem.createdAt - a.mem.createdAt);
    const relevant = scored.filter(s => s.score > 0).slice(0, maxResults);

    // Se nada bateu por tag/palavra, ainda assim devolve as N mais recentes
    // (contexto mínimo é melhor que contexto zero, sem gastar tokens extra pra decidir isso)
    if (relevant.length === 0) {
      return shorts.slice(0, Math.min(3, shorts.length)).map(mem => ({ mem, score: 0 }));
    }
    return relevant;
  }
}

function normalizeTags(tags) {
  if (!tags) return [];
  const arr = Array.isArray(tags) ? tags : String(tags).split(',');
  return arr.map(t => t.trim().toLowerCase()).filter(Boolean);
}

const STOPWORDS = new Set(['de', 'da', 'do', 'a', 'o', 'e', 'que', 'em', 'um', 'uma', 'para', 'com', 'no', 'na', 'os', 'as', 'se', 'por', 'foi', 'ao']);

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos p/ matching mais tolerante
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

// Monta o bloco de "memórias relevantes" pronto pra entrar no prompt, já enxuto.
export function renderShortMemoriesForPrompt(relevantList) {
  if (relevantList.length === 0) return '(sem memórias relevantes registradas ainda)';
  return relevantList.map(({ mem }) => `- [${mem.tags.join(', ')}] ${mem.text}`).join('\n');
}
