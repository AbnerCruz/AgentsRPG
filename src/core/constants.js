export const VERSION=9;
export const MAP_W=192, MAP_H=192, TILE=16, MAX_NPCS=512, MAX_ANIMALS=1200;
export const DAY_TICKS=840;
export const TECH_COUNT=43;

export const NEED={HUNGER:0,THIRST:1,SLEEP:2,TEMP:3,SAFETY:4,SOCIAL:5,PURPOSE:6,COUNT:7};
export const GENE={STRENGTH:0,ENDURANCE:1,SPEED:2,DEXTERITY:3,FERTILITY:4,LONGEVITY:5,METABOLISM:6,DISEASE:7,COLD:8,LEARNING:9,MEMORY:10,PERCEPTION:11,CREATIVITY:12,AGGRESSION:13,SOCIABILITY:14,AMBITION:15,CAUTION:16,LOYALTY:17,GREED:18,CURIOSITY:19,STUBBORN:20,EMPATHY:21,SKIN:22,HAIR:23,HEIGHT:24,BUILD:25,HEARING:26,SMELL:27,RARE_A:26,RARE_B:27,COUNT:28};
export const SKILLS=['mineração','lenha','agricultura','caça','pesca','culinária','construção','ferraria','marcenaria','alfaiataria','combate','arco','cura','negociação'];

export const RESOURCE={LOG:0,STONE:1,IRON:2,GRAIN:3,WATER:4,LEATHER:5,BERRY:6,MEAT:7,FISH:8,PRESERVED:9,WOOL:10,CLAY:11,SEED:12,EGG:13,MILK:14,SALT:15,BONE:16,TENDON:17,FAT:18,MANURE:19,COUNT:20,NAMES:['toras','pedra','ferro','grãos','água','couro','frutas','carne','peixe','conserva','lã','argila','sementes','ovos','leite','sal','osso','tendão','gordura','esterco']};
export const FOOD_KINDS=new Set([RESOURCE.GRAIN,RESOURCE.BERRY,RESOURCE.MEAT,RESOURCE.FISH,RESOURCE.PRESERVED,RESOURCE.EGG,RESOURCE.MILK,RESOURCE.FAT]);
export const NUTRITION={FRESH:0,PROTEIN:1,ENERGY:2,PLANT:0,GRAIN:2,COUNT:3,NAMES:['frescos','proteína','energia']};
export const FOOD_STATE={FRESH:0,RIPE:1,SPOILED:2,ROTTEN:3,NAMES:['fresco','maduro','estragado','podre']};
export const WOUND_TYPE={CUT:0,PUNCTURE:1,CONTUSION:2,BURN:3,FRACTURE:4,NAMES:['corte','perfuração','contusão','queimadura','fratura']};
export const BODY_REGION={HEAD:0,TORSO:1,ARMS:2,LEGS:3,NAMES:['cabeça','tronco','braços','pernas']};
export const CLOTHING={FUR:1,LEATHER:2,WOOL:4};

export const TILE_TYPE={GRASS:0,WATER:1,FOREST:2,STONE:3,MOUNTAIN:4,MARSH:5,BEACH:6,TRAIL:7,PATH:8,ROAD:9,DUNGEON:10,BUILDING:11};
export const WATER_KIND={NONE:0,OCEAN:1,LAKE:2,RIVER:3};
export const BIOME={FIELD:0,OPEN_FOREST:1,DENSE_FOREST:2,ROCK:3,MOUNTAIN:4,MARSH:5,BEACH:6,WATER:7,BOREAL:8,STEPPE:9,NAMES:['campo','bosque','floresta densa','rochedo','alta montanha','pântano','praia','água','floresta boreal','estepe seca']};

export const BUILDING={SHELTER:0,FARM:1,FORGE:2,STORAGE:3,WELL:4,CAMPFIRE:5,WORKSHOP:6,COOP:7,CELLAR:8,NAMES:['abrigo','fazenda','forja','armazém','poço','fogueira','oficina','cercado','adega']};
export const BLOCK={FLOOR:0,WALL:1,DOOR:2,ROOF:3,FIRE:4,WELL:5,NAMES:['piso','parede','porta','telhado','fogueira','poço']};
export const TOOL={NONE:0,AXE:1,PICK:2,HAMMER:3,KNIFE:4,ROD:5,BOW:6,SWORD:7,NAMES:['nenhuma','machado','picareta','martelo','faca','vara','arco','espada']};
export const ARMOR={NONE:0,CLOTH:1,LEATHER:2,IRON:3,NAMES:['sem armadura','tecido','couro','ferro']};
export const PROF=['sem profissão','fazendeiro','lenhador','minerador','ferreiro','guerreiro','caçador','pescador','cozinheiro','construtor','alfaiate','curandeiro'];

export const ACTION={
 IDLE:'observar',RETURN:'voltar para abrigo',EAT:'comer',DRINK:'beber',SLEEP:'dormir',WARM:'aquecer-se',FLEE:'fugir',
 FORAGE:'coletar frutos',WATER:'buscar água',WOOD:'cortar madeira',STONE:'coletar pedra',IRON:'minerar ferro',FARM:'cultivar',FISH:'pescar',HUNT:'caçar',
 COOK:'cozinhar',TAILOR:'costurar',FORGE:'forjar',CARE:'tratar ferido',SOCIAL:'conversar',BUILD:'construir',EXPLORE:'explorar',DUNGEON:'explorar dungeon',FIGHT:'lutar',TEACH:'ensinar'
};
export const ACTION_LIST=Object.freeze(Object.values(ACTION));
export const ACTION_ID=Object.freeze(Object.fromEntries(ACTION_LIST.map((name,index)=>[name,index])));
export const ACTION_BY_ID=ACTION_LIST;
export const TRAVEL_ACTIONS=new Set([ACTION.RETURN,ACTION.FORAGE,ACTION.WATER,ACTION.WOOD,ACTION.STONE,ACTION.IRON,ACTION.FARM,ACTION.FISH,ACTION.HUNT,ACTION.CARE,ACTION.SOCIAL,ACTION.BUILD,ACTION.EXPLORE,ACTION.DUNGEON,ACTION.FIGHT,ACTION.FLEE]);
export const NPC_STATE={IDLE:0,MOVING:1,WORKING:2,INTERACTING:3,SLEEPING:4,NAMES:['ocioso','movendo-se','trabalhando','interagindo','dormindo']};

// IDs 0..6 are kept stable for v7 save compatibility.
export const ANIMAL={DEER:0,RABBIT:1,BOAR:2,WOLF:3,BEAR:4,CHICKEN:5,GOAT:6,HARE:7,MOOSE:8,FELINE:9,SHEEP:10,PIG:11,CATTLE:12,BIRD:13,NAMES:['cervo','coelho','javali','lobo','urso','galinha','cabra','lebre','alce','felino','ovelha','porco','boi','ave']};
export const ANIMAL_STATE={GRAZE:0,DRINK:1,WATCH:2,FLEE:3,HUNT:4,REST:5,MATE:6,NAMES:['pastar','beber','vigiar','fugir','caçar','descansar','acasalar']};
export const ANIMAL_INFO={
 [ANIMAL.DEER]:{herbivore:true,herd:true,domesticable:false,speed:.19,hp:.55,meat:1.6,leather:.6,power:.12,hearing:.9,smell:.82,repro:.010,baseK:6,biomes:[BIOME.FIELD,BIOME.OPEN_FOREST,BIOME.DENSE_FOREST,BIOME.BOREAL]},
 [ANIMAL.RABBIT]:{herbivore:true,herd:true,domesticable:false,small:true,speed:.22,hp:.18,meat:.35,leather:.08,power:.02,hearing:.9,smell:.7,repro:.035,baseK:12,biomes:[BIOME.FIELD,BIOME.OPEN_FOREST,BIOME.STEPPE]},
 [ANIMAL.BOAR]:{herbivore:true,herd:true,domesticable:true,dangerous:true,speed:.16,hp:.8,meat:2.1,leather:.7,power:.34,hearing:.72,smell:.92,repro:.012,baseK:4,biomes:[BIOME.DENSE_FOREST,BIOME.OPEN_FOREST,BIOME.MARSH]},
 [ANIMAL.WOLF]:{predator:true,pack:true,herd:true,domesticable:false,night:true,speed:.24,hp:.65,meat:.5,leather:.45,power:.38,hearing:.95,smell:1,repro:.006,baseK:2,biomes:[BIOME.OPEN_FOREST,BIOME.DENSE_FOREST,BIOME.BOREAL,BIOME.FIELD]},
 [ANIMAL.BEAR]:{predator:true,domesticable:false,night:true,dangerous:true,speed:.17,hp:1.5,meat:2.8,leather:1.2,power:.68,hearing:.75,smell:1,repro:.0025,baseK:.7,biomes:[BIOME.DENSE_FOREST,BIOME.BOREAL,BIOME.MOUNTAIN]},
 [ANIMAL.CHICKEN]:{herbivore:true,domesticable:true,small:true,speed:.11,hp:.15,meat:.3,product:'egg',power:.01,hearing:.7,smell:.35,repro:.03,baseK:4,biomes:[BIOME.FIELD,BIOME.OPEN_FOREST]},
 [ANIMAL.GOAT]:{herbivore:true,herd:true,domesticable:true,speed:.13,hp:.5,meat:.8,leather:.35,product:'milk',power:.08,hearing:.72,smell:.62,repro:.014,baseK:3,biomes:[BIOME.ROCK,BIOME.STEPPE,BIOME.FIELD]},
 [ANIMAL.HARE]:{herbivore:true,herd:true,domesticable:false,small:true,speed:.24,hp:.2,meat:.4,leather:.06,power:.02,hearing:.95,smell:.68,repro:.032,baseK:9,biomes:[BIOME.FIELD,BIOME.STEPPE,BIOME.OPEN_FOREST]},
 [ANIMAL.MOOSE]:{herbivore:true,herd:true,domesticable:false,dangerous:true,speed:.15,hp:1.25,meat:3.2,leather:1.05,power:.46,hearing:.78,smell:.85,repro:.005,baseK:1.5,biomes:[BIOME.BOREAL,BIOME.MARSH,BIOME.OPEN_FOREST]},
 [ANIMAL.FELINE]:{predator:true,domesticable:false,night:true,speed:.26,hp:.55,meat:.35,leather:.4,power:.36,hearing:.92,smell:.8,repro:.005,baseK:1.2,biomes:[BIOME.ROCK,BIOME.OPEN_FOREST,BIOME.STEPPE]},
 [ANIMAL.SHEEP]:{herbivore:true,herd:true,domesticable:true,speed:.12,hp:.45,meat:.7,leather:.2,product:'wool',power:.04,hearing:.68,smell:.55,repro:.014,baseK:3,biomes:[BIOME.FIELD,BIOME.STEPPE]},
 [ANIMAL.PIG]:{herbivore:true,herd:true,domesticable:true,speed:.13,hp:.65,meat:1.5,leather:.35,power:.16,hearing:.65,smell:.9,repro:.02,baseK:3,biomes:[BIOME.OPEN_FOREST,BIOME.FIELD,BIOME.MARSH]},
 [ANIMAL.CATTLE]:{herbivore:true,herd:true,domesticable:true,dangerous:true,speed:.1,hp:1.35,meat:3.5,leather:1.1,product:'milk',power:.35,hearing:.62,smell:.6,repro:.006,baseK:1.4,biomes:[BIOME.FIELD,BIOME.STEPPE]},
 [ANIMAL.BIRD]:{herbivore:true,herd:true,domesticable:false,small:true,speed:.28,hp:.1,meat:.16,power:.01,hearing:.95,smell:.25,repro:.04,baseK:10,biomes:[BIOME.FIELD,BIOME.OPEN_FOREST,BIOME.DENSE_FOREST,BIOME.MARSH]}
};

export const DUNGEON_COUNT=6;
export const MAX_BUBBLES=6;
