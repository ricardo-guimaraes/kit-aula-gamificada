# Kit Aula Gamificada

Método, modelo e app para criar **aulas gamificadas com o Claude**:

- um deck em HTML com cara de videogame: mundos, fases, chefões, revelações por clique e notas do professor;
- **missões ao vivo** pelo celular (nuvem de palavras e votação por QR code), no lugar do Mentimeter;
- um **jogo em sala** para ~50 celulares (o exemplo é um leilão de recursos com o modelo VRIO), publicado no Render.

Nasceu de uma aula de Estratégia sobre o modelo VRIO, construída inteira com o Claude Code.

## ⬇️ Baixar

**[kit-aula-gamificada.zip](https://github.com/ricardo-guimaraes/kit-aula-gamificada/releases/latest/download/kit-aula-gamificada.zip)**: tudo num arquivo só (skill, modelo do deck, app e passo a passo).

Só a skill: **[aula-gamificada.skill](https://github.com/ricardo-guimaraes/kit-aula-gamificada/releases/latest/download/aula-gamificada.skill)**

## Como usar

1. Instale a skill:
   - **Claude Code / app desktop:** copie `skill/aula-gamificada` para `~/.claude/skills/` (no Windows, `C:\Users\SEU_USUARIO\.claude\skills\`).
   - **Claude.ai:** Configurações → Capacidades → Skills → enviar `aula-gamificada.skill`.
2. Siga o **[PASSO-A-PASSO.md](PASSO-A-PASSO.md)**: o que anexar na primeira mensagem e o prompt inicial pronto para preencher.
3. Sem mascote ou ilustrações? Gere com os prompts de **[prompts-de-imagem.md](skill/aula-gamificada/references/prompts-de-imagem.md)**.

## O que tem aqui

```
PASSO-A-PASSO.md               guia: arquivos, prompt inicial, fases, dia da aula
aula-gamificada.skill          a skill empacotada
skill/aula-gamificada/
  SKILL.md                     o método em 7 fases
  references/                  roteiro, motor do deck, app e deploy, lições, prompts de imagem
  assets/deck-base.html        modelo do deck: 26 slides, um de cada layout
  scripts/deck_tools.py        ler, editar, checar e embutir imagens no deck
app-template/                  app Node + Socket.IO + React (jogo, missões, deck) com render.yaml
  server/deck/aula-vrio.html   aula de exemplo completa (36 slides), com imagens trocadas por marcadores
```

## Observações

- Nomes de alunos e professores, fotos de marcas e o personagem original foram trocados por marcadores. Coloque os seus.
- Antes de usar uma citação ou um dado do exemplo numa aula, confira a fonte (as notas do professor apontam quais ainda precisam ser checados).
- Requisitos para o app: Node 20+. Para as ferramentas do deck: Python 3.9+ com Pillow.

## Licença

[Creative Commons Atribuição 4.0 Internacional (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.pt-br). Texto completo em [LICENSE](LICENSE).

Você pode usar, adaptar e redistribuir, inclusive para fins comerciais, desde que dê o crédito. Por exemplo:

> Baseado no *Kit Aula Gamificada*, de ricardo-guimaraes, https://github.com/ricardo-guimaraes/kit-aula-gamificada (CC BY 4.0).

A licença cobre o que foi criado neste kit. Marcas, logos e citações de terceiros mencionados nos exemplos pertencem aos seus donos.
