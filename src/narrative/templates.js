export function naturalMemory(m){return m?.text||'Nada marcante ainda.'}
export function chronicleLabel(type){return({nascimento:'Nascimento',morte:'Morte',construção:'Construção',combate:'Combate',dungeon:'Dungeon',vitória:'Vitória',relação:'Relação',ameaça:'Ameaça'})[type]||type}
