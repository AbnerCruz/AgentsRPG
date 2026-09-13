# AgentsRPG v3 — Crônicas do Aquário

Simulador 2D top-down de NPCs autônomos para navegador, mobile-first e sem backend. O observador não controla personagens.

## v3

A v3 reconstrói o motor em torno de duas camadas: **decisão esparsa** e **execução contínua**. NPCs mantêm uma intenção até concluir ou sofrer uma interrupção legítima; movimento, trabalho, stamina e progresso avançam a cada tick.

Principais sistemas:

- movimento contínuo, interpolação, orientação e A* com cache;
- mapa mental individual limitado por percepção e memória genética;
- transmissão social de conhecimento espacial;
- geração procedural em camadas: elevação, hidrologia, umidade e biomas;
- recursos coerentes por bioma e caminhos emergentes por tráfego;
- comida perecível, nutrição, temperatura, roupa, fogo, ferimentos e infecção;
- coleta com duração, ferramentas, agricultura com plantio/crescimento/colheita;
- construção por blueprint e peças físicas;
- fauna com herbívoros, predadores e animais domésticos;
- ciclo dia/noite longo e monstros noturnos;
- múltiplas dungeons, chefe em local desconhecido e indícios transmitidos como memória;
- sprites procedurais em camadas, equipamentos visíveis, luzes, sombras, pensamentos, fala e barras de progresso;
- saves IndexedDB, recuperação offline e PWA.

## Testes

```bash
npm test
npm run test:world
npm run test:travel
npm run test:multi
```

A suíte inclui histograma de ações, diagnóstico de viagens e geração multi-seed para evitar regressões que testes de sobrevivência isolados não detectam.
