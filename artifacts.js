// artifacts.js — acervo. TODO PDF anexado vira artefato automaticamente (era o bug anterior),
// com progresso real de extração página a página.

import { put, getAll, get, del, uid } from './db.js';

export async function saveArtifact({ id, tipo, titulo, conteudo, tags = [], origem = 'jogador', extra = {} }) {
  const aid = id || uid('art');
  await put('artifacts', { id: aid, tipo, titulo, conteudo, tags, origem, ...extra, updatedAt: Date.now() });
  return aid;
}

export async function listArtifacts(tipo = null) {
  const all = (await getAll('artifacts')).sort((a, b) => b.updatedAt - a.updatedAt);
  return tipo ? all.filter(a => a.tipo === tipo) : all;
}

export async function findArtifact(tipo) {
  return (await listArtifacts(tipo))[0] || null;
}

export const removeArtifact = (id) => del('artifacts', id);
export const getArtifact = (id) => get('artifacts', id);

// Importa um PDF: extrai página a página reportando progresso, e SALVA como artefato.
export async function importPdf(file, onProgress) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  const pages = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(it => it.str).join(' '));
    onProgress?.(i, total, file.name);
  }
  const texto = pages.join('\n\n');
  const tipo = guessType(file.name, texto);
  const id = await saveArtifact({
    tipo,
    titulo: file.name.replace(/\.pdf$/i, ''),
    conteudo: texto.slice(0, 200000),
    origem: 'pdf',
    extra: { paginas: total },
  });
  return { id, tipo, paginas: total, chars: texto.length };
}

function guessType(nome, texto) {
  const n = (nome + ' ' + texto.slice(0, 3000)).toLowerCase();
  if (/regra|rules|sistema|manual|player.?s handbook|srd/.test(n)) return 'regras';
  if (/aventura|campanha|adventure|módulo|modulo/.test(n)) return 'aventura';
  if (/ambienta|setting|mundo|cenário|cenario|lore/.test(n)) return 'ambientacao';
  if (/ficha|character sheet/.test(n)) return 'ficha';
  return 'ambientacao';
}

// Busca barata por palavra-chave dentro dos artefatos textuais (sem IA, custo zero).
export async function searchArtifacts(keyword, { max = 3, windowChars = 700 } = {}) {
  const kw = String(keyword).toLowerCase();
  const arts = await listArtifacts();
  const hits = [];
  for (const a of arts) {
    if (typeof a.conteudo !== 'string') continue;
    const low = a.conteudo.toLowerCase();
    const pos = low.indexOf(kw);
    if (pos === -1) continue;
    hits.push({
      titulo: a.titulo, tipo: a.tipo,
      trecho: a.conteudo.slice(Math.max(0, pos - windowChars / 2), pos + windowChars / 2),
    });
    if (hits.length >= max) break;
  }
  return hits;
}
