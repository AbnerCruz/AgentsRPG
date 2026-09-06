// agent.js — um agente de IA na mesa: joga um personagem, tem ficha própria, memória própria,
// e sua única função é DECIDIR interpretando o personagem e a história (nunca gera ferramentas
// do site — dados, imagens, mapas são consumidos, não produzidos pelo agente).

import { put, get, uid } from './db.js';
import { MemoryStore, renderShortMemoriesForPrompt } from './memory.js';
import { estimateMessagesTokens } from './tokens.js';

// Instrução de sistema compartilhada: pede respostas enxutas, sem "pensar em voz alta",
// preservando qualidade narrativa — inspirado em técnicas de prompting econômico ("caveman"
// / saída direta), mas sem sacrificar imersão: o agente ainda fala em prosa, só não expande
// além do necessário nem repete contexto que já está na memória filtrada.
export const ECONOMY_SYSTEM_SUFFIX = `
Regras de resposta (importantes, siga sempre):
- Responda em prosa narrativa curta e direta: 1 a 3 parágrafos curtos, no máximo, salvo se a cena
  pedir claramente mais (ex: uma cena de virada importante). Nunca corte uma ideia pela metade —
  termine o pensamento, só não se estenda além do necessário.
- Não repita informações que já estão no contexto fornecido (memórias, ficha, cena atual).
- Não narre pensamentos internos extensos nem faça meta-comentários fora do personagem.
- Vá direto à ação, fala ou decisão do personagem — sem preâmbulo.
`.trim();

export class Agent {
  constructor(data) {
    Object.assign(this, {
      id: data.id || uid('agent'),
      name: data.name,
      role: data.role || 'player', // 'player' | 'master' | 'assistant'
      model: data.model,
      sheet: data.sheet || {},
      campaignId: data.campaignId || null,
      createdAt: data.createdAt || Date.now(),
    });
    this.memory = new MemoryStore(this.id);
  }

  static async load(id) {
    const data = await get('agents', id);
    if (!data) return null;
    return new Agent(data);
  }

  async save() {
    await put('agents', {
      id: this.id, name: this.name, role: this.role, model: this.model,
      sheet: this.sheet, campaignId: this.campaignId, createdAt: this.createdAt,
    });
    return this;
  }

  // Registra um novo fato na memória do agente. A própria IA do agente (mesmo modelo) gera
  // o resumo curto + tags — mas isso acontece UMA VEZ por fato, não repetidamente por turno.
  async remember(orClient, longText) {
    const prompt = [
      { role: 'system', content: 'Resuma o fato a seguir em UMA frase curta (memória curta) e liste até 5 tags de UMA palavra cada (personagens, lugares, temas envolvidos). Responda SOMENTE em JSON: {"short":"...","tags":["...","..."]}' },
      { role: 'user', content: longText },
    ];
    const result = await orClient.chat(prompt, { model: this.model, maxTokens: 150, reasoningEffort: 'low' });
    let parsed;
    try {
      parsed = JSON.parse(result.text.trim().replace(/^```json|```$/g, ''));
    } catch {
      parsed = { short: longText.slice(0, 140), tags: [] };
    }
    await this.memory.addMemory({ longText, shortText: parsed.short, tags: parsed.tags });
    return { usage: result, parsed };
  }

  // Monta o prompt econômico: ficha resumida + memórias curtas filtradas (JS puro) + cena atual.
  async buildPrompt({ sceneContext, incomingInput, extraSystem = '' }) {
    const relevant = await this.memory.filterRelevant(`${sceneContext}\n${incomingInput}`, { maxResults: 8 });
    const memoryBlock = renderShortMemoriesForPrompt(relevant);

    const system = [
      this.role === 'master'
        ? 'Você é o MESTRE de uma mesa de RPG. Cria e conduz a história, cataloga eventos como memórias.'
        : this.role === 'assistant'
          ? 'Você é o AGENTE AUXILIAR do jogador-mestre. Sua função é interpretar a narração do jogador e traduzi-la em instruções claras para os agentes envolvidos, sem inventar conteúdo além do que o jogador disse.'
          : `Você interpreta o personagem "${this.sheet?.nome || this.name}" nesta mesa de RPG. Tome decisões coerentes com a ficha, a personalidade e a história do personagem.`,
      this.role !== 'assistant' ? `Ficha resumida: ${summarizeSheet(this.sheet)}` : '',
      `Memórias relevantes deste agente:\n${memoryBlock}`,
      extraSystem,
      ECONOMY_SYSTEM_SUFFIX,
    ].filter(Boolean).join('\n\n');

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: `Cena atual: ${sceneContext}\n\nInput recebido: ${incomingInput}` },
    ];
    return { messages, relevantMemories: relevant, estimatedTokens: estimateMessagesTokens(messages) };
  }

  async act(orClient, { sceneContext, incomingInput, extraSystem, maxTokens = 500 }) {
    const { messages, estimatedTokens } = await this.buildPrompt({ sceneContext, incomingInput, extraSystem });
    const result = await orClient.chat(messages, { model: this.model, maxTokens, reasoningEffort: 'low' });
    return { ...result, estimatedPromptTokens: estimatedTokens };
  }
}

function summarizeSheet(sheet) {
  if (!sheet || Object.keys(sheet).length === 0) return '(ficha ainda não preenchida)';
  const parts = [];
  if (sheet.nome) parts.push(sheet.nome);
  if (sheet.raca) parts.push(sheet.raca);
  if (sheet.classe) parts.push(`${sheet.classe} nv.${sheet.nivel || 1}`);
  if (sheet.pv_atual != null) parts.push(`PV ${sheet.pv_atual}/${sheet.pv_max ?? '?'}`);
  if (sheet.ca != null) parts.push(`CA ${sheet.ca}`);
  if (sheet.tracos?.length) parts.push(`traços: ${sheet.tracos.slice(0, 3).join('; ')}`);
  return parts.join(' | ');
}
