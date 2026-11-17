# Passo a passo: criar uma aula gamificada com o Claude

Este kit reproduz o método usado no **Leilão VRIO** (ESPM): um deck em HTML com cara de videogame, missões ao vivo pelo celular no lugar do Mentimeter e um jogo para a turma, tudo num app publicado na internet.

## O que tem no kit

```
kit-aula-gamificada/
├── PASSO-A-PASSO.md            ← este guia
├── aula-gamificada.skill       ← a skill pronta para instalar (é um zip)
├── skill/aula-gamificada/      ← a mesma skill, aberta
│   ├── SKILL.md                    o método
│   ├── references/                 roteiro, motor do deck, app e deploy, lições, prompts de imagem
│   ├── assets/deck-base.html       modelo do deck (26 slides, um de cada layout)
│   └── scripts/deck_tools.py       ferramentas para editar o deck
└── app-template/               ← o app completo (jogo + missões + deploy no Render)
    └── server/deck/aula-vrio.html  ← exemplo completo: a aula de VRIO (36 slides)
```

## Antes de começar (uma vez só)

1. **Claude**: o app Claude para desktop (aba **Code**) ou o Claude Code no terminal. O Claude.ai no navegador também usa a skill, mas sem rodar o app nem publicar.
2. **Node.js 20+** e **Python 3.9+** com Pillow (`pip install pillow`). Se faltar algo, peça ao Claude: "confira se tenho Node e Python instalados".
3. Contas no **GitHub** e no **Render** (o plano grátis serve). Você mesmo faz login e autoriza; o Claude não digita senhas.
4. **Instale a skill:**
   - **Claude Code / app desktop:** copie a pasta `skill/aula-gamificada` para `C:\Users\SEU_USUARIO\.claude\skills\` (no Mac/Linux: `~/.claude/skills/`).
   - **Claude.ai:** Configurações → Capacidades → Skills → enviar `aula-gamificada.skill`.

## Passo 1: preparar a pasta da aula

Crie uma pasta vazia para a aula (ex.: `Aula Estratégia - Porter`) e copie para dentro o conteúdo de `app-template/`. Se preferir, deixe o Claude fazer isso no prompt inicial.

## Passo 2: abrir a conversa com os arquivos e o prompt inicial

Abra uma conversa nova **com a pasta da aula como pasta de trabalho** e anexe:

| Anexe | Por quê |
| --- | --- |
| Material base do professor (PDF, PPT ou link) | É o conteúdo que a aula vai ensinar |
| Imagens próprias: mascote/personagem, fotos, prints, logos | O Claude usa primeiro o que é seu. Ainda não tem? Gere com os prompts de `skill/aula-gamificada/references/prompts-de-imagem.md` (mascote em 4 poses e uma ilustração para cada tipo de slide). |
| Especificação da dinâmica, se você já tiver uma | Regras, tempo, pontuação |
| O `PASSO-A-PASSO.md` (opcional) | Para o Claude seguir a mesma ordem |

Depois cole o prompt abaixo, trocando o que está entre colchetes:

```text
Use a skill aula-gamificada.

Quero criar uma aula gamificada no mesmo formato do kit (deck HTML estilo videogame +
missões ao vivo pelo celular + uma dinâmica em sala), partindo do modelo
assets/deck-base.html e do app em app-template/.

- Tema / conceito central: [ex.: 5 Forças de Porter]
- Disciplina e público: [ex.: Estratégia, 3º semestre de Administração, ESPM]
- Tamanho da turma: [ex.: ~50 alunos]
- Duração: [ex.: 80 minutos, dos quais ~15 para a dinâmica]
- Material base: [anexo / link] do Prof. [nome]
- Autores (vão na capa e nos créditos): [nomes do grupo]
- Dinâmica que imagino: [ex.: leilão como o do VRIO / quiz por equipes / "não sei, sugira"]
- Case da dinâmica: [ex.: um setor só, como "streaming" no VRIO / "sugira 3 opções"]
- Imagens anexadas: [o que é cada uma e onde imagina usar]
- Onde vou apresentar: [app publicado no Render / só o arquivo HTML]

Antes de construir, me faça as perguntas que faltarem e me mostre o roteiro
slide a slide (com os mundos, onde entram as missões e a dinâmica) para eu aprovar.
```

## Passo 3: o que acontece em seguida

O Claude segue as fases da skill. Em cada uma, revise e responda antes de seguir.

| Fase | O que você recebe | O que você faz |
| --- | --- | --- |
| 1. Perguntas | Perguntas de múltipla escolha (escala da turma, case, etc.) | Escolha; "Other" para escrever |
| 2. Roteiro | Lista de slides com a função de cada um | Aprove ou peça trocas ("tire o slide X", "junte Y e Z") |
| 3. Deck | O HTML aberto no navegador, slide a slide | Veja no tamanho de projetor; peça ajustes |
| 4. Imagens | As suas imagens no lugar; buscas de imagens oficiais **com fonte** | Aprove as imagens buscadas |
| 5. Missões e dinâmica | Perguntas das missões e regras e lotes do jogo | Confira se nenhum slide entrega a resposta do jogo |
| 6. Testes | Partida com 50 bots, `check` do deck, prints | Leia o que foi e o que **não** foi testado |
| 7. Publicação | Repositório privado no GitHub + Render | Faça login, conecte o GitHub e aprove o "Deploy" |
| 8. Entrega | Link do app, link secreto do deck, arquivo para o grupo estudar | Guarde a `ADMIN_KEY` (Render → Environment) |

### Pedidos que funcionaram bem no Leilão VRIO

- "Coloque um slide sobre [tema atual] com declarações de [pessoas], com fontes, e diga que esta apresentação foi feita com Claude Code."
- "Na tela inicial coloque o nome de todos os alunos e, no material base, o nome do professor [nome]."
- "Os QR codes precisam funcionar agora, vamos fazer o deploy."
- "Me traga o HTML da apresentação para eu compartilhar com o grupo."
- "Faça o commit das alterações com uma mensagem adequada."
- "Rode uma partida com 50 bots na sala [CÓDIGO]."

## Passo 4: no dia da aula

**10 minutos antes**
1. Abra o deck no link secreto (`https://SEU-APP.onrender.com/aula-xxxx`) e aperte **F** para tela cheia. Isso também acorda o servidor.
2. Aperte **J**, crie a sala (a `ADMIN_KEY` é pedida só na primeira vez), depois aperte **A** para voltar à aula.
3. No telão do jogo: **Missões → Zerar todas**.
4. Notebook na tomada, sem suspensão de tela, com o volume ligado.

**Durante a aula**
- Espaço ou setas: avançar. **N**: notas do professor. **G**: pular para um slide.
- **J**: abre o jogo por cima da aula. **A**: volta para o mesmo slide; o jogo continua rodando.
- No jogo, Espaço avança as fases, P pausa e + dá mais 10 segundos.

**Plano B:** se o Wi-Fi bloquear, os alunos usam o 4G. **Plano C:** cartas impressas.
