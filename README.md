# Aquário Medieval

Um mundo de fantasia medieval que vive sozinho. Não há jogador: humanos, anões, elfos e orcs nascem, trabalham, se apaixonam, constroem aldeias, brigam, guerreiam e morrem. Tudo acontece por conta própria, e você só assiste, como num aquário.

Nada da história é roteirizado. Guerras, vinganças, cismas, fomes e heróis que matam dragões surgem das regras simples que cada criatura segue.

## Como rodar

É um site estático, sem build e sem dependências.

```bash
npm start            # serve em http://localhost:8000
# ou qualquer servidor estático: python3 -m http.server
```

Abra `http://localhost:8000/?seed=42` para um mundo específico. A mesma semente sempre gera o mesmo mundo e a mesma história.

## O que existe no mundo

- **Terreno procedural**: relevo, mar, lagos, rios que descem das montanhas, campos, florestas, colinas e desertos. A vegetação cresce e se esgota conforme as estações, e o inverno é duro.
- **Quatro povos**, cada um com temperamento, longevidade, fertilidade e terreno preferido:
  - Humanos: equilibrados, crescem rápido.
  - Anões: fortes, lentos, vivem nas colinas.
  - Elfos: longevos, arqueiros, poucos filhos.
  - Orcs: fortes, agressivos, muitos filhos, vida curta.
- **Criaturas com necessidades** (fome, sede, sono, vida) e **genética**: força, velocidade, visão, longevidade, fertilidade, agressividade e sociabilidade passam de pais para filhos, com mutação.
- **Decisão por utilidade**: a cada momento, cada criatura pesa o que mais importa (beber, comer, dormir, fugir, lutar, trabalhar, namorar, conversar) e age.
- **Tribos**: acampamento, estoque de comida e madeira, cabanas, roças, líder e profissões (coletor, caçador, lenhador, agricultor). Tribos grandes demais sofrem **cismas**, e tribos famintas **migram**.
- **Diplomacia e guerra**: relações entre tribos mudam com afinidade entre raças, disputa por território, brigas e mortes. Guerras trazem ataques a aldeias, saques e cabanas incendiadas, até a paz.
- **Vida social**: amizades, casais, filhos, viuvez, juramentos de vingança contra quem matou um parente, apelidos conquistados ("o Implacável", "Caçador de Lobos", "Mata-Dragões").
- **Fauna**: cervos em manadas, lobos em alcateias, e um **dragão** que dorme por anos e desperta faminto.
- **Crônica** do mundo e **biografia** de cada criatura.

## Controles

- Arrastar move o mapa. Roda do mouse ou pinça dá zoom.
- Toque numa criatura para ver o que ela pensa, suas necessidades, família e biografia. "Seguir" mantém a câmera nela.
- Espaço pausa. Teclas 1 a 5 mudam a velocidade (pausa, 1×, 4×, 16×, 64×).

## Estrutura

```
index.html, style.css
src/
  data.js      constantes, espécies, nomes
  rng.js       aleatório determinístico e ruído
  world.js     terreno, rios, recursos, A*
  creature.js  necessidades, genética, decisões e ações
  tribe.js     aldeias, liderança, profissões, cisma, migração
  sim.js       tempo, diplomacia, guerras, ecologia, crônica
  render.js    desenho do mapa (canvas 2D)
  ui.js        painéis e gráfico
  main.js      laço principal e controles
tests/         testes (node --test)
tools/run.mjs  roda a simulação sem interface
```

## Desenvolvimento

```bash
npm test                    # testes de invariantes, determinismo e vitalidade do mundo
node tools/run.mjs 42 60    # simula 60 anos da semente 42 e imprime um resumo por ano
node tools/run.mjs 42 60 -v # idem, com os grandes eventos da crônica
```
