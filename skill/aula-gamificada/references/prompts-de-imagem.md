# Prompts de imagem para a aula gamificada

Use estes prompts num gerador de imagens (ChatGPT/DALL·E, Gemini, Midjourney, Ideogram, Canva, Firefly…). Gere, escolha a melhor versão e anexe na conversa com o Claude. Ele encaixa as imagens no deck e no app.

## Regras que valem para todas

- **Sem texto dentro da imagem.** Geradores erram letras, e o texto do slide fica melhor no HTML, com a fonte do deck. A exceção é a ilustração "logos em molduras": nela as molduras ficam vazias e brancas, e os logos entram depois.
- **Estilo único em toda a aula.** Repita o mesmo trecho de estilo em todos os prompts:
  > *estética de videogame retrô com acabamento moderno, fundo azul-marinho muito escuro (#0D0B1E), luz neon roxa (#7C3AED) e dourada (#FFC23D), alto contraste, iluminação de borda (rim light)*
- **Tamanhos:** ilustrações de slide em 16:9 (1920×1080 ou maior). Mascote em retrato (~1200×1300), **fundo transparente** (PNG). Se o gerador não fizer transparência, peça um "fundo branco liso" e remova o fundo depois (remove.bg, Canva ou o recorte do próprio gerador).
- **Pessoas reais:** só gere o mascote a partir da foto de alguém **com autorização** dessa pessoa. Não use logos nem uniformes de instituições sem permissão; use uma camisa lisa com um selo genérico.
- **Espaço para o texto:** nas ilustrações de slide, peça o assunto à direita e **o terço esquerdo vazio e escuro**. O texto do slide entra nesse espaço.

## 1. Mascote (4 poses usadas pelo app e pelo deck)

O app procura estes arquivos em `web/public/mascote/`: `moeda.webp`, `podio.webp`, `martelada.webp` e `replay.webp`. Gere primeiro a pose 1. Depois use **a mesma imagem como referência** (ou o recurso de "personagem consistente" do gerador) para as outras três, para o rosto não mudar.

**Base do personagem** (cole no início de cada pose):
> Personagem 3D estilizado no estilo de animação de cinema (Pixar/DreamWorks), caricatura simpática de [descrição da pessoa: idade, cabelo, óculos, barba…] [ou: baseado na foto anexada, com autorização], vestindo camisa polo azul-marinho com um crachá vermelho genérico sem texto, relógio esportivo, iluminação de borda neon roxa e dourada, corpo da cintura para cima, **fundo transparente**, sem texto.

| Arquivo | Pose (acrescente à base) | Onde aparece |
| --- | --- | --- |
| `moeda.webp` | sorrindo, apontando para a câmera com uma mão e segurando com a outra uma grande ficha dourada de fliperama com um joystick gravado, pequenos raios de brilho em volta da ficha | lobby do jogo, entrada do celular, slide "Entre no jogo" |
| `podio.webp` | corpo inteiro, de pé atrás de um púlpito de madeira com detalhes dourados, erguendo um martelo de leiloeiro dourado, sorriso confiante | tela inicial do professor, introdução do case, créditos |
| `martelada.webp` | batendo com força o martelo dourado no púlpito, faíscas douradas no impacto, notas de dinheiro roxas voando, expressão eufórica, punho cerrado de comemoração | "VENDIDO!" no telão, slide da fase bônus |
| `replay.webp` | braços cruzados, sorriso de canto, olhando para uma tela flutuante de "replay" com moldura dourada e um martelo brilhando na tela | "Hora da verdade" (revelação), slide de replay |

Depois de gerar: recorte o fundo e salve como WebP ou PNG com ~1200 px de altura. Peça ao Claude para substituir os 4 arquivos e embutir as poses nos slides.

## 2. Ilustrações de slide (16:9)

Acrescente o trecho de estilo das regras gerais em cada prompt.

| Slide | Prompt |
| --- | --- |
| Capa | Blocos 3D brilhantes como peças de brinquedo, cada um com uma letra do framework ([ex.: V, R, I, O]) em neon de cores diferentes, empilhados à direita da composição sobre um piso reflexivo de fliperama, ícones de videogame em neon ao fundo (controle, invasor espacial), terço esquerdo vazio e escuro para o título. |
| Recurso × capacidade | Tela de videogame dividida: à esquerda, um inventário em grade com itens (baú, moedas, chave, poção); à direita, uma árvore de habilidades com nós conectados e brilhando. Sem texto. |
| Mapa do jogo | Mapa de mundo de videogame visto de cima, com uma trilha que sai de um castelo, passa por [N] fases numeradas apenas por bandeiras coloridas (sem números escritos) e termina num troféu dourado. Fases bem espaçadas na horizontal. |
| Fase "difícil de copiar" | Tela dividida: à esquerda, uma linha de produção cheia de copos térmicos idênticos e coloridos; à direita, um time diverso rindo junto num escritório criativo. Contraste entre o que se copia e o que não se copia. |
| Fase "organização" | Campo de futebol visto de cima, um craque brilhando no centro e o resto do time espalhado, trombando e perdido, sem formação tática. Tom bem-humorado. |
| Escada de níveis | Estudante comemorando no topo de uma escada de 5 degraus que vai do vermelho ao verde, com estrelas e um "level up" luminoso sem texto, fundo transparente ou escuro. |
| Invenção na gaveta | Uma câmera digital brilhante trancada dentro de uma gaveta de arquivo de metal com cadeado, luz dourada escapando pelas frestas. |
| Engenharia reversa / SaaS | Robô com capacete de mineiro e lupa fazendo engenharia reversa de um servidor com engrenagens e um cadeado dourado, cercado por **8 telas flutuantes em arco com bordas coloridas grossas e o centro TOTALMENTE BRANCO E VAZIO**, estilo pixel art isométrico. Terço esquerdo vazio. (As telas brancas recebem os logos com `deck_tools.py fit-logos`.) |
| Moeda / nota da recompensa | Uma nota de dinheiro de videogame, roxa e dourada, com um valor "10M" estilizado e um troféu no centro, fundo transparente. (Esta pode ter o número.) |

## 3. Fotos de marcas e de produtos

Não gere imagens de produtos reais de marcas. Use fotos **oficiais**: site da empresa, kit de imprensa ou Wikimedia Commons com licença, sempre citando a fonte no slide. O Claude busca, mostra antes de usar e coloca o crédito.

## 4. Como pedir ao Claude para encaixar

> "Anexei as 4 poses do mascote (moeda, podio, martelada, replay) e a ilustração da capa. Substitua os marcadores do deck e os arquivos de `web/public/mascote/`, mantendo os nomes, e confira se nada ficou cortado."
