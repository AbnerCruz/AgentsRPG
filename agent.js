// agent.js — agentes da mesa. O sistema monta a ficha sozinho; o agente só interpreta e decide.
// A saída do agente é JSON compacto: { fala, mover, acao } — economiza tokens e permite que o
// site execute movimento/rolagens sem que o agente "invente" ferramentas.

import { put, get, uid } from './db.js';
import { MemoryStore, renderMemories } from './memory.js';
import { SRD5E, abilityMod, rollSheet } from './srd5e.js';

const ECONOMY = `Responda SOMENTE com JSON válido: {"fala":"...","mover":[x,y]|null,"acao":"..."|null}.
"fala" = o que seu personagem diz ou faz, em 1-2 frases curtas, em prosa viva, sem meta-comentário.
"mover" = coordenada de destino se quiser se deslocar (só casas que você enxerga), senão null.
"acao" = nome curto da ação mecânica (ex: "ataque com espada", "teste de Percepção") ou null.
Nunca repita o que já foi dito. Reaja ao que os outros acabaram de fazer.`;

export class Agent {
  constructor(d) {
    Object.assign(this, {
      id: d.id || uid('ag'),
      name: d.name,
      role: d.role || 'pc', // 'pc' | 'master'
      model: d.model,
      sheet: d.sheet || null,
      color: d.color || pickColor(),
      createdAt: d.createdAt || Date.now(),
    });
    this.memory = new MemoryStore(this.id);
  }

  static async load(id) { const d = await get('agents', id); return d ? new Agent(d) : null; }

  async save() {
    await put('agents', { id: this.id, name: this.name, role: this.role, model: this.model, sheet: this.sheet, color: this.color, createdAt: this.createdAt });
    return this;
  }

  // O SISTEMA monta a ficha. A IA só escolhe conceito (nome/raça/classe/traço), o resto é
  // rolado e calculado localmente pelas regras — de graça, sem gastar tokens com aritmética.
  async buildSheet(or, { ambientacao = '', grupo = [] } = {}) {
    const prompt = [
      { role: 'system', content: `Crie um personagem jogável para uma mesa de RPG (D&D 5e SRD). Responda SOMENTE JSON: {"nome":"...","raca":"...","classe":"...","traco":"...","objetivo":"..."} — raça e classe devem ser destas listas. Raças: ${SRD5E.races.map(r => r.name).join(', ')}. Classes: ${SRD5E.classes.map(c => c.name).join(', ')}. "traco" = uma frase de personalidade. "objetivo" = o que move este personagem. Evite repetir os companheiros já existentes.` },
      { role: 'user', content: `Ambientação: ${ambientacao || 'fantasia medieval genérica'}.\nCompanheiros já criados: ${grupo.length ? grupo.join('; ') : 'nenhum'}.` },
    ];
    const r = await or.chat(prompt, { model: this.model, maxTokens: 180, json: true });
    let c;
    try { c = JSON.parse(clean(r.text)); } catch { c = { nome: this.name, raca: 'Humano', classe: 'Guerreiro', traco: 'reservado', objetivo: 'sobreviver' }; }
    this.sheet = rollSheet(c); // aritmética, atributos, PV, CA, perícias — tudo local
    this.name = this.sheet.nome || this.name;
    await this.save();
    return { sheet: this.sheet, cost: r.cost, inTokens: r.inTokens, outTokens: r.outTokens };
  }

  async act(or, { scene, vision, sceneLog, extra = '', maxTokens = 260 }) {
    const mems = await this.memory.relevant(`${scene} ${sceneLog}`, 5);
    const sys = [
      `Você interpreta ${this.sheet?.nome || this.name}: ${sheetLine(this.sheet)}.`,
      this.sheet?.traco ? `Personalidade: ${this.sheet.traco}. Objetivo: ${this.sheet.objetivo || '—'}.` : '',
      `O que você enxerga agora: ${vision}`,
      `Suas lembranças relevantes:\n${renderMemories(mems)}`,
      extra,
      ECONOMY,
    ].filter(Boolean).join('\n\n');

    const r = await or.chat([
      { role: 'system', content: sys },
      { role: 'user', content: `Cena: ${scene}\n\nO que acabou de acontecer:\n${sceneLog}\n\nSua vez.` },
    ], { model: this.model, maxTokens, json: true });

    return { ...r, action: parseAction(r.text) };
  }

  // Registra memória: uma chamada por evento importante, não por turno.
  async remember(or, fact) {
    const r = await or.chat([
      { role: 'system', content: 'Resuma em UMA frase curta e liste até 4 tags de uma palavra. SOMENTE JSON: {"s":"...","t":["..."]}' },
      { role: 'user', content: fact.slice(0, 1200) },
    ], { model: this.model, maxTokens: 90, json: true });
    let p;
    try { p = JSON.parse(clean(r.text)); } catch { p = { s: fact.slice(0, 120), t: [] }; }
    await this.memory.add({ longText: fact, shortText: p.s, tags: p.t });
    return r;
  }
}

function sheetLine(s) {
  if (!s) return 'ficha ainda não gerada';
  return `${s.raca} ${s.classe} nv.${s.nivel} — PV ${s.pv_atual}/${s.pv_max}, CA ${s.ca}, For ${s.atributos.Força} Des ${s.atributos.Destreza} Con ${s.atributos.Constituição} Int ${s.atributos.Inteligência} Sab ${s.atributos.Sabedoria} Car ${s.atributos.Carisma}`;
}

export function parseAction(text) {
  try {
    const o = JSON.parse(clean(text));
    return {
      fala: String(o.fala || o.text || '').trim(),
      mover: Array.isArray(o.mover) && o.mover.length === 2 ? { x: +o.mover[0], y: +o.mover[1] } : null,
      acao: o.acao || null,
    };
  } catch {
    return { fala: String(text || '').trim(), mover: null, acao: null };
  }
}

export const clean = (t) => String(t || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

const PALETTE = ['#c99a3b', '#4f7566', '#a34a3a', '#5b7fa3', '#8a6bab', '#b07840', '#3f8f7d'];
let ci = 0;
function pickColor() { return PALETTE[ci++ % PALETTE.length]; }
