# Leilão VRIO

App da aula de estratégia sobre o modelo VRIO. Um único servidor Node (Express + Socket.IO), sem banco de dados, entrega três coisas independentes:

1. **O jogo do leilão.** Os alunos jogam pelo celular (só nome, sem login) e o professor conduz pelo telão. A partida dura de 12 a 15 minutos e foi pensada para turmas de ~50 pessoas.
2. **A apresentação da aula** (`server/deck/aula-vrio.html`), servida num caminho secreto (`DECK_PATH`).
3. **O modo Missão**: nuvens de palavras e votações ao vivo pelo celular, que substituem o Mentimeter na apresentação.

**O case:** a guerra do streaming. Cada aluno é CEO de uma startup brasileira de streaming que acabou de receber R$ 100 mi e disputa recursos no "Leilão de Ativos do Streaming". Antes do leilão, o telão apresenta o case em 3 etapas (o case, a missão com a escala de pontos do VRIO e a dinâmica do leilão), e o celular de cada aluno acompanha a mesma etapa.

**Escala com a turma:** cada lote tem várias unidades. Os N maiores lances levam uma unidade cada e cada vencedor paga o próprio lance. N é calculado quando o leilão começa para que ~80% da turma consiga comprar algo: `N = arredonda(jogadores × 0,8 ÷ lotes)`, entre 1 e 6. Com 50 alunos e 10 lotes, são 4 unidades por lote; com até ~12 alunos, 1 unidade (leilão comum).

## Endereços

| Caminho | Quem usa | Para quê |
| --- | --- | --- |
| `/` | Alunos | Entrada do jogo. Leva direto para a sala mais recente do professor (é para onde o QR do deck aponta). Sem sala aberta, espera e entra sozinho quando ela abrir. |
| `/professor` | Professor | Cria a sala (completa, 10 lotes, ou curta, 8 lotes). Pede a `ADMIN_KEY` uma vez e guarda no navegador. |
| `/host/CODIGO?k=SEGREDO` | Professor, no projetor | Telão do jogo. Sem o segredo, mostra o jogo sem os controles. O botão **Missões** abre o painel das nuvens e votações. |
| `/CODIGO` | Alunos | Celular do aluno numa sala específica. |
| `DECK_PATH` (ex.: `/aula-k7x2`) | Professor, no projetor | A apresentação da aula. Mantenha em segredo: a tecla N mostra as notas do professor. |
| `/m/1` … `/m/4` | Alunos | Responder uma missão pelo celular. |
| `/m/1/tela` | Professor | Nuvem ou votação em tela cheia, de reserva. |

### As missões do deck

| Missão | Slide | Tipo | Pergunta |
| --- | --- | --- | --- |
| 1 | 3 | nuvem | Qual marca você usa e acha impossível de copiar? |
| 2 | 11 | votação | Quiz relâmpago: item ou skill? (4 itens) |
| 3 | 31 | nuvem | De qual compra você se arrepende, ou qual lote deveria ter comprado? |
| 4 | 35 | votação | Qual letra do VRIO você mais precisa subir? |

As perguntas ficam em [`server/src/missions.ts`](server/src/missions.ts). Nas nuvens, cada celular manda até 3 respostas (de 2 a 24 caracteres, uma a cada 3 s), com filtro de palavrões, e respostas iguais se juntam sem diferenciar maiúsculas e acentos. Nas votações, dá para mudar o voto. Tudo fica em memória e separado do leilão: reiniciar um não afeta o outro.

O deck lê `GET /api/missao/:id` a cada 2 segundos. Para as nuvens, a resposta é sempre `{ question, total, words: [{ text, count }] }`, com no máximo 40 palavras.

### Alternar entre a aula e o jogo

Tudo numa janela só, em tela cheia:

- Na apresentação, aperte **J** (ou o botão **Jogo** na barra de baixo): o telão do jogo abre por cima da aula. Se ainda não houver sala, abre a página de criar sala.
- No jogo, aperte **A** (ou o botão **Voltar à aula** no topo, ou **📖 Aula** no rodapé do telão): a aula volta no mesmo slide.
- O jogo continua rodando por baixo enquanto você está na aula; ao voltar com J, ele está exatamente onde parou.

Crie a sala no mesmo navegador do deck: o deck abre sempre o telão da última sala criada ali. Se preferir duas abas, o botão **📖 Aula** do telão (fora do deck) abre a apresentação em outra aba.

## Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `DECK_PATH` | Caminho secreto da apresentação, ex.: `/aula-k7x2`. Em dev, sem a variável, fica em `/aula`. Em produção, sem a variável, o servidor sorteia um caminho a cada reinício e mostra no log. |
| `ADMIN_KEY` | Chave do professor: criar salas e zerar ou ocultar respostas das missões. Sem ela, qualquer pessoa pode fazer isso (o servidor avisa no log). |
| `PORT` | Porta do servidor (o Render define sozinho). |

## Rodar no computador

Precisa do Node 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra http://localhost:5173/professor e clique em **Criar sala**. Para testar com celulares de verdade na mesma rede Wi-Fi, use o endereço de rede que o Vite mostra no terminal (algo como `http://192.168.0.10:5173`).

Para testar o deck com os QRs e as nuvens de verdade, rode como em produção (um processo só, porta 3001) e abra http://localhost:3001/aula:

```bash
npm run build
npm start
```

### Testes

```bash
npm test
```

- `server/test/game.test.ts`: a lógica do leilão (unidades por tamanho de turma, lances, vários vencedores por lote, relógio e teto de 30 s, proposta do lote 9, pontuação, desempate e prêmios).
- `server/test/http.test.ts`: o modo Missão (agrupamento sem acentos e maiúsculas, limite de 3 respostas e 1 a cada 3 s por celular, votação), o formato e o CORS de `GET /api/missao/1`, a chave do professor e o `DECK_PATH` (status 200, comprimido, sem Content-Security-Policy bloqueando o CSS e o JavaScript inline do deck).

### Teste de carga com bots

Com uma sala aberta no telão:

```bash
npm run bots -- --url=http://localhost:3001 --code=ABCD --n=50
```

Ou deixe o script criar a sala e conduzir a partida inteira sozinho (o link do telão aparece no terminal, para você assistir). Se o servidor tiver `ADMIN_KEY`, passe `--key`:

```bash
npm run bots -- --url=http://localhost:3001 --create --n=50 --key=SUA_CHAVE
```

O script termina com o pódio, quantos lances foram aceitos e as recusas por tipo. Recusas como `stale` (alguém foi mais rápido) e `leader` são normais; `timeout`, `connect` ou `join` indicam problema.

## Trocar o case, os lotes e o deck

- A história do case (textos da introdução) fica em [`shared/case.ts`](shared/case.ts).
- Os textos, a ordem e os pontos dos lotes ficam em [`server/src/lots.ts`](server/src/lots.ts). Esse arquivo nunca vai para o navegador: a classificação e os pontos só chegam às telas na revelação.
  - O lote com `reorgCost` é "a gaveta" (recebe a proposta secreta).
  - Os lotes com `optional: true` saem da versão curta.
- A regra de unidades por lote fica em `unitsFor`, em [`shared/types.ts`](shared/types.ts).
- A apresentação é o arquivo [`server/deck/aula-vrio.html`](server/deck/aula-vrio.html). Para trocar, substitua o arquivo e reinicie o servidor (ele vai com `Cache-Control: no-cache`, então o navegador pega a versão nova). Servido pelo app, o deck descobre o próprio endereço sozinho: QR do jogo em `{origem}/` e QRs das missões em `{origem}/m/N`.

## Deploy no Render

O WebSocket precisa de um processo Node ligado o tempo todo, então use um **Web Service** (não serve Vercel nem site estático).

1. Suba esta pasta para um repositório no GitHub.
2. No Render: **New → Web Service**, conecte o repositório.
3. Configure:
   - **Runtime:** Node
   - **Build command:** `npm install --include=dev && npm run build`
   - **Start command:** `npm start`
   - **Environment:** `NODE_ENV=production`, `DECK_PATH=/aula-algo-dificil` e `ADMIN_KEY=uma-senha-sua`
   - **Instance type:** Free serve para testar; para a aula, o plano Starter evita o servidor "dormir".
4. O Render define a variável `PORT` sozinho; o servidor já lê dela.
5. Depois do deploy, acesse `https://seu-app.onrender.com/healthz`: deve responder `{"ok":true,...}`.

Railway e Fly.io funcionam do mesmo jeito: build `npm install --include=dev && npm run build`, start `npm start`, mais as variáveis acima.

> Importante: rode **uma instância só**. As salas e as missões vivem na memória do processo; com duas instâncias, metade da turma cairia em outra sala.

## Passo a passo do dia da aula

**Na semana da aula**

- [ ] Deploy feito com `DECK_PATH` e `ADMIN_KEY`, e uma URL curta (ou encurtador) para o slide.
- [ ] Rodar `npm run bots -- --url=https://SUA-URL --create --n=50 --key=SUA_CHAVE` contra a produção e acompanhar o log.
- [ ] Abrir `{URL}{DECK_PATH}#slide-3`, responder pelo celular em `{URL}/m/1` e conferir a nuvem crescendo no slide em até 2 s. Repetir nos slides 11, 31 e 35.
- [ ] Ensaiar a troca aula ↔ jogo (J e A) no notebook da aula.
- [ ] Jogar uma partida cronometrada com 3 celulares reais, no 4G e no Wi-Fi da faculdade. Algumas redes bloqueiam WebSocket; o app cai para long-polling sozinho, mas o 4G é o plano B.
- [ ] Plano C: cartas do leilão impressas, para rodar no papel se a internet cair.

**10 minutos antes**

- [ ] Abrir o site para "acordar" o servidor (planos gratuitos dormem).
- [ ] Abrir o deck, apertar **J** e criar a sala ali mesmo (ou em `/professor`, no mesmo navegador). **Guarde o link do telão**: ele tem o segredo que controla a partida. No mesmo navegador, reabrir `/host/CODIGO` também funciona.
- [ ] **Zerar as missões**: no telão, botão **Missões** → **Zerar todas**.
- [ ] Abrir o deck em `DECK_PATH` e pôr em tela cheia (tecla **F**).
- [ ] Notebook no carregador e sem suspensão de tela.
- [ ] Clicar uma vez no telão (o navegador só libera o som depois de um clique) e conferir o volume.

**Durante a partida**

| Ação | Atalho |
| --- | --- |
| Avançar fase / próximo lote / virar carta | Espaço, seta →, Page Down ou Enter (passador de slides) |
| Voltar uma etapa da introdução ou uma carta | Seta ← ou Page Up |
| Pausar e retomar o relógio | P |
| Mais 10 s no lote | + |
| Pular lote | S |
| Trancar a sala | L |
| Tela cheia | F |
| Som liga/desliga | M |
| Remover jogador | Clique no nome, no lobby |
| Ocultar palavra ou zerar missão | Botão "Missões" no rodapé do telão |
| Reiniciar com os mesmos jogadores | Botão "Reiniciar" (pede confirmação) |

Os lances fecham sozinhos quando o relógio zera, e o "Vendido!" passa para o próximo lote em 6 s (ou na hora, com Espaço). Se o notebook travar, reabra o link do telão: a partida continua no servidor exatamente de onde parou. Se um aluno recarregar a página, ele volta com o mesmo nome e saldo.

## Estrutura

```
shared/types.ts          tipos do protocolo (servidor e front)
shared/case.ts           texto do case mostrado antes do leilão
server/src/lots.ts       os 10 lotes (secretos)
server/src/game.ts       regras do leilão, lógica pura e testável
server/src/rooms.ts      salas em memória, timers e eventos Socket.IO
server/src/missions.ts   modo Missão (nuvens e votações), lógica pura
server/src/http.ts       rotas: deck, API das missões, sala atual e front
server/src/index.ts      sobe o servidor
server/deck/             a apresentação da aula
server/scripts/bots.ts   teste de carga
web/src/pages            Entry (/), Home (/professor), Host (telão), Player (celular), Mission e MissionScreen
web/public/mascote       ilustrações do professor
```
