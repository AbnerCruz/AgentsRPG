export const VERSION=5;
export const MAP_W=192, MAP_H=192, TILE=16, MAX_NPCS=512, MAX_ANIMALS=900;
export const DAY_TICKS=840;

export const NEED={HUNGER:0,THIRST:1,SLEEP:2,TEMP:3,SAFETY:4,SOCIAL:5,PURPOSE:6,COUNT:7};
export const GENE={STRENGTH:0,ENDURANCE:1,SPEED:2,DEXTERITY:3,FERTILITY:4,LONGEVITY:5,METABOLISM:6,DISEASE:7,COLD:8,LEARNING:9,MEMORY:10,PERCEPTION:11,CREATIVITY:12,AGGRESSION:13,SOCIABILITY:14,AMBITION:15,CAUTION:16,LOYALTY:17,GREED:18,CURIOSITY:19,STUBBORN:20,EMPATHY:21,SKIN:22,HAIR:23,HEIGHT:24,BUILD:25,RARE_A:26,RARE_B:27,COUNT:28};
export const SKILLS=['mineração','lenha','agricultura','caça','pesca','culinária','construção','ferraria','marcenaria','alfaiataria','combate','arco','cura','negociação'];

export const RESOURCE={LOG:0,STONE:1,IRON:2,GRAIN:3,WATER:4,LEATHER:5,BERRY:6,MEAT:7,FISH:8,PRESERVED:9,WOOL:10,CLAY:11,SEED:12,EGG:13,MILK:14,SALT:15,COUNT:16,NAMES:['toras','pedra','ferro','grãos','água','couro','frutas','carne','peixe','conserva','lã','argila','sementes','ovos','leite','sal']};
export const FOOD_KINDS=new Set([RESOURCE.GRAIN,RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK]);
export const NUTRITION={PLANT:0,PROTEIN:1,GRAIN:2,COUNT:3};

export const TILE_TYPE={GRASS:0,WATER:1,FOREST:2,STONE:3,MOUNTAIN:4,MARSH:5,BEACH:6,TRAIL:7,PATH:8,ROAD:9,DUNGEON:10,BUILDING:11};
export const WATER_KIND={NONE:0,OCEAN:1,LAKE:2,RIVER:3};
export const BIOME={FIELD:0,OPEN_FOREST:1,DENSE_FOREST:2,ROCK:3,MOUNTAIN:4,MARSH:5,BEACH:6,WATER:7,BOREAL:8,STEPPE:9,NAMES:['campo','bosque','floresta densa','rochedo','alta montanha','pântano','praia','água','floresta boreal','estepe seca']};

export const BUILDING={SHELTER:0,FARM:1,FORGE:2,STORAGE:3,WELL:4,CAMPFIRE:5,WORKSHOP:6,COOP:7,NAMES:['abrigo','fazenda','forja','armazém','poço','fogueira','oficina','galinheiro']};
export const BLOCK={FLOOR:0,WALL:1,DOOR:2,ROOF:3,FIRE:4,WELL:5,NAMES:['piso','parede','porta','telhado','fogueira','poço']};
export const TOOL={NONE:0,AXE:1,PICK:2,HAMMER:3,KNIFE:4,ROD:5,BOW:6,SWORD:7,NAMES:['nenhuma','machado','picareta','martelo','faca','vara','arco','espada']};
export const ARMOR={NONE:0,CLOTH:1,LEATHER:2,IRON:3,NAMES:['sem armadura','tecido','couro','ferro']};
export const PROF=['sem profissão','fazendeiro','lenhador','minerador','ferreiro','guerreiro','caçador','pescador','cozinheiro','construtor','alfaiate','curandeiro'];

export const ACTION={
 IDLE:'observar',RETURN:'voltar para vila',EAT:'comer',DRINK:'beber',SLEEP:'dormir',WARM:'aquecer-se',FLEE:'fugir',
 FORAGE:'coletar frutos',WATER:'buscar água',WOOD:'cortar madeira',STONE:'coletar pedra',IRON:'minerar ferro',FARM:'cultivar',FISH:'pescar',HUNT:'caçar',
 COOK:'cozinhar',TAILOR:'costurar',FORGE:'forjar',CARE:'tratar ferido',SOCIAL:'conversar',BUILD:'construir',EXPLORE:'explorar',DUNGEON:'explorar dungeon',FIGHT:'lutar'
};
export const ACTION_LIST=Object.freeze(Object.values(ACTION));
export const ACTION_ID=Object.freeze(Object.fromEntries(ACTION_LIST.map((name,index)=>[name,index])));
export const ACTION_BY_ID=ACTION_LIST;
export const TRAVEL_ACTIONS=new Set([ACTION.RETURN,ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FARM,ACTION.FISH,ACTION.HUNT,ACTION.CARE,ACTION.SOCIAL,ACTION.BUILD,ACTION.DUNGEON,ACTION.FIGHT,ACTION.FLEE]);
export const NPC_STATE={IDLE:0,MOVING:1,WORKING:2,INTERACTING:3,SLEEPING:4,NAMES:['ocioso','movendo-se','trabalhando','interagindo','dormindo']};

export const ANIMAL={DEER:0,RABBIT:1,BOAR:2,WOLF:3,BEAR:4,CHICKEN:5,GOAT:6,NAMES:['cervo','coelho','javali','lobo','urso','galinha','cabra']};
export const ANIMAL_INFO={
 [ANIMAL.DEER]:{herbivore:true,speed:.19,hp:.55,meat:1.6,leather:.6,herd:true},
 [ANIMAL.RABBIT]:{herbivore:true,speed:.22,hp:.18,meat:.35,leather:.08,herd:true},
 [ANIMAL.BOAR]:{herbivore:true,speed:.16,hp:.8,meat:2.1,leather:.7,aggressive:.35},
 [ANIMAL.WOLF]:{predator:true,speed:.24,hp:.65,meat:.5,leather:.45,night:true},
 [ANIMAL.BEAR]:{predator:true,speed:.17,hp:1.5,meat:2.8,leather:1.2,night:true},
 [ANIMAL.CHICKEN]:{domestic:true,speed:.11,hp:.15,meat:.3,product:'egg'},
 [ANIMAL.GOAT]:{domestic:true,herbivore:true,speed:.13,hp:.5,meat:.8,leather:.35,product:'wool'}
};

export const DUNGEON_COUNT=6;
export const MAX_BUBBLES=6;
