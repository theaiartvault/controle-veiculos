# Controle de Chaves — Viva Mais Barueri

PWA para controle de entrada e saída de chaves na portaria. Funciona offline, pode ser instalado na tela inicial do celular, e guarda todo o histórico no próprio navegador (localStorage).

## Estrutura

```
controle-chaves/
├── index.html              → app principal
├── manifest.json            → configuração do PWA (nome, ícone, cor)
├── sw.js                    → service worker (cache offline)
├── icon-192.png
├── icon-512.png
├── icon-192-maskable.png
└── icon-512-maskable.png
```

Todos os arquivos ficam soltos na raiz do repositório — sem subpasta — igual ao repositório da Ficha de Plantão.

## Como publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `controle-chaves`).
2. Suba **todos os arquivos direto na raiz** do repositório (não dentro de nenhuma subpasta).
3. No repositório, vá em **Settings → Pages**.
4. Em "Source", selecione a branch `main` e a pasta `/ (root)`.
5. Salve. Em alguns minutos o GitHub vai gerar o link, algo como:
   `https://seu-usuario.github.io/controle-chaves/`

## Como instalar no celular (igual à Ficha de Plantão)

**Android (Chrome):** abra o link → menu (⋮) → "Adicionar à tela inicial".
**iPhone (Safari):** abra o link → ícone de compartilhar → "Adicionar à Tela de Início".

Depois de instalado uma vez com internet, o app abre normalmente mesmo sem sinal — os dados ficam salvos no próprio celular.

## Importante sobre os dados

Os dados (quais chaves estão fora, histórico de retiradas/devoluções) ficam salvos **no navegador do dispositivo onde foi instalado** (localStorage). Isso significa:

- Se você instalar no celular da portaria, os dados ficam ali, naquele aparelho.
- Se abrir em outro celular ou limpar os dados do navegador, o histórico daquele aparelho se perde.
- **Não é compartilhado automaticamente entre o seu celular e o celular da portaria** — cada instalação tem seu próprio armazenamento local.

Se no futuro você quiser que vários pontos (seu celular + portaria + outro vigia) vejam o mesmo controle em tempo real, isso exige um banco de dados central (ex: Firebase, Supabase) — é um passo adiante que posso te ajudar a montar quando fizer sentido pra rotina de vocês.

## Atualizando o quadro de chaves

Se uma chave for trocada, criada ou removida, edite a lista `CHAVES_DATA` dentro do `index.html` (procure por `const CHAVES_DATA = [`). Cada chave segue este formato:

```js
{ num: 1, nome: "Nome do espaço", cor: "rosa", quemRetira: "morador" }
```

- `cor`: `rosa`, `branca`, `azul` ou `amarela` (mesmas cores do quadro físico)
- `quemRetira`: `morador` (libera retirada por moradores) ou `equipe` (só zelador/manutenção/síndico)

## Botão "Imprimir / Salvar PDF"

No topo do app, toque em **Imprimir / Salvar PDF**. Vai abrir uma tela pra escolher data inicial e final do relatório. Depois de gerar, abre a janela de impressão do navegador — no celular, normalmente já aparece a opção **"Salvar como PDF"** direto nessa tela.

O relatório mostra:
- Resumo numérico (quantas retiradas, devoluções e pendências no período)
- Lista de chaves ainda pendentes (não devolvidas), com quem retirou e há quanto tempo está fora
- Lista completa de movimentações (check-out/check-in) do período, com responsável, motivo e horário

## Botão "Instalar app"

Esse botão só aparece quando o navegador permite instalação automática (geralmente Android/Chrome, após a primeira visita). Se ele não aparecer no seu celular, use o caminho manual:

- **Android (Chrome):** menu (⋮) → "Adicionar à tela inicial"
- **iPhone (Safari):** ícone de compartilhar → "Adicionar à Tela de Início"

iPhone normalmente não dispara o botão automático — isso é uma limitação do Safari/iOS, não um defeito do app.

## Se o ícone não aparecer ou o botão "Instalar" não surgir

Isso geralmente significa que os arquivos `icon-192.png`, `icon-512.png` etc. não estão acessíveis no caminho que o `manifest.json` espera. Confira:

1. No GitHub, abra o repositório e veja se os arquivos `icon-192.png`, `icon-512.png`, `icon-192-maskable.png` e `icon-512-maskable.png` estão **soltos na raiz**, junto com `index.html` e `manifest.json` — não dentro de nenhuma pasta.
2. Acesse direto `https://seu-usuario.github.io/seu-repo/icon-512.png` no navegador. Se aparecer "404" ou página de erro, o arquivo não está no lugar certo — suba-o novamente direto na raiz.
3. Depois de corrigir, pode ser necessário limpar os dados do site no navegador (ou desinstalar o atalho da tela inicial e adicionar de novo) para o ícone novo substituir o antigo, já que o navegador guarda o ícone errado em cache.
