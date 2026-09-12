# AgentsRPG — Crônicas do Aquário

Simulador observacional de NPCs autônomos em fantasia medieval, feito em HTML5 Canvas e JavaScript puro para GitHub Pages e celular. O jogador não controla os NPCs: observa, inspeciona decisões e acompanha a história emergente.

## Núcleo

O cérebro dos NPCs é local e determinístico: necessidades, Utility AI, compromisso de ação, planejamento regressivo curto, memória, reflexão, genética, skills e relações. LLM não participa da tomada de decisão.

Esta revisão corrige os principais problemas encontrados nos testes longos:

- **commitment de ação:** viagens não são mais descartadas a cada nova decisão; teimosia genética aumenta a persistência e emergências interrompem apenas quando necessário;
- **água:** poço, retorno ao armazém, retirada e depósito comunitário e instrumentação de viagens;
- **agricultura real:** plantar consome trigo/semente, a lavoura cresce no tempo e a colheita devolve comida + parte das sementes; não existe mais comida criada do nada;
- **segurança genética:** lutar e fugir são opções normais da Utility AI, moduladas por agressividade, cautela e ameaça;
- **economia de ferro:** a forja consome ferro e madeira e produz ferramentas/armas que afetam coleta e combate; ferraria passa a ser uma profissão alcançável;
- **dungeon:** o save já usa `floors[].rooms[]`, mantendo um único andar no MVP e deixando a estrutura pronta para novos andares;
- **memória:** mortos são compactados para suas memórias mais importantes e relações antigas são liberadas;
- **persistência:** tiles determinísticos não são mais serializados, scores/planos são recomputados e autosave é agendado fora do step normal;
- **limite populacional:** atingir `MAX_NPCS` não lança mais exceção nem derruba o loop;
- **LOD:** NPCs calmos e fora da câmera têm decisões reduzidas; agentes em viagem, perigo ou necessidade relevante continuam no ciclo normal;
- **PWA:** todos os módulos essenciais entram no precache e o cache ganhou versão nova;
- **skills:** slots antigos continuam no formato de save por compatibilidade, mas apenas skills realmente treináveis aparecem e se propagam no jogo.

## Testes de balanceamento

`npm test` roda a suíte estatística multi-seed: 10 seeds por 300 dias, zero extinções, contrato de chefe morto em pelo menos 40% das seeds até o dia 250, round-trip de save/load, taxa mínima de conclusão de viagens e guarda de variância genética.

Scripts adicionais:

```bash
npm run diagnose   # tabela multi-seed de população, mortes, recursos, genes e save
npm run long       # seed 7919 por 600 dias
npm run travel     # conclusão/abandono de viagens, incluindo água separadamente
```

Na instrumentação usada nesta revisão, a seed 7919 passou de ~6% de conclusão das viagens de água para aproximadamente 99% em 200 dias. A corrida de 600 dias termina com população viva e save abaixo de 200 KB na medição atual.

## Executar

Não há build nem dependências de runtime:

```bash
python3 -m http.server 8000
```

ou publique a branch `main` no GitHub Pages.
