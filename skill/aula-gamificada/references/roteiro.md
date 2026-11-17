# Roteiro: o arco de uma aula gamificada

Este é o arco que funcionou na aula de VRIO: 36 slides, ~50 minutos de exposição e ~15 de jogo. Ajuste a quantidade ao tempo, mas mantenha a ordem dos "mundos": cada um prepara o seguinte.

Os nomes entre aspas são o `data-title` do slide correspondente em `assets/deck-base.html`. Copie esse `<section>` como base.

## Mundo 0 · Início

| Momento | Slide base | Função |
| --- | --- | --- |
| Tela de título | "Tela de título" | Pergunta grande em vez de um nome de tema ("Por que algumas marcas são impossíveis de copiar?"). Embaixo, os autores em 2 colunas e o material base. Fica projetada enquanto a turma chega. |

## Mundo 1 · Abertura (provocar e engajar)

| Momento | Slide base | Função |
| --- | --- | --- |
| Provocação | "A provocação" | Duas imagens lado a lado que mostram o problema (Snapchat → Instagram; Wrapped → todo app) e uma pergunta do professor num balão de diálogo que digita sozinho. |
| Missão 1 | "Missão 1 · nuvem ao vivo" | QR + nuvem ao vivo com uma pergunta pessoal ("Qual marca você usa e acha impossível de copiar?"). No fim do slide, a "recompensa" anuncia a dinâmica (R$ 100 mi para gastar no fim da aula). |

## Mundo 2 · Por que importa (dados de impacto)

| Momento | Slide base | Função |
| --- | --- | --- |
| Número grande | "15 anos" | Um número só, enorme, com barra de HP caindo. Antes de revelar, a turma chuta. |
| Placar | "49 de 500" | Contador animado (`.counter`) e uma "nota do dev" que relativiza o dado (por exemplo, a régua mudou). |

## Mundo 3 · Inventário (conceitos básicos)

| Momento | Slide base | Função |
| --- | --- | --- |
| Distinção central | "Recurso × Capacidade" | Imagem + dois cards ("o que TEM" × "o que SABE FAZER") + uma frase-síntese. |
| Tipos | "Recursos tangíveis" | Cards de "item" com medidor de dificuldade (`.meter`). Repita para os intangíveis com `.g3`. |
| Árvore | "Capacidades" | 5 nós lado a lado; destaque (`.hi`) no que volta mais tarde. |
| Quiz | "Missão 2 · Quiz" | Votação ao vivo em 4 afirmações. Cada clique revela o resultado da turma e a resposta. |

## Mundo 4 · O framework, fase por fase

| Momento | Slide base | Função |
| --- | --- | --- |
| Origem | "Barney 1991" | Uma frase do autor e a referência. Nada mais. |
| Cada fase | "V · Valor" | Pergunta da fase num balão + exemplo + "Se falhar: nível X". Repita para cada letra ou etapa do framework. |
| Síntese | "A escada" | Escada de níveis revelada degrau por degrau, com "Level up!". |
| Aprofundar | "Por que é difícil copiar" | 3 "escudos" + 1 atalho (ameaça). |
| Treino | "Copia ou não copia?" | 4 cartas que viram (a turma vota com o polegar e você revela). |

## Mundo 5 · Chefões (cases)

| Momento | Slide base | Função |
| --- | --- | --- |
| Apresentar o chefão | "Stanley · o chefão" | Nome gigante, barra de força (`.powbar`), "power-ups" revelados um a um e a foto do produto. Não classifique ainda. |
| Batalha | "Stanley · a batalha" | Log de turnos (um por fase do framework), resultado em nível e o "HP do hype" atual. |
| Segundo chefão | "Nubank · dois recursos" | Mesma empresa, dois recursos, dois níveis: mostra que o framework avalia o recurso, não a empresa. |

## Mundo 6 · Fase bônus (a dinâmica)

| Momento | Slide base | Função |
| --- | --- | --- |
| Regras | "Hora do leilão" no exemplo completo | 4 regras curtas. O app apresenta o case e a dinâmica com mais detalhe no telão. |
| Entrar | "Entre no jogo" | QR gigante do jogo, 3 passos e o mascote. **J** abre o telão do jogo por cima do deck. |
| Revelações | "Efeito Blockbuster" | Slides de apoio usados quando a carta correspondente vira no app (linha do tempo, foto, "Game over"). |

## Mundo 7 · Replay (aprendizado)

| Momento | Slide base | Função |
| --- | --- | --- |
| Replay | "Replay da partida" | Uma pergunta por armadilha da dinâmica. Quem errou explica o raciocínio: é o momento de maior aprendizado. |
| Save point | "Missão 3 · Save point" | Nuvem ao vivo: "De qual compra você se arrepende?". Ligue 3 respostas às letras do framework. |
| Notas do dev | "O que a pesquisa diz" | Confirmado / bug conhecido / novo conteúdo. Evidência e crítica do modelo, com referência. |
| Bônus atual | "SaaS na era da IA" | O framework aplicado a uma discussão de agora, com citações verificadas de líderes. Ilustração com logos nas molduras (`fit-logos`). |
| Mundo aberto | "O que estamos medindo?" | Volta à pergunta de abertura e aponta outras ferramentas. Não precisa fechar a resposta. |

## Mundo 8 · Fim de jogo

| Momento | Slide base | Função |
| --- | --- | --- |
| Ficha do personagem | "Ficha do personagem" | Aplicação pessoal (nota de 0 a 10 em cada fase) + votação ao vivo "qual letra você precisa subir?". |
| Créditos | "Créditos" | Autores, material base, teoria, referências, imprensa e créditos de imagens. |

## Tempo de referência (turma de ~50)

| Bloco | Tempo |
| --- | --- |
| Mundos 1 a 5 (exposição com missões) | 35–45 min |
| Dinâmica completa (lobby, case, 10 lotes, revelação, pódio) | 12–15 min |
| Replay, save point e fechamento | 10 min |

Numa partida de teste com 51 jogadores, o lobby até o pódio levou 6 min 46 s, incluindo a introdução do case.
