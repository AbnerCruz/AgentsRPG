// Constantes, espécies e geradores de nomes.

export const TICKS_PER_DAY = 200;
export const DAYS_PER_SEASON = 2;
export const TICKS_PER_SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;
export const TICKS_PER_YEAR = TICKS_PER_SEASON * 4;
export const SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const SEASON_GROWTH = [1.5, 1.0, 0.7, 0.12];

export const T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, HILLS: 5, MOUNTAIN: 6, RIVER: 7, FARM: 8 };
export const TERRAIN = [
  { name: 'Mar profundo', passable: false, cost: 1, foodCap: 0 },
  { name: 'Água', passable: false, cost: 1, foodCap: 0 },
  { name: 'Areia', passable: true, cost: 1.25, foodCap: 0.4 },
  { name: 'Campo', passable: true, cost: 1, foodCap: 2.5 },
  { name: 'Floresta', passable: true, cost: 1.4, foodCap: 3.2 },
  { name: 'Colinas', passable: true, cost: 1.5, foodCap: 1.4 },
  { name: 'Montanha', passable: false, cost: 1, foodCap: 0 },
  { name: 'Rio', passable: true, cost: 2.2, foodCap: 0 },
  { name: 'Roça', passable: true, cost: 1, foodCap: 5 },
];

// Paleta validada (dataviz): azul, laranja, violeta, verde. Forma do corpo é a codificação secundária.
export const SPECIES = {
  human: {
    key: 'human', name: 'Humano', plural: 'Humanos', sapient: true, color: '#3987e5', shape: 'circle',
    hp: 30, str: 5, spd: 0.11, vis: 8, agg: 0.35, soc: 0.6, fert: 0.55, life: 62, adult: 16,
    gestation: 0.5, litter: [1, 1], size: 0.36, pref: { 3: 1, 4: 0.5, 5: 0.4, 2: 0.2 }, hutsPer: 4, farmsPerHut: 3,
  },
  dwarf: {
    key: 'dwarf', name: 'Anão', plural: 'Anões', sapient: true, color: '#d95926', shape: 'square',
    hp: 38, str: 6, spd: 0.095, vis: 6, agg: 0.4, soc: 0.5, fert: 0.45, life: 95, adult: 20,
    gestation: 0.5, litter: [1, 1], size: 0.34, pref: { 5: 1, 3: 0.5, 4: 0.3, 2: 0.1 }, hutsPer: 4, farmsPerHut: 2,
  },
  elf: {
    key: 'elf', name: 'Elfo', plural: 'Elfos', sapient: true, color: '#9085e9', shape: 'diamond',
    hp: 26, str: 4.2, spd: 0.13, vis: 11, agg: 0.2, soc: 0.55, fert: 0.32, life: 140, adult: 25,
    gestation: 0.6, litter: [1, 1], size: 0.34, pref: { 4: 1, 3: 0.5, 5: 0.2, 2: 0.05 }, hutsPer: 4, farmsPerHut: 2,
  },
  orc: {
    key: 'orc', name: 'Orc', plural: 'Orcs', sapient: true, color: '#008300', shape: 'triangle',
    hp: 34, str: 6.5, spd: 0.11, vis: 7, agg: 0.72, soc: 0.4, fert: 0.8, life: 45, adult: 12,
    gestation: 0.4, litter: [1, 2], size: 0.4, pref: { 3: 1, 2: 0.7, 5: 0.5, 4: 0.3 }, hutsPer: 5, farmsPerHut: 1,
  },
  deer: {
    key: 'deer', name: 'Cervo', plural: 'Cervos', sapient: false, color: '#b98a5a', shape: 'deer',
    hp: 14, str: 1, spd: 0.13, vis: 9, agg: 0.02, soc: 0.8, fert: 0.9, life: 12, adult: 1.5,
    gestation: 0.3, litter: [1, 2], size: 0.3, diet: 'herb',
  },
  wolf: {
    key: 'wolf', name: 'Lobo', plural: 'Lobos', sapient: false, color: '#9aa0a8', shape: 'wolf',
    hp: 20, str: 4.5, spd: 0.145, vis: 9, agg: 0.8, soc: 0.6, fert: 0.6, life: 12, adult: 2,
    gestation: 0.3, litter: [1, 3], size: 0.32, diet: 'carn',
  },
  dragon: {
    key: 'dragon', name: 'Dragão', plural: 'Dragões', sapient: false, color: '#e0433a', shape: 'dragon',
    hp: 480, str: 26, spd: 0.2, vis: 16, agg: 0.95, soc: 0, fert: 0, life: 900, adult: 0,
    gestation: 1, litter: [0, 0], size: 1.1, diet: 'carn', flying: true,
  },
};
export const RACES = ['human', 'dwarf', 'elf', 'orc'];

// Simpatia natural entre povos (-1 a 1). Puxa as relações diplomáticas ao longo do tempo.
export const AFFINITY = {
  human: { human: 0.4, dwarf: 0.15, elf: 0.1, orc: -0.45 },
  dwarf: { human: 0.15, dwarf: 0.5, elf: -0.25, orc: -0.6 },
  elf: { human: 0.1, dwarf: -0.25, elf: 0.5, orc: -0.8 },
  orc: { human: -0.45, dwarf: -0.6, elf: -0.8, orc: 0.0 },
};

const SYL = {
  human: {
    a: ['Al', 'Bern', 'Ced', 'Dar', 'Ed', 'Gar', 'Hal', 'Is', 'Jor', 'Kal', 'Leo', 'Mar', 'Nor', 'Os', 'Ric', 'Tom', 'Ul', 'Wil', 'Bea', 'Cla', 'El', 'Ro'],
    m: ['ric', 'ard', 'win', 'mundo', 'berto', 'ton', 'aldo', 'vin', 'gar', 'mar'],
    f: ['ena', 'ia', 'wen', 'da', 'ra', 'isa', 'ina', 'ela', 'ana'],
  },
  dwarf: {
    a: ['Bal', 'Bor', 'Dur', 'Dwal', 'Gim', 'Gro', 'Kaz', 'Mor', 'Thor', 'Thra', 'Nar', 'Bof', 'Hel', 'Dag'],
    m: ['in', 'ur', 'ak', 'grim', 'li', 'dak', 'rin', 'dor', 'gar'],
    f: ['dis', 'na', 'hild', 'ra', 'la', 'dra', 'ris'],
  },
  elf: {
    a: ['Ae', 'Cel', 'El', 'Fae', 'Gal', 'Ith', 'Lae', 'Mir', 'Nae', 'Syl', 'Thal', 'Yl', 'Ara', 'Luth'],
    m: ['andil', 'oril', 'ion', 'anor', 'rond', 'dir', 'thas', 'ven'],
    f: ['wen', 'ien', 'ariel', 'ethil', 'iel', 'dra', 'wyn', 'lith'],
  },
  orc: {
    a: ['Gro', 'Ug', 'Mog', 'Azg', 'Gor', 'Sna', 'Bol', 'Lug', 'Ruk', 'Shag', 'Grish', 'Uz', 'Kra', 'Dur'],
    m: ['ash', 'nak', 'gul', 'rat', 'dush', 'ol', 'ak', 'bag', 'luk', 'mash'],
    f: ['ga', 'ra', 'sha', 'nka', 'ul', 'gra', 'ba'],
  },
  deer: { a: [''], m: [''], f: [''] },
  wolf: { a: [''], m: [''], f: [''] },
};
const DRAGON_NAMES = ['Vermithrax', 'Ancalagorn', 'Ignirath', 'Pyraxis', 'Morvhal', 'Skaldrun', 'Nyxathor', 'Cinzarion'];

export function makeName(rng, species, sex) {
  if (species === 'dragon') return rng.pick(DRAGON_NAMES);
  if (species === 'deer') return 'Cervo';
  if (species === 'wolf') return 'Lobo';
  const s = SYL[species];
  return rng.pick(s.a) + rng.pick(sex === 'F' ? s.f : s.m);
}

export function makeTribeName(rng, race) {
  const nameM = makeName(rng, race, 'M');
  switch (race) {
    case 'human': return rng.pick(['Casa de ', 'Povo de ', 'Clã de ', 'Estandarte de ']) + nameM;
    case 'dwarf': return 'Clã ' + nameM + ' ' + rng.pick(['Barba-de-Ferro', 'Punho-de-Pedra', 'Martelo-Rubro', 'Barba-de-Carvão', 'Escudo-de-Bronze']);
    case 'elf': return rng.pick(['Círculo de ', 'Filhos de ', 'Bosque de ', 'Canção de ']) + nameM;
    case 'orc': return 'Tribo ' + rng.pick(['Punho', 'Dente', 'Crânio', 'Sangue', 'Lâmina', 'Osso']) + '-' + rng.pick(['Negro', 'Quebrado', 'Rubro', 'Podre', 'de-Ferro', 'Uivante']);
  }
  return 'Tribo ' + nameM;
}

export const TRIBE_COLORS = ['#f2d24b', '#ff7eb6', '#4be3d0', '#ffffff', '#ff9d3b', '#b5ff5c', '#7ab8ff', '#ff5c5c', '#d6a6ff', '#c9c9c9', '#66ffa3', '#ffd9a6'];
