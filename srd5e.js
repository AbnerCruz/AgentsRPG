// srd5e.js — subconjunto do D&D 5e SRD (System Reference Document 5.1, licença Creative Commons /
// Open Game License — conteúdo redistribuível). NÃO é o livro completo oficial da Wizards of the
// Coast; é a base aberta usada como sistema "D&D 5e (padrão)" deste site.
// Serve de: (1) template de ficha padrão, (2) regras de fallback (dado, iniciativa, movimento)
// quando o jogador não anexa PDFs próprios ou anexa apenas material adjacente (homebrew).

export const SRD5E = {
  meta: {
    name: 'D&D 5e (SRD)',
    dice: 'd20',
    version: 'SRD 5.1 (resumo embutido)',
  },

  abilities: ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'],

  skills: {
    'Acrobacia': 'Destreza', 'Adestrar Animais': 'Sabedoria', 'Arcanismo': 'Inteligência',
    'Atletismo': 'Força', 'Atuação': 'Carisma', 'Enganação': 'Carisma', 'Furtividade': 'Destreza',
    'História': 'Inteligência', 'Intimidação': 'Carisma', 'Intuição': 'Sabedoria',
    'Investigação': 'Inteligência', 'Medicina': 'Sabedoria', 'Natureza': 'Inteligência',
    'Percepção': 'Sabedoria', 'Persuasão': 'Carisma', 'Prestidigitação': 'Destreza',
    'Religião': 'Inteligência', 'Sobrevivência': 'Sabedoria',
  },

  races: [
    { name: 'Humano', speed: 9, traits: ['+1 em todos os atributos (variante: 1 talento + 2 perícias)'] },
    { name: 'Elfo', speed: 9, traits: ['Visão no escuro', 'Sentidos aguçados (perícia em Percepção)', 'Imune a sono mágico'] },
    { name: 'Anão', speed: 7.5, traits: ['Visão no escuro', 'Resiliência anã (vantagem vs. veneno)', 'Proficiência em uma ferramenta de artesão'] },
    { name: 'Halfling', speed: 7.5, traits: ['Sortudo (rerolar 1 em d20)', 'Corajoso (vantagem vs. medo)', 'Furtivo por natureza'] },
    { name: 'Meio-Orc', speed: 9, traits: ['Visão no escuro', 'Resistência implacável (1x/descanso, sobrevive a 0 HP com 1)', 'Ataques críticos causam dano extra'] },
    { name: 'Draconato', speed: 9, traits: ['Ancestralidade dracônica (arma de sopro, resistência a dano)'] },
    { name: 'Gnomo', speed: 7.5, traits: ['Visão no escuro', 'Esperteza gnômica (vantagem em testes de Int/Sab/Car vs. magia)'] },
    { name: 'Meio-Elfo', speed: 9, traits: ['Visão no escuro', '+2 Carisma e +1 em duas outras habilidades', 'Proficiência em duas perícias'] },
    { name: 'Tiefling', speed: 9, traits: ['Visão no escuro', 'Resistência a dano de fogo', 'Truque de magia infernal'] },
  ],

  classes: [
    { name: 'Bárbaro', hitDie: 'd12', primaryAbility: 'Força', saves: ['Força', 'Constituição'] },
    { name: 'Bardo', hitDie: 'd8', primaryAbility: 'Carisma', saves: ['Destreza', 'Carisma'] },
    { name: 'Clérigo', hitDie: 'd8', primaryAbility: 'Sabedoria', saves: ['Sabedoria', 'Carisma'] },
    { name: 'Druida', hitDie: 'd8', primaryAbility: 'Sabedoria', saves: ['Inteligência', 'Sabedoria'] },
    { name: 'Guerreiro', hitDie: 'd10', primaryAbility: 'Força ou Destreza', saves: ['Força', 'Constituição'] },
    { name: 'Monge', hitDie: 'd8', primaryAbility: 'Destreza e Sabedoria', saves: ['Força', 'Destreza'] },
    { name: 'Paladino', hitDie: 'd10', primaryAbility: 'Força e Carisma', saves: ['Sabedoria', 'Carisma'] },
    { name: 'Patrulheiro', hitDie: 'd10', primaryAbility: 'Destreza e Sabedoria', saves: ['Força', 'Destreza'] },
    { name: 'Ladino', hitDie: 'd8', primaryAbility: 'Destreza', saves: ['Destreza', 'Inteligência'] },
    { name: 'Feiticeiro', hitDie: 'd6', primaryAbility: 'Carisma', saves: ['Constituição', 'Carisma'] },
    { name: 'Bruxo', hitDie: 'd8', primaryAbility: 'Carisma', saves: ['Sabedoria', 'Carisma'] },
    { name: 'Mago', hitDie: 'd6', primaryAbility: 'Inteligência', saves: ['Inteligência', 'Sabedoria'] },
  ],

  // Ficha padrão gerada quando o sistema é "D&D 5e (padrão)" e nenhum template customizado foi anexado
  characterSheetTemplate: {
    fields: [
      { key: 'nome', label: 'Nome do personagem', type: 'text' },
      { key: 'raca', label: 'Raça', type: 'select', options: 'races' },
      { key: 'classe', label: 'Classe', type: 'select', options: 'classes' },
      { key: 'nivel', label: 'Nível', type: 'number', default: 1 },
      { key: 'antecedente', label: 'Antecedente', type: 'text' },
      { key: 'alinhamento', label: 'Alinhamento', type: 'text' },
      { key: 'atributos', label: 'Atributos (For/Des/Con/Int/Sab/Car)', type: 'abilities' },
      { key: 'pv_max', label: 'Pontos de Vida (máx.)', type: 'number' },
      { key: 'pv_atual', label: 'Pontos de Vida (atual)', type: 'number' },
      { key: 'ca', label: 'Classe de Armadura', type: 'number' },
      { key: 'deslocamento', label: 'Deslocamento (m)', type: 'number', default: 9 },
      { key: 'pericias', label: 'Perícias treinadas', type: 'multiselect', options: 'skills' },
      { key: 'inventario', label: 'Inventário', type: 'list' },
      { key: 'magias', label: 'Magias conhecidas/preparadas', type: 'list' },
      { key: 'tracos', label: 'Traços de raça/classe', type: 'list' },
      { key: 'historia', label: 'História pessoal', type: 'textarea' },
    ],
  },

  // Regras de fallback usadas pelo motor quando não há regra extraída de PDF pra algo específico
  fallbackRules: {
    initiative: 'd20 + modificador de Destreza; ordem decrescente; reempates por Destreza mais alta.',
    attackRoll: 'd20 + modificador de habilidade + bônus de proficiência (se treinado) vs. Classe de Armadura do alvo.',
    savingThrow: 'd20 + modificador de habilidade (+ proficiência se aplicável) vs. Classe de Dificuldade (CD).',
    movementPerTurn: 'até o deslocamento do personagem (padrão 9m) por turno de combate; movimento em terreno difícil custa o dobro.',
    restShort: 'Descanso curto (1h): gasta Dados de Vida para recuperar PV.',
    restLong: 'Descanso longo (8h): recupera todos os PV e metade dos Dados de Vida; recursos de "por dia" resetam.',
    advantageDisadvantage: 'Vantagem: rola 2d20 e usa o maior. Desvantagem: rola 2d20 e usa o menor. Não acumulam.',
  },
};

export function abilityModifier(score) {
  return Math.floor((Number(score || 10) - 10) / 2);
}
