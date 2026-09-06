// srd5e.js — D&D 5e SRD (System Reference Document, licença aberta) como sistema padrão.
// Também contém a montagem AUTOMÁTICA da ficha: a IA escolhe só o conceito, o sistema rola
// atributos, calcula PV/CA/perícias e monta inventário — tudo local, custo zero de tokens.

export const SRD5E = {
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
    { name: 'Humano', speed: 9, bonus: { Força: 1, Destreza: 1, Constituição: 1, Inteligência: 1, Sabedoria: 1, Carisma: 1 }, vision: 8 },
    { name: 'Elfo', speed: 9, bonus: { Destreza: 2 }, vision: 12 },
    { name: 'Anão', speed: 7.5, bonus: { Constituição: 2 }, vision: 12 },
    { name: 'Halfling', speed: 7.5, bonus: { Destreza: 2 }, vision: 8 },
    { name: 'Meio-Orc', speed: 9, bonus: { Força: 2, Constituição: 1 }, vision: 12 },
    { name: 'Draconato', speed: 9, bonus: { Força: 2, Carisma: 1 }, vision: 8 },
    { name: 'Gnomo', speed: 7.5, bonus: { Inteligência: 2 }, vision: 12 },
    { name: 'Meio-Elfo', speed: 9, bonus: { Carisma: 2, Destreza: 1 }, vision: 12 },
    { name: 'Tiefling', speed: 9, bonus: { Carisma: 2, Inteligência: 1 }, vision: 12 },
  ],

  classes: [
    { name: 'Bárbaro', hitDie: 12, prime: 'Força', armor: 12, skills: ['Atletismo', 'Sobrevivência'], gear: ['machado grande', 'poção de cura'] },
    { name: 'Bardo', hitDie: 8, prime: 'Carisma', armor: 13, skills: ['Atuação', 'Persuasão'], gear: ['alaúde', 'rapieira'] },
    { name: 'Clérigo', hitDie: 8, prime: 'Sabedoria', armor: 16, skills: ['Religião', 'Medicina'], gear: ['maça', 'símbolo sagrado'] },
    { name: 'Druida', hitDie: 8, prime: 'Sabedoria', armor: 13, skills: ['Natureza', 'Percepção'], gear: ['bordão', 'foice'] },
    { name: 'Guerreiro', hitDie: 10, prime: 'Força', armor: 17, skills: ['Atletismo', 'Intimidação'], gear: ['espada longa', 'escudo'] },
    { name: 'Monge', hitDie: 8, prime: 'Destreza', armor: 14, skills: ['Acrobacia', 'Furtividade'], gear: ['bastão', 'dardos'] },
    { name: 'Paladino', hitDie: 10, prime: 'Força', armor: 17, skills: ['Persuasão', 'Religião'], gear: ['espada longa', 'escudo'] },
    { name: 'Patrulheiro', hitDie: 10, prime: 'Destreza', armor: 14, skills: ['Sobrevivência', 'Percepção'], gear: ['arco longo', 'espada curta'] },
    { name: 'Ladino', hitDie: 8, prime: 'Destreza', armor: 14, skills: ['Furtividade', 'Prestidigitação'], gear: ['adaga', 'ferramentas de ladrão'] },
    { name: 'Feiticeiro', hitDie: 6, prime: 'Carisma', armor: 12, skills: ['Arcanismo', 'Enganação'], gear: ['adaga', 'foco arcano'] },
    { name: 'Bruxo', hitDie: 8, prime: 'Carisma', armor: 13, skills: ['Arcanismo', 'Intimidação'], gear: ['adaga', 'grimório do patrono'] },
    { name: 'Mago', hitDie: 6, prime: 'Inteligência', armor: 12, skills: ['Arcanismo', 'Investigação'], gear: ['cajado', 'grimório'] },
  ],

  fallback: {
    iniciativa: 'd20 + mod. Destreza, ordem decrescente.',
    ataque: 'd20 + mod. de habilidade + proficiência vs. CA do alvo.',
    resistencia: 'd20 + mod. de habilidade vs. CD.',
    movimento: 'até o deslocamento por turno (padrão 9m = 6 casas de 1,5m).',
  },
};

export const abilityMod = (v) => Math.floor((Number(v || 10) - 10) / 2);

function roll4d6DropLowest() {
  const r = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
  return r[0] + r[1] + r[2];
}

// Monta a ficha inteira a partir do conceito escolhido pela IA. Aritmética local.
export function rollSheet(concept) {
  const race = SRD5E.races.find(r => r.name === concept.raca) || SRD5E.races[0];
  const cls = SRD5E.classes.find(c => c.name === concept.classe) || SRD5E.classes[4];

  const attrs = {};
  const order = [cls.prime, ...SRD5E.abilities.filter(a => a !== cls.prime)];
  const rolls = SRD5E.abilities.map(() => roll4d6DropLowest()).sort((a, b) => b - a);
  order.forEach((ab, i) => { attrs[ab] = rolls[i]; });
  for (const [ab, b] of Object.entries(race.bonus || {})) attrs[ab] = (attrs[ab] || 10) + b;

  const conMod = abilityMod(attrs['Constituição']);
  const dexMod = abilityMod(attrs['Destreza']);
  const pvMax = cls.hitDie + conMod;
  const ca = cls.armor >= 16 ? cls.armor : cls.armor + Math.max(0, Math.min(dexMod, 2));

  return {
    nome: concept.nome || 'Sem nome',
    raca: race.name,
    classe: cls.name,
    nivel: 1,
    traco: concept.traco || '',
    objetivo: concept.objetivo || '',
    atributos: attrs,
    pv_max: pvMax,
    pv_atual: pvMax,
    ca,
    proficiencia: 2,
    deslocamento: race.speed,
    visao: race.vision,
    pericias: cls.skills,
    inventario: [...cls.gear, 'mochila', 'rações (3 dias)', 'tocha'],
    iniciativaMod: dexMod,
  };
}

export function rollDice(notation) {
  const m = String(notation).trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) throw new Error(`Notação inválida: ${notation}`);
  const n = m[1] ? +m[1] : 1, s = +m[2], mod = m[3] ? +m[3] : 0;
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod, notation };
}
