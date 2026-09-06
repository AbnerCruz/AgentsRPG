# Mesa

Mesa de RPG com agentes de IA. Site estático (HTML/CSS/JS puro, sem build, sem backend),
pronto para GitHub Pages: suba todos os arquivos na raiz do repositório e ative o Pages.

Teste local: os módulos ES precisam ser servidos por HTTP, não abertos como `file://`.
`python3 -m http.server` na pasta resolve.

## O que mudou nesta versão

- **O cenário é a interface.** Canvas 2D topdown em tela cheia, sempre ativo. Tudo mais flutua
  por cima: barra fina no topo, narração na base, painel lateral só quando chamado.
- **Modelos por seleção**, carregados da própria OpenRouter, ordenados do mais barato ao mais caro,
  com preço por milhão de tokens visível na opção.
- **Saldo sincroniza sozinho** — no boot e a cada 2 minutos. O botão foi embora.
- **Agentes leem uns aos outros.** Existe um buffer de cena compartilhado: tudo que o mestre, o
  jogador e cada agente dizem entra nele, e cada agente recebe as últimas falas no prompt. Era isso
  que faltava para eles reagirem entre si.
- **PDF vira artefato automaticamente**, com barra de progresso página a página e tipo detectado
  (regras / aventura / ambientação / ficha).
- **Fichas montadas pelo sistema.** A IA escolhe só o conceito (nome, raça, classe, traço, objetivo)
  em uma chamada curta; atributos, PV, CA, perícias e inventário são rolados e calculados localmente
  pelo SRD 5e — aritmética não gasta token.
- **Campo de visão real.** Raycast por tile, bloqueado por paredes e árvores. Cada agente recebe no
  prompt a descrição do que enxerga: posição, passagens livres, quem está à vista e a que distância.
  Névoa de guerra no canvas para o que ainda não foi explorado.
- **O mestre usa ferramentas reais.** Ele pode requisitar `mapa` (o site gera proceduralmente:
  masmorra, caverna, floresta, vila), `artefato` (registro permanente no acervo) e `rolagem`.
  Ele requisita; o site executa. O agente nunca desenha nem inventa ferramenta.
- **O mestre consulta antes de criar.** Na abertura, procura no acervo se já existe uma aventura
  registrada. Existindo, retoma de onde parou; não existindo, cria a premissa e registra como artefato.
- **A interface se adapta ao modo.** No modo espectador, o campo de texto some e aparece play/pause.
  No modo mestre-humano, o placeholder e o fluxo mudam (auxiliar traduz a narração para os agentes).

## Arquivos

`index.html` `style.css` — interface. `world.js` — mapa, tokens, campo de visão, render.
`director.js` — orquestração de turnos por modo. `agent.js` — agentes e ações estruturadas.
`memory.js` — buffer de cena compartilhado + memória longa/curta filtrada em JS puro.
`srd5e.js` — SRD embutido e montagem automática de ficha. `artifacts.js` — acervo e importação de PDF.
`budget.js` — caixa lastreado e limite por sessão. `openrouter.js` `db.js` `main.js`.

Bibliotecas via CDN em runtime: JSZip e pdf.js.

## Economia de tokens

Nada é cortado no meio: a chamada em andamento sempre termina. O que reduz custo é a arquitetura:
saída em JSON compacto, buffer de cena curto, memória filtrada por tags sem IA, aritmética de ficha
local, mapas gerados proceduralmente, e `reasoning: low` nas chamadas. Ao atingir o limite artificial
da sessão (limite total menos a reserva calculada para o resumo de fechamento), o mestre gera o
resumo, grava na memória de todos e a sessão encerra — a sobra volta ao caixa.

Atalho: digitar `/1d20+3` rola o dado localmente, sem chamada de IA.

## Correções desta revisão

- **Modelos de imagem apareciam vazios.** A classificação confundia modelos que *leem* imagem
  (visão, modalidade `text+image->text`) com os que *geram* imagem. Agora a checagem é feita no
  lado da saída da modalidade, com o mais barato pré-selecionado.
- **Modelos com custo zero são reais.** A OpenRouter mantém modelos gratuitos (geralmente com
  sufixo `:free`), com limite de requisições e fila compartilhada. Ficam em um grupo separado no
  seletor, marcados como gratuitos, e a sugestão padrão nunca os escolhe — servem para testar, não
  para sustentar uma sessão inteira.
- **Voltava para a tela de chaves ao reabrir.** O mapa nunca era salvo depois da criação, então a
  retomada falhava. Agora chaves, configuração e mundo são gravados antes de qualquer chamada de
  IA, e a retomada só exige chaves e elenco — se o mapa se perder, ele é regenerado e os tokens
  recolocados, sem reiniciar a campanha.
- **"Abrindo a cena" travava em silêncio.** O erro da primeira chamada do mestre era engolido.
  Agora aparece no log do setup e no feed, a tela de setup fecha de qualquer jeito, e há um botão
  para tentar de novo. Além disso, modelos que rejeitam `response_format: json_object` agora são
  detectados e a chamada é repetida sem esse parâmetro.
- **Acervo por categoria.** Ao anexar, você escolhe o que o material é — regras, aventura,
  ambientação, bestiário, ficha/template ou homebrew — e cada categoria traz uma linha explicando
  como o mestre vai usar aquilo. O acervo passa a listar agrupado por categoria.

## Limites conhecidos

- SRD 5e embutido é um núcleo (raças, classes, perícias, ficha, regras de resolução), não o SRD 5.1
  completo com todas as magias e monstros.
- Extração de PDF é texto puro — sem OCR para PDFs escaneados como imagem.
- O modelo de imagem já é selecionável, mas ainda não há um gatilho de geração de retrato no fluxo
  de jogo; a chamada existe em `openrouter.js` e falta ligá-la a um botão na ficha.
- Combate por iniciativa formal (ordem de turno em rodadas) ainda não é imposto pelo sistema: os
  turnos correm na ordem do elenco. Movimento respeita paredes e casas ocupadas, mas o teto de
  deslocamento por turno ainda não é bloqueado.
- Modo espectador roda em tempo real com intervalo fixo de ~1,2s entre rodadas.
