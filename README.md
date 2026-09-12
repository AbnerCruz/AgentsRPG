# AgentsRPG — Crônicas do Aquário

Simulador observacional de NPCs autônomos em fantasia medieval, feito em HTML5 Canvas e JavaScript puro para rodar diretamente no GitHub Pages, inclusive em celular. O jogador não controla os NPCs: observa, inspeciona decisões e acompanha a história emergente.

## Arquitetura

O núcleo não usa LLM. Cada NPC combina necessidades, Utility AI, planejamento regressivo curto, genética, skills, memória e reflexão. O estado numérico principal usa TypedArrays; o mundo usa RNG com seed reproduzível. O app salva snapshots em IndexedDB e, ao retornar, recupera parte do tempo transcorrido em modo acelerado.

Principais sistemas implementados:

- necessidades: fome, sede, sono, temperatura, segurança, social e propósito;
- Utility AI com top scores visíveis no painel do NPC;
- planejador com pré-requisitos, plano atual e justificativa;
- memória episódica, semântica e relacional; recuperação e crenças por reflexão;
- genoma de 28 traços, herança, mutação, atributos derivados e variação visual;
- ciclo de vida, infância, aprendizagem com adultos, casais, reprodução, morte e genealogia;
- skills por uso e profissões emergentes;
- recursos finitos, estoques, agricultura, coleta e construção autônoma;
- combate, ataques da dungeon, prestígio, expedições e mini-chefe;
- crônica, painel de mundo, médias genéticas, estoque e histórico populacional;
- Canvas pixel art, câmera com pan, zoom/pinch e inspeção por toque;
- velocidades pausa, 1×, 4×, 16× e avanço rápido;
- PWA/cache offline e persistência IndexedDB.

## Executar

Não há build nem dependências de runtime. Sirva a raiz por HTTP:

```bash
python3 -m http.server 8000
```

ou publique a branch `main` no GitHub Pages.

## Teste de simulação

Requer apenas Node.js moderno:

```bash
npm test
```

O smoke test roda 120 dias simulados, verifica sobrevivência, construção, crônica, conclusão da dungeon e round-trip de save/load.

## Estrutura

- `src/core`: clock, loop, RNG, persistência e constantes
- `src/world`: geração do mapa, recursos e estruturas
- `src/entities`: armazenamento dos NPCs
- `src/ai`: drives, Utility AI, planner e memória
- `src/genetics`: genoma, herança e atributos derivados
- `src/systems`: ações, profissões, relações, reprodução e ciclo de vida
- `src/dungeon`: pressão externa, expedições, salas e chefe
- `src/render`: Canvas, câmera e pixel art
- `src/ui`: observação, inspeção, crônica, mundo e linhagens
- `src/narrative`: templates locais de narração

## Princípio de produto

O observatório é a interface principal: toda decisão deve poder ser investigada sem dar ordens ao NPC. A narrativa nasce dos sistemas e das memórias, não de eventos roteirizados.
