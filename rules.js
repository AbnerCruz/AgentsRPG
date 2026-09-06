// rules.js — motor de regras da mesa: rolagem de dados, iniciativa, extração de PDFs.
// pdf.js é carregado via CDN no index.html como `pdfjsLib` global.

import { put, get, getAll, uid } from './db.js';

// ---- Dados ----
// Notação padrão: "2d6+3", "1d20", "4d8-1"
export function rollDice(notation) {
  const m = String(notation).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) throw new Error(`Notação de dado inválida: "${notation}"`);
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { notation, rolls, mod, total };
}

export function rollWithAdvantage(sides = 20, mode = 'normal') {
  // mode: 'normal' | 'advantage' | 'disadvantage'
  const a = 1 + Math.floor(Math.random() * sides);
  if (mode === 'normal') return { rolls: [a], total: a };
  const b = 1 + Math.floor(Math.random() * sides);
  const total = mode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
  return { rolls: [a, b], total, mode };
}

// ---- Iniciativa ----
// Ordena combatentes por resultado de iniciativa (desc). combatants: [{id, name, roll}]
export function sortInitiative(combatants) {
  return [...combatants].sort((a, b) => b.roll - a.roll);
}

// ---- Extração de regras a partir de PDFs (sob demanda, com cache) ----
// Fluxo de economia: 1) procura no cache local (rules_cache) por essa consulta;
// 2) não achando, extrai texto bruto do PDF via pdf.js (sem custo de IA);
// 3) só then manda o TRECHO relevante do PDF pra IA resumir/estruturar, nunca o PDF inteiro.

export async function extractPdfText(fileArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: fileArrayBuffer }).promise;
  let fullText = '';
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    pages.push(pageText);
    fullText += pageText + '\n';
  }
  return { fullText, pages };
}

// Busca ingênua por palavra-chave dentro do texto extraído (custo zero de IA),
// devolve os trechos (janelas de contexto) mais prováveis de conter a regra procurada.
export function findRelevantExcerpts(pages, keyword, { windowChars = 900, maxExcerpts = 3 } = {}) {
  const kw = keyword.toLowerCase();
  const hits = [];
  pages.forEach((pageText, idx) => {
    const lower = pageText.toLowerCase();
    let pos = lower.indexOf(kw);
    while (pos !== -1 && hits.length < maxExcerpts * 3) {
      const start = Math.max(0, pos - windowChars / 2);
      const end = Math.min(pageText.length, pos + windowChars / 2);
      hits.push({ page: idx + 1, excerpt: pageText.slice(start, end) });
      pos = lower.indexOf(kw, pos + kw.length);
    }
  });
  return hits.slice(0, maxExcerpts);
}

// Cache de regras já extraídas/estruturadas, por (rulesetId + chave de busca)
export async function getCachedRule(rulesetId, key) {
  return get('rules_cache', `${rulesetId}::${key}`);
}

export async function setCachedRule(rulesetId, key, value) {
  return put('rules_cache', { id: `${rulesetId}::${key}`, rulesetId, key, value, createdAt: Date.now() });
}

// ---- Movimento em grid ----
// Limite de casas por turno baseado no deslocamento do personagem (metros) / tamanho da casa (padrão 1,5m)
export function movementSquaresAllowed(speedMeters, squareSizeMeters = 1.5) {
  return Math.floor(Number(speedMeters || 9) / squareSizeMeters);
}

export function gridDistance(a, b) {
  // distância "D&D-like": diagonal conta como 1 (regra opcional simplificada do SRD)
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
