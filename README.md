# Mesa RPG IA

Site estático (HTML/CSS/JS puro, sem build, sem backend) para rodar uma mesa de RPG com agentes
de IA via OpenRouter. Pronto para GitHub Pages: suba todos os arquivos deste zip na raiz do
repositório (ou de uma branch/pasta configurada como fonte do Pages) e ative o Pages nas
configurações do repositório.

## Como publicar
1. Crie um repositório novo no GitHub.
2. Suba todos os arquivos deste zip **direto na raiz** (sem subpastas).
3. Em Settings → Pages, selecione a branch `main` e pasta `/root`.
4. Acesse a URL gerada (`https://seu-usuario.github.io/nome-do-repo/`).

## Arquitetura
- `index.html` / `style.css` — interface (abas: Configuração, Sessão Zero, Mesa, Memória, Artefatos, Save/Backup).
- `db.js` — persistência 100% local via IndexedDB do navegador; export/import de tudo em `.zip`.
- `openrouter.js` — cliente da API OpenRouter (chat, imagem, saldo, lista de modelos).
- `session.js` — controla o caixa lastreado, o limite artificial por sessão e o resumo de fechamento obrigatório.
- `memory.js` — memória longa + curta por agente, com filtro por tag/palavra-chave em **JS puro** (custo zero de IA) antes de qualquer chamada.
- `agent.js` — cada agente (jogador, mestre ou auxiliar): ficha, memória, decisão, prompt econômico.
- `srd5e.js` — D&D 5e SRD (System Reference Document, licença aberta) embutido como sistema padrão.
- `rules.js` — dados, iniciativa, extração de texto de PDF (via pdf.js) com cache.
- `tools.js` — mapa em grid quadriculado, acervo de artefatos, imagens geradas.
- `main.js` — bootstrap e wiring de toda a interface.

Bibliotecas externas (via CDN, carregadas em tempo de execução no navegador — não fazem parte
do código-fonte): **JSZip** (export/import) e **pdf.js** (leitura de PDF).

## Sobre chaves e privacidade
API Key e Management Key da OpenRouter ficam salvas **apenas no IndexedDB do seu navegador**.
Nada é enviado a nenhum servidor além da própria API da OpenRouter. Isso também significa que
trocar de navegador/dispositivo exige exportar e importar o save manualmente (aba Save/Backup).

## Limitações conhecidas desta primeira versão (v1) — pontos para iterar
Esta entrega cobre toda a arquitetura decidida no planejamento e funciona de ponta a ponta, mas
alguns pontos foram simplificados para caber numa primeira versão testável:

- **SRD 5e embutido é um resumo**, não o SRD 5.1 completo (que tem centenas de páginas de
  magias, monstros e itens). Cobre raças, classes, perícias, template de ficha e regras
  essenciais de fallback. Pode ser expandido depois.
- **Extração de PDF** usa busca por palavra-chave em texto puro (rápida, sem custo de IA) — não
  interpreta tabelas complexas ou PDFs escaneados como imagem (sem OCR nesta versão).
- **Modelo de imagem**: o campo de configuração aceita qualquer modelo com suporte a imagem da
  OpenRouter; não há uma lista curada embutida ainda — verifique na OpenRouter quais modelos de
  imagem estão disponíveis e seus preços antes de definir como padrão.
- **Orquestração de turnos** no modo "jogador é mestre" já segue o fluxo aprovado (jogador narra
  → auxiliar interpreta → jogador aprova → distribui aos agentes), mas a tela de aprovação do
  jogador antes do envio ainda não tem uma interface dedicada de "revisar e aprovar" — hoje o
  auxiliar e os agentes reagem em sequência direto no log. Se esse passo de aprovação explícita
  for essencial para você, é a próxima coisa a implementar.
- **Modo "somente agentes" (espectador)** com play/pause em tempo real ainda não tem o loop
  automático de turnos rodando sozinho — a estrutura de dados e agentes já suporta, falta o
  temporizador/loop de execução automática.
- **Movimento no grid** aplica o limite de deslocamento apenas quando o token tem uma origem de
  turno marcada (via `startTurnFor`) — ainda não há um botão de "iniciar turno" na interface.

Nenhum desses pontos exige mudar a arquitetura — são extensões sobre o que já está pronto.
