# App ao vivo: missões, jogo e deploy

O app (`app-template/` no kit) é um único servidor Node com Express e Socket.IO e um front em React, Vite e Tailwind. Ele entrega três coisas independentes: o deck, as missões e o jogo. Não usa banco de dados: tudo fica na memória durante a aula.

## Sumário
1. Endereços
2. Missões (nuvem e votação)
3. O jogo de exemplo (leilão) e como adaptar
4. Rodar e testar
5. Deploy no Render
6. Custos e limites
7. Checklist do dia da aula

## 1. Endereços

| Caminho | Quem | Para quê |
| --- | --- | --- |
| `/` | Alunos | Entrada do jogo. Leva direto para a sala mais recente; sem sala, espera e entra sozinho. É para onde o QR do deck aponta. |
| `/professor` | Professor | Cria a sala. Pede a `ADMIN_KEY` uma vez e guarda no navegador. |
| `/host/CODIGO?k=SEGREDO` | Projetor | Telão do jogo. Botões Missões e 📖 Aula; tecla A volta para a aula. |
| `/CODIGO` | Alunos | Celular numa sala específica |
| `DECK_PATH` (ex.: `/aula-k7x2`) | Projetor | O deck. Mantenha em segredo: a tecla N mostra as notas. |
| `/m/N` · `/m/N/tela` | Alunos · Projetor | Missão no celular · nuvem ou votação em tela cheia, de reserva |
| `/healthz` | — | `{"ok":true,…}` quando o servidor está no ar |

## 2. Missões (nuvem e votação)

As perguntas ficam em `server/src/missions.ts`:

```ts
export const MISSIONS = {
  '1': { kind: 'nuvem', question: 'Qual marca você usa e acha impossível de copiar?' },
  '2': { kind: 'votacao', question: 'Quiz relâmpago: item ou skill?',
         items: [{ text: 'O caixa de uma empresa', options: ['Item', 'Skill'] }, …] },
};
```

- **Nuvem:** até 3 respostas por celular, de 2 a 24 caracteres, uma a cada 3 s, com filtro de palavrões. Respostas iguais se juntam sem diferenciar maiúsculas e acentos, e aparece a grafia mais frequente. No máximo 40 palavras.
- **Votação:** um voto por item por celular, que pode ser trocado.
- Sem login: o celular gera um token e guarda no `localStorage`.
- **API:** `GET /api/missao/N` (CORS liberado, sem cache; é o que o deck lê), `POST /api/missao/N` (`{token, text}` ou `{token, item, option}`), `POST /api/missao/N/limpar?k=ADMIN_KEY` e `POST /api/missao/N/ocultar?k=ADMIN_KEY` com `{text}`.
- **No telão do jogo**, o botão **Missões** mostra as respostas, oculta palavras e tem "Zerar todas", para usar antes da aula.

Para criar uma missão nova: acrescente-a em `MISSIONS` e, no deck, coloque o QR (`data-qr="mN"`) e a nuvem ou a votação com o mesmo N (veja `motor-do-deck.md`, seção 7).

## 3. O jogo de exemplo (leilão) e como adaptar

O leilão VRIO segue esta sequência:
1. Lobby com QR.
2. Introdução do case em 3 etapas: o case, a missão com a escala de pontos e a dinâmica.
3. 10 lotes de 15 s, com extensão de 5 s para lances no fim e teto de 30 s.
4. Proposta secreta no lote "gaveta".
5. Revelação carta a carta.
6. Pódio com os prêmios "Melhor negócio" e "Maior mico".

| Quer mudar… | Arquivo |
| --- | --- |
| História do case (textos da introdução) | `shared/case.ts` |
| Lotes: nome, frase de venda, classificação secreta, pontos | `server/src/lots.ts` (nunca vai para o navegador antes da revelação) |
| Unidades por lote conforme o tamanho da turma | `unitsFor` em `shared/types.ts` |
| Regras (tempos, orçamento, incrementos) | constantes no início de `server/src/game.ts` e `shared/types.ts` |
| Visual do telão e do celular | `web/src/components/host.tsx`, `web/src/pages/Player.tsx` |

Lições de desenho do jogo:
- **Escala:** com ~50 pessoas, "um vencedor por lote" deixa 40 de fora. Venda **N unidades por lote**: os N maiores lances levam e cada um paga o próprio lance, com `N = arredonda(jogadores × 0,8 ÷ lotes)`. Com 50 pessoas e 10 lotes, dá 4 unidades.
- **Coerência:** todos os lotes devem ser do mesmo case e setor, cobrindo todos os níveis do framework (bons e armadilhas, alternados). A última carta pode ser uma armadilha famosa.
- **Segredo:** classificação e pontos ficam só no servidor até a revelação, porque aluno curioso abre o inspetor do navegador.
- **Lances simultâneos:** com 50 celulares, ~25% dos toques podem cair em "Alguém foi mais rápido". É justo, mas frustra; dá para aceitar o lance se ele ainda superar o novo valor.

## 4. Rodar e testar

```bash
npm install
npm run dev                  # front em :5173 e servidor em :3001
npm run build && npm start   # como em produção; o deck fica em http://localhost:3001/aula
npm test                     # lógica do jogo, missões, rotas e DECK_PATH
npm run bots -- --url=http://localhost:3001 --create --n=50
```

O script de bots cria a sala, conduz a partida inteira e termina com o pódio, os lances aceitos e as recusas por tipo. Recusas `stale` e `leader` são normais; `timeout`, `connect` ou `join` indicam problema. Contra o site publicado, use `--code=ABCD` numa sala criada por você, ou `--key=ADMIN_KEY` com `--create`.

## 5. Deploy no Render

**Por que não o Netlify:** ele só hospeda páginas estáticas e funções curtas, e o jogo precisa de um servidor ligado com WebSocket aberto para dezenas de celulares. Netlify junto com Render funciona, mas é complexidade sem ganho. Reescrever tudo com Supabase esbarra no limite de mensagens por segundo do plano grátis.

1. Repositório **privado** no GitHub (`gh repo create NOME --private --source . --push`).
2. `render.yaml` (já vem no app): Web Service, `numInstances: 1` (as salas vivem na memória), `healthCheckPath: /healthz`, `NODE_VERSION`, `DECK_PATH` com um valor difícil de adivinhar e `ADMIN_KEY` com `generateValue: true`.
3. No Render, o próprio usuário faz login, conecta o GitHub (só o repositório do app) e cria o serviço em **New → Blueprint** (ou pelo link `https://dashboard.render.com/blueprint/new?repo=URL_DO_REPO`).
4. Depois do deploy, confira `URL/healthz`, `URL/DECK_PATH` (todos os slides) e se os QR codes do deck apontam para a URL pública.
5. A `ADMIN_KEY` fica em **serviço → Environment** (menu da esquerda, seção MANAGE; ícone de olho para ver, ícone de copiar). Quem revela e cola é o usuário.

Cuidados:
- Cada push na `main` faz um novo deploy e **zera** salas e missões. Não faça push perto da aula.
- No Git Bash do Windows, variáveis que começam com `/` viram caminhos (`/aula-x` → `C:/Program Files/Git/aula-x`). Para testar local, use `MSYS_NO_PATHCONV=1`. No Render isso não acontece.
- Se o plano for mudado, mude no `render.yaml`; pelo painel, a sincronização do Blueprint pode desfazer.

## 6. Custos e limites

- **Free:** US$ 0. "Dorme" depois de 15 min **sem tráfego**; desde fev/2026, mensagens de WebSocket contam como tráfego. O primeiro acesso depois de dormir leva ~1 min. Com o telão aberto durante a aula, o servidor não dorme.
- **Starter:** ~US$ 7/mês, cobrado por segundo (~US$ 0,23/dia). Dá para ligar só no dia da aula.
- Uma partida com 51 jogadores no plano free rodou sem nenhum erro.

## 7. Checklist do dia da aula

**Na semana**
- [ ] Deploy feito, com `DECK_PATH` e `ADMIN_KEY`.
- [ ] Partida com 50 bots contra o site publicado.
- [ ] Teste com 3 celulares reais, no 4G e no Wi-Fi da faculdade (algumas redes bloqueiam WebSocket; o app cai para long-polling).
- [ ] Ensaiar a troca aula ↔ jogo (J e A) no notebook da aula.
- [ ] Plano C: cartas impressas.

**10 minutos antes**
- [ ] Abrir o deck (acorda o servidor) e pôr em tela cheia (F).
- [ ] J → criar a sala → A. O telão fica aberto por baixo.
- [ ] Telão → Missões → **Zerar todas**.
- [ ] Notebook na tomada, sem suspensão de tela, com volume ligado (clique uma vez no telão para liberar o som).
