// artifacts.js — acervo. Cada material tem uma CATEGORIA, e a categoria define como o mestre
// usa aquilo: regras resolvem mecânica, aventura vira roteiro, ambientação vira contexto de
// mundo, ficha vira template de personagem, bestiário vira fonte de inimigos.

import { put, getAll, get, del, uid } from './db.js';

export const CATEGORIAS = {
  regras: {
    rotulo: 'Regras do sistema',
    ajuda: 'Livro do jogador, SRD, manual. O mestre consulta para resolver testes, combate e criação de personagem.',
    cor: '#c99a3b',
  },
  aventura: {
    rotulo: 'Aventura / campanha',
    ajuda: 'Módulo pronto, roteiro, one-shot. Se houver um aqui, o mestre segue esta aventura em vez de inventar uma.',
    cor: '#a34a3a',
  },
  ambientacao: {
    rotulo: 'Ambientação / mundo',
    ajuda: 'Lore, geografia, facções, história do mundo. Vira o pano de fundo de tudo que o mestre narra.',
    cor: '#4f7566',
  },
  bestiario: {
    rotulo: 'Bestiário / NPCs',
    ajuda: 'Monstros, inimigos, figuras importantes. Fonte de quem aparece em cena.',
    cor: '#8a6bab',
  },
  ficha: {
    rotulo: 'Ficha / template',
    ajuda: 'Modelo de ficha do seu sistema. Se houver um aqui, é ele que define os campos dos personagens.',
    cor: '#5b7fa3',
  },
  homebrew: {
    rotulo: 'Homebrew / casa',
    ajuda: 'Suas regras próprias. Têm prioridade sobre as regras oficiais em caso de conflito.',
    cor: '#b07840',
  },
  nota: { rotulo: 'Nota', ajuda: 'Anotação avulsa.', cor: '#8d8778' },
};

// Categorias geradas durante o jogo pelo próprio mestre
export const CATEGORIAS_JOGO = {
  npc: { rotulo: 'NPC', cor: '#8a6bab' },
  local: { rotulo: 'Local', cor: '#4f7566' },
  item: { rotulo: 'Item', cor: '#c99a3b' },
  gancho: { rotulo: 'Gancho', cor: '#a34a3a' },
  imagem: { rotulo: 'Imagem', cor: '#5b7fa3' },
};

export const rotuloDe = (t) => CATEGORIAS[t]?.rotulo || CATEGORIAS_JOGO[t]?.rotulo || t;
export const corDe = (t) => CATEGORIAS[t]?.cor || CATEGORIAS_JOGO[t]?.cor || '#8d8778';

export async function saveArtifact({ id, tipo, titulo, conteudo, tags = [], origem = 'jogador', ...extra }) {
  const aid = id || uid('art');
  await put('artifacts', { id: aid, tipo, titulo, conteudo, tags, origem, ...extra, updatedAt: Date.now() });
  return aid;
}

export async function listArtifacts(tipo = null) {
  const all = (await getAll('artifacts')).sort((a, b) => b.updatedAt - a.updatedAt);
  return tipo ? all.filter(a => a.tipo === tipo) : all;
}

export const findArtifact = async (tipo) => (await listArtifacts(tipo))[0] || null;
export const removeArtifact = (id) => del('artifacts', id);
export const getArtifact = (id) => get('artifacts', id);

// Importa PDF com progresso real e categoria escolhida pelo jogador.
// Se a categoria vier vazia, tenta adivinhar pelo conteúdo.
export async function importPdf(file, categoria, onProgress) {
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
  const tipo = categoria || guessType(file.name, texto);
  const id = await saveArtifact({
    tipo,
    titulo: file.name.replace(/\.pdf$/i, ''),
    conteudo: texto.slice(0, 250000),
    origem: 'pdf',
    paginas: total,
  });
  return { id, tipo, paginas: total, chars: texto.length };
}

function guessType(nome, texto) {
  const n = (nome + ' ' + texto.slice(0, 4000)).toLowerCase();
  if (/bestiário|bestiario|monster manual|monstros/.test(n)) return 'bestiario';
  if (/aventura|campanha|adventure|módulo|one.?shot/.test(n)) return 'aventura';
  if (/ficha|character sheet/.test(n)) return 'ficha';
  if (/homebrew|caseir|nossas regras/.test(n)) return 'homebrew';
  if (/regra|rules|sistema|manual|handbook|srd/.test(n)) return 'regras';
  return 'ambientacao';
}

// Busca por palavra-chave nos artefatos (sem IA, custo zero).
export async function searchArtifacts(keyword, { max = 3, windowChars = 700, tipos = null } = {}) {
  const kw = String(keyword).toLowerCase();
  const arts = await listArtifacts();
  const hits = [];
  for (const a of arts) {
    if (tipos && !tipos.includes(a.tipo)) continue;
    if (typeof a.conteudo !== 'string') continue;
    const pos = a.conteudo.toLowerCase().indexOf(kw);
    if (pos === -1) continue;
    hits.push({ titulo: a.titulo, tipo: a.tipo, trecho: a.conteudo.slice(Math.max(0, pos - windowChars / 2), pos + windowChars / 2) });
    if (hits.length >= max) break;
  }
  return hits;
}
