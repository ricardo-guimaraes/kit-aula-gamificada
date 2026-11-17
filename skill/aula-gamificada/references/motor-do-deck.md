# Motor do deck: anatomia de `deck-base.html`

## Sumário
1. Estrutura do arquivo
2. Um slide
3. Revelação por passos
4. Cores, fontes e componentes
5. Ícones pixelados
6. Mundos e menu de fases
7. Links, QR codes e missões ao vivo
8. Jogo por cima do deck (J / A)
9. Teclas do apresentador
10. Como editar sem quebrar

## 1. Estrutura do arquivo

```
<!doctype html> <meta charset="utf-8">     ← obrigatórios: sem eles o arquivo solto quebra acentos e ◀ ▶
<title>…</title>
<style>@font-face … (Bungee, Archivo, Silkscreen em base64)</style>
<script src="…qrcodejs/1.0.0/qrcode.min.js">  ← gera os QR codes (precisa de internet)
<style> … todo o visual … </style>
<div class="viewport"><div class="stage">    ← palco de 1920×1080, escalado para a tela
   <section class="slide"> … </section>       ← um por slide
   <canvas id="fx"> <div class="scan">        ← efeito de transição em blocos e scanlines
</div></div>
<div class="bar"> …                           ← barra do apresentador (◀ ▶, contador, cronômetro, Fases, Notas, Links, Jogo, Tela cheia)
<div id="notes"> <form id="cfg"> <div id="game-ov"> <div id="levels">   ← painéis
<script> const LINKS = {…}; (function(){ … })() </script>
```

O palco é sempre 1920×1080: desenhe tudo em pixels desse tamanho, e o script escala para o projetor.

## 2. Um slide

```html
<section class="slide alt" data-world="4" data-title="V · Valor">
  … conteúdo …
  <p class="src">Fonte: … (data).</p>
  <aside class="notes">O que o professor fala, a pergunta para a turma, as ressalvas.</aside>
</section>
```

- `class="slide"` ou `"slide alt"` (fundo um pouco mais claro). Alterne entre os dois para dar ritmo.
- `data-world`: número do mundo (veja a seção 6). `data-title`: nome curto e **único**, que aparece no menu de fases e nas notas.
- O slide tem `padding: 150px 128px 120px` e é um flex em coluna com `gap: 36px`. `.fill` faz um bloco ocupar o espaço que sobra e `.spacer` empurra os blocos.
- `.src` fica fixo no rodapé (fonte dos dados). `.notes` nunca aparece no slide, só no painel N.
- Para um slide de imagem sangrando (capa, mapa, ilustração), use `padding:0` numa classe própria e posicione o conteúdo com `position:absolute`, como em `.cover` e `.saas`.

## 3. Revelação por passos

- `data-step="N"` deixa o elemento invisível até o N-ésimo clique. Os passos contam por slide, começando em 1.
- `class="keep"` + `data-step`: o elemento fica no layout e só ganha a classe `shown`. Use para cartas que viram e para os quadradinhos (`.dots`).
- `.in`, `.in.d1` … `.in.d4`: animação de entrada quando o slide abre, com atraso escalonado.
- `.say.type`: o texto do balão "digita" sozinho; um clique completa a digitação.
- `.counter` com `data-from`, `data-to` e `data-pad`: contador animado (placar).

## 4. Cores, fontes e componentes

**Variáveis** (`:root`): `--bg #0D0B1E`, `--bg2`, `--panel`, `--edge`, `--text #F5F2EA`, `--muted`, `--gold #FFC23D`. As cores das 4 fases: `--v` ouro, `--r` azul, `--i` roxo, `--o` verde. A escala de níveis vai de `--l1` (vermelho, pior) a `--l5` (verde, melhor).

**Fontes:** `--display` (Bungee, títulos), `--body` (Archivo, texto) e `--hud` (Silkscreen, pixelada, para rótulos e chips). A Silkscreen **não tem setas e alguns símbolos**: use ":" ou texto.

**Componentes principais** (todos estão no modelo):

| Classe | O que é | Slide de exemplo |
| --- | --- | --- |
| `.fr` (+ `.sm`, `.hi`, `.dark`, `.cream`) | Moldura com cantos cortados. `--e` é a cor da borda, `--f` o fundo. `.hi` deixa a borda dourada. | quase todos |
| `.fr.dlg` + `.who` + `.say` + `.nx` | Balão de diálogo ("▶ Professor") | "A provocação" |
| `.chip` (+ `.ok`, `.no`, `.mid`, `.ghost`) | Etiqueta pixelada | "V · Valor" |
| `.label`, `.lead`, `.digits` | Rótulo HUD, subtítulo, número gigante com sombra | "15 anos" |
| `.g2`, `.g3`, `.g4`, `.row`, `.fill`, `.spacer` | Grades e espaçamento | — |
| `.item`, `.ihead`, `.islot`, `.ex`, `.meter`, `.seg3` | Card de item com medidor de dificuldade | "Recursos tangíveis" |
| `.lv.lv1` … `.lv5` | Selo de nível colorido | "V · Valor", "A escada" |
| `.ladder`, `.rung.r1…r5`, `#lvup` | Escada de níveis e "Level up!" | "A escada" |
| `.cards`, `.card`, `.face.front`/`.back` | Cartas que viram | "Copia ou não copia?" |
| `.powbar`, `.log`, `.turn` | Barra de força e log de batalha | chefões |
| `.hp` (`#hp`), `.dots` (`#dots`), `.gameover` | HP caindo, grade de quadradinhos, "Game over" | "15 anos", "Efeito Blockbuster" |
| `.pic` | Moldura de foto (`object-fit: cover`; use `contain` no `style` para não cortar) | "A provocação" |
| `.qr`, `.cloud`, `.votes`, `.live` | QR, nuvem ao vivo, barras de votação, selo "Ao vivo" | missões |
| `.field`, `.seg`, `.bars` | Ficha para preencher | "Ficha do personagem" |
| `.refs` | Referências em colunas | "Créditos" |

## 5. Ícones pixelados

`<i class="px" data-icon="NOME" style="width:64px;height:64px"></i>`. O script desenha o ícone. Nomes disponíveis: `coin heart shield key chest trophy star hourglass crown flag bolt potion scroll house hero`. Para criar um novo, acrescente uma matriz de pixels em `const ICONS` no script.

## 6. Mundos e menu de fases

`const WORLDS = ['', 'Abertura', 'Vantagem acaba', …]` no script dá nome aos mundos. `data-world="N"` em cada slide aponta para `WORLDS[N]`. O mundo aparece no topo do slide e no menu de fases (tecla G). Renomeie os mundos para o seu tema.

## 7. Links, QR codes e missões ao vivo

```js
const LINKS = { gameUrl: "" };   // vazio = servido pelo app: usa o próprio endereço (location.origin)
```

- Servido pelo app, o deck preenche `gameUrl` sozinho. Na **cópia para estudo** (arquivo solto), grave a URL pública aqui. O painel **Links** do deck também permite colar a URL, mas ela fica salva só naquele navegador.
- `data-qr="game"`: QR do jogo (`{gameUrl}`). `data-qr="missao"` ou `"m1"`: missão 1. `data-qr="mN"`: missão N (`{gameUrl}/m/N`).
- `data-cfg="gameUrl"` e `data-cfg="missaoUrl:N"`: mostram o link por extenso, sem `https://`.
- **Nuvem:** um contêiner `class="cloud" data-cloud="N"` + `data-cloud-count` (o contador "N respostas"), em qualquer lugar do slide.
- **Votação:** `data-vote="N"` num contêiner do slide, `class="votes" data-vote-item="I"` onde as barras do item I aparecem e `data-vote-count` para "N pessoas votaram". Para mostrar o resultado só na revelação, coloque o mesmo `data-step` da resposta no `.votes`.
- O deck lê `GET {gameUrl}/api/missao/N` a cada 2 s, enquanto o slide está aberto. Para nuvem, a resposta é `{question, total, words:[{text,count}]}`; para votação, `{kind:"votacao", total, items:[{text, options:[{label,count}]}]}`.
- Palavras grandes demais encolhem até caber no painel.

## 8. Jogo por cima do deck (J / A)

- `#game-ov` com um `<iframe>` cobre a tela inteira. **J** (ou o botão Jogo) abre `{gameUrl}` + o último telão criado neste navegador (`localStorage['vrio:lastHost']`) ou `/professor`.
- Dentro do app, **A** (ou o botão "Voltar à aula") manda `postMessage('vrio:aula')` e o deck fecha o overlay. O jogo continua vivo por baixo.
- Com o overlay aberto, o deck ignora as teclas, para não avançar slides por engano.

## 9. Teclas do apresentador

| Tecla | Ação |
| --- | --- |
| → Espaço Enter PageDown | Próximo passo ou slide |
| ← Backspace PageUp | Volta |
| Home / End | Primeiro / último slide |
| N | Notas do professor |
| G | Menu de fases (pular para um slide) |
| F | Tela cheia |
| J | Abre o jogo por cima do deck |
| clique no cronômetro | pausa (duplo clique zera) |

`#slide-N` na URL abre direto no slide N. Mudar só o `#` **não recarrega** a página: para ver uma alteração no arquivo, recarregue de verdade.

## 10. Como editar sem quebrar

- Leia pela cópia leve: `deck_tools.py strip`. Liste os slides: `deck_tools.py outline`.
- Edite com `deck_tools.py apply deck.html trocas.json`. Cada `old` precisa ser único no arquivo; inclua contexto suficiente (o `data-title`, uma classe ou a frase vizinha).
- Para inserir um slide novo, troque o comentário do slide seguinte (ex.: `<!-- 33 · MUNDO ABERTO -->`) pelo `<section>` novo + o mesmo comentário.
- Imagens: deixe um marcador `__IMG_NOME__` no `src` e rode `deck_tools.py place deck.html __IMG_NOME__ foto.png`.
- Depois de qualquer edição: `deck_tools.py check deck.html` e uma passada no navegador.
