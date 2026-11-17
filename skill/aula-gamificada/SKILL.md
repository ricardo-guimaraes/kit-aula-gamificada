---
name: aula-gamificada
license: CC-BY-4.0 (https://github.com/ricardo-guimaraes/kit-aula-gamificada)
description: >-
  Cria aulas e apresentações gamificadas no formato deck HTML estilo videogame com
  interação ao vivo pelo celular. É um único arquivo HTML 1920x1080 com visual pixel/HUD,
  mundos e fases, revelações passo a passo e notas do professor, mais missões ao vivo
  (nuvem de palavras e votação por QR code, no lugar do Mentimeter) e, se quiser, um jogo
  em sala (por exemplo um leilão) servido pelo mesmo app Node e publicado no Render.
  Use esta skill sempre que alguém quiser montar, adaptar, revisar ou publicar uma aula,
  palestra, workshop ou apresentação interativa ou gamificada, um deck em HTML para
  projetor, slides com QR code, nuvem de palavras ou quiz ao vivo, uma dinâmica ou jogo
  para a turma jogar pelo celular, ou reaproveitar o kit aula gamificada / Leilão VRIO,
  mesmo que a pessoa não use a palavra gamificada.
---

# Aula gamificada

Esta skill transforma um conteúdo de aula em três peças que funcionam juntas:

1. **O deck**: um único HTML de 1920×1080 com cara de videogame (fonte pixelada, "mundos", "fases", "chefões", barra de HP), revelações por clique, notas do professor (tecla N) e QR codes que se configuram sozinhos.
2. **As missões ao vivo**: a turma responde pelo celular, sem login. São nuvens de palavras e votações que aparecem no próprio slide, a cada 2 segundos.
3. **A dinâmica** (opcional): um jogo em tempo real para 50 celulares, servido pelo mesmo app. O exemplo pronto é um leilão de recursos.

Tudo roda num único servidor Node (`assets/app-template` do kit), publicado no Render. A tecla **J** abre o jogo por cima do deck e a tecla **A** volta para a aula.

O exemplo completo e testado em aula é o **Leilão VRIO** (estratégia, modelo VRIO, ESPM). Use-o como referência de tom, ritmo e qualidade, não como conteúdo fixo.

## Onde está cada coisa

| Arquivo | Para quê |
| --- | --- |
| `assets/deck-base.html` | Modelo do deck: o motor completo (CSS, JS, fontes) e 26 slides de exemplo, um de cada layout. **Comece sempre por ele.** |
| `scripts/deck_tools.py` | Ler, editar, checar e embutir imagens no deck sem abrir o arquivo gigante. |
| `references/roteiro.md` | Arco narrativo da aula e qual slide do modelo usar em cada momento. Leia antes de propor o roteiro. |
| `references/motor-do-deck.md` | Anatomia do deck: classes, passos, notas, mundos, QR, missões, overlay do jogo. Leia antes de editar HTML. |
| `references/app-ao-vivo.md` | App das missões e do jogo, API, variáveis, deploy no Render e custos. Leia antes de mexer no app ou publicar. |
| `references/licoes-e-checklist.md` | Armadilhas reais deste formato e o checklist de verificação. Leia antes de dizer que algo está pronto. |
| `references/prompts-de-imagem.md` | Prompts prontos para gerar o mascote (4 poses do app) e as ilustrações de cada tipo de slide. Ofereça quando faltarem imagens. |

Se o usuário trouxe o kit completo (zip), o app fica em `app-template/` e o deck de exemplo em `app-template/server/deck/aula-vrio.html`.

## Como conduzir o trabalho

Siga as fases nesta ordem. Em cada uma, mostre o resultado e espere o "ok" antes de seguir: aula é coisa que o professor apresenta em público, e retrabalho depois de tudo montado custa caro.

### 1. Entender o pedido e perguntar o que falta

Leia tudo o que vier anexado: material base (PDF ou PPT do professor), especificação da dinâmica, imagens, mascote e logos. Depois pergunte, de preferência com perguntas de múltipla escolha (uma ferramenta de perguntas, se houver), só o que muda o resultado:

- tema, público e **tamanho da turma** (com ~50 pessoas, uma dinâmica "um ganhador por rodada" deixa a maioria de fora; veja `app-ao-vivo.md`);
- **duração** da aula e quanto dela vai para a dinâmica;
- um **case único e coerente** para a dinâmica: recursos de setores misturados confundem a turma; um case de um setor só funciona;
- autores (todos os nomes do grupo) e o professor do material base;
- onde vai apresentar: app publicado (recomendado) ou arquivo solto.

Não pergunte o que dá para decidir com bom senso. Diga a decisão em uma linha e siga.

### 2. Propor o roteiro antes de construir

Monte o roteiro com o arco de `references/roteiro.md`: título, provocação, missão de abertura, dados de impacto, conceitos, framework em fases, chefões (cases), fase bônus (dinâmica), revelação, replay, notas do dev, mundo aberto, ficha do personagem e créditos. Para cada slide, diga em uma linha a função dele e qual slide do modelo serve de base. Marque onde entram as missões ao vivo e a dinâmica.

Cuide para que **nenhum slide de teoria entregue a resposta da dinâmica**. Por exemplo: não cite a Kodak na fase "Organização" se a "tecnologia na gaveta" é um lote do leilão. Se uma provocação der uma pista de propósito (como as retrospectivas no slide 2 do exemplo), combine com o usuário.

### 3. Construir o deck a partir do modelo

1. Copie `assets/deck-base.html` para o projeto. Ele já tem `<!doctype html>` e `<meta charset="utf-8">`; mantenha-os sempre.
2. Para ler o deck, use `python scripts/deck_tools.py strip deck.html -o leve.html` e leia a cópia leve. O original tem linhas de centenas de KB, por causa do base64.
3. Monte slide por slide copiando o `<section>` do modelo que tem o layout certo. Para trocas de texto, use `deck_tools.py apply` com um JSON de trocas: cada trecho precisa aparecer exatamente uma vez, senão nada é gravado.
4. Cada slide precisa de `data-world`, de um `data-title` único e de `<aside class="notes">` com a fala do professor. As notas são o roteiro de quem apresenta: escreva o que dizer, a pergunta para a turma e as ressalvas sobre fontes.
5. Revelações por clique usam `data-step="1"`, `"2"`, …, na ordem da fala.
6. A fonte pixelada (`var(--hud)`, usada em `.chip`, `.label`, `.lv` e `.live`) **não tem setas nem alguns símbolos**: "→" aparece como "_". Use ":" ou texto. O `deck_tools.py check` aponta esses casos.

Detalhes de cada componente estão em `references/motor-do-deck.md`.

### 4. Imagens

- Use as imagens do usuário primeiro: mascote, prints e logos.
- Se faltar mascote ou ilustração, entregue os prompts de `references/prompts-de-imagem.md` já adaptados ao tema (letras do framework, número de fases, descrição do personagem). O usuário gera as imagens e anexa. Os marcadores "IMAGEM AQUI" do modelo e o mascote-marcador do app mostram onde cada uma entra.
- Quando faltar, busque material **oficial** (site da marca, kit de imprensa, Wikimedia Commons com licença), mostre ao usuário e **cite a fonte** no slide (`<p class="src">`) e nos créditos.
- Embuta tudo como WebP de até ~1600 px (`deck_tools.py place deck.html __IMG_X__ foto.png`). O deck deve ficar com menos de ~5 MB; o exemplo tem 4,2 MB com 36 slides.
- Colagens (várias telas num card só): `deck_tools.py collage`. Se houver uma imagem em retrato, ela fica inteira à esquerda.
- Logos dentro de molduras de uma ilustração: `deck_tools.py fit-logos`. Ele acha as molduras brancas e encaixa os logos da esquerda para a direita. Logos muito largos ficam ilegíveis numa moldura pequena; use só o símbolo (os 4 quadrados da Microsoft, o "A" da Adobe).

### 5. Interação ao vivo

- Cada momento de "pergunta para a turma" vira uma **missão** no app: uma nuvem para respostas abertas e uma votação para escolha entre opções. As perguntas ficam em `server/src/missions.ts`, e o slide liga a missão pelo número (`data-cloud="3"`, `data-vote="2"`, `data-qr="m3"`).
- Servido pelo app, o deck descobre o próprio endereço: o QR do jogo aponta para `{origem}/` e os das missões para `{origem}/m/N`. Nada para colar.
- Para a dinâmica, adapte o app de exemplo (`references/app-ao-vivo.md`): o case, os lotes, os pontos e as unidades por tamanho de turma ficam em arquivos de configuração.

### 6. Verificar de verdade antes de entregar

Siga `references/licoes-e-checklist.md`. No mínimo:

- `python scripts/deck_tools.py check deck.html` sem nenhum PROBLEMA;
- passar por **todos** os slides e passos no navegador, olhando o console, e conferir os que mudaram com print em 1600×1000;
- no app: `npm test`, e uma partida inteira com bots (`npm run bots -- --create --n=50`) antes da aula;
- no endereço publicado: os QR codes apontam para a URL pública e a nuvem responde.

Diga com clareza o que foi testado e o que não foi (por exemplo, "não testei com celulares reais").

### 7. Publicar e entregar

- Publique no **Render** com o `render.yaml` do app: um Web Service, uma instância, `DECK_PATH` secreto e `ADMIN_KEY`. O **Netlify não serve**, porque não mantém o WebSocket do jogo aberto. Não precisa de banco de dados: o estado vive na memória durante a aula.
- Criar conta, conectar o GitHub e revelar ou copiar a `ADMIN_KEY` são ações do usuário. Guie-o, abra as páginas para ele, mas não preencha senhas nem chaves.
- Para o grupo estudar, gere uma cópia do deck com `const LINKS = { gameUrl: "https://SEU-APP.onrender.com" }`, para que os QR codes funcionem também no arquivo solto. Avise que as notas do professor vão junto.
- Entregue o checklist do dia da aula (está em `app-ao-vivo.md`).

## Tom e qualidade do conteúdo

- **Citações só verificadas.** Busque a fonte primária ou uma transcrição confiável. Traduza livremente e diga isso no slide. Nas notas, registre ressalvas (por exemplo, "frase de reportagens, sem transcrição oficial") e contrapontos (por exemplo, o Nadella também disse "SaaS não está morto").
- **Dados com fonte e data** no rodapé do slide. Se algo não foi conferido, escreva isso nas notas em vez de esconder.
- **Linguagem do jogo a serviço do conteúdo:** "fase" é uma etapa do framework, "chefão" é um case, "HP" é a queda de um indicador, "item" é um recurso e "skill" é uma capacidade. A metáfora ajuda a lembrar; não pode trocar o conceito.
- **Feche voltando à pergunta de abertura** e termine com uma aplicação pessoal (a "ficha do personagem").
