# Lições aprendidas e checklist de verificação

Cada item abaixo aconteceu de verdade na construção do Leilão VRIO. Confira todos antes de dizer que um deck ou app está pronto.

## Armadilhas do deck

| Sintoma | Causa | Como evitar |
| --- | --- | --- |
| "SE FALHAR _", "SNAPCHAT _ INSTAGRAM" | A fonte pixelada (Silkscreen) não tem "→" e outros símbolos | Use ":" ou texto em `.chip`, `.label`, `.lv`, `.live`. O `deck_tools.py check` acusa. |
| Acentos e ◀ ▶ quebrados ("â—€") no arquivo aberto do computador | Deck sem `<!doctype html>` e sem `<meta charset="utf-8">` (decks que nasceram como artifact do Claude vêm assim) | Mantenha os dois no topo. Sem doctype, o navegador ainda usa o modo de compatibilidade antigo. |
| Palavra da nuvem cortada ("EOLOCADO") | Uma palavra grande num painel estreito | O deck encolhe sozinho a fonte de palavras que não cabem. Teste a nuvem nos painéis estreitos. |
| Slide estoura para cima ou para baixo | Conteúdo maior que os ~810 px úteis (o centro vertical corta dos dois lados) | Calcule a altura: títulos em 2 linhas a 54–60 px, citações a 24–25 px. Nomes de autores em 2 colunas. |
| Cards cobrindo parte da ilustração | Ilustração larga demais | Ancore a imagem embaixo à direita com uma largura menor e um degradê (`mask-image`) na borda esquerda. |
| Logo ilegível na moldura | Logo horizontal muito largo | Use só o símbolo (Microsoft, Adobe). |
| Mudou o arquivo, mas a tela não muda | Trocar só o `#slide-N` não recarrega | Recarregue a página de verdade. |
| Edição pegou o trecho errado | `replace` num arquivo de 4 MB com texto repetido | `deck_tools.py apply`: cada trecho precisa ser único, senão nada é gravado. |
| Leitura do arquivo trava ou estoura o limite | Linhas com centenas de KB de base64 | Leia sempre a cópia `strip`. |
| Deck pesado | Imagens em PNG ou em tamanho original | WebP até ~1600 px, qualidade 75–82. |

## Armadilhas do app e do deploy

| Sintoma | Causa | Como evitar |
| --- | --- | --- |
| Bots presos no lobby | O script só reagia a mudanças de estado, não ao estado inicial | Ao observar uma sala, trate também o estado que vem na resposta do `room:watch`. |
| 50 pessoas e só 10 compram algo | Um vencedor por lote | Unidades por lote calculadas pelo tamanho da turma. |
| Case confuso | Lotes de setores diferentes | Um case, um setor; todos os níveis do framework representados. |
| Slide de teoria entrega a resposta do jogo | Exemplo da aula igual a um lote | Revise o roteiro contra a lista de lotes. |
| Sala nova sem `ADMIN_KEY` | Esqueceram a variável | `render.yaml` com `generateValue: true` e checagem em `/api/admin`. |
| Deploy apaga salas e missões | Estado em memória | Sem push perto da aula. |
| Netlify "não funciona" | Não mantém WebSocket | Render (ou Railway/Fly) para o servidor. |
| Teste local com o caminho do deck errado | Git Bash converte `/aula-x` em caminho do Windows | `MSYS_NO_PATHCONV=1`. |

## Armadilhas de verificação (não confie em sinais falsos)

- **Prints atrasados:** logo depois de uma transição, o print pode mostrar o estado anterior ou uma tela vazia. Espere 2–3 s, ou confira pelo texto da página antes de concluir que há um bug.
- **Teclas simuladas:** dispare `keydown` num elemento (`document.body`), não no `document`. O deck usa `e.target.closest`, e um erro aí não é bug do deck.
- **Servidor estático de teste** (`python -m http.server`) pode cortar arquivos grandes no meio (ERR_CONNECTION_RESET). Recarregue antes de concluir que o deck está quebrado.
- **Texto sem acento vindo do terminal do Windows** (curl com "Nubánk" virando "Nub�nk") é problema de codificação do terminal, não do app. Os testes automatizados cobrem acentos.
- **Pasta temporária:** imagens anexadas na conversa podem sumir quando a sessão reinicia. Copie para o projeto o que precisar reaproveitar.

## Checklist antes de entregar

**Deck**
- [ ] `python scripts/deck_tools.py check deck.html`: nenhum PROBLEMA.
- [ ] `outline`: todo slide com notas, títulos únicos, missões com QR.
- [ ] Passar por todos os slides e passos no navegador (1600×1000), com o console sem erros.
- [ ] Prints dos slides novos ou alterados: nada cortado, nada sobreposto, fontes certas.
- [ ] Cada citação e cada dado com fonte no slide e ressalvas nas notas.
- [ ] Créditos com autores, material base e fontes das imagens.

**App**
- [ ] `npm test` e `npm run typecheck` sem erros.
- [ ] Partida completa com 50 bots, local e no site publicado.
- [ ] Missões: responder pelo celular e ver no slide em até 2 s; ocultar e zerar pelo telão.
- [ ] J abre o jogo, A volta para o mesmo slide e o jogo segue rodando.

**Entrega**
- [ ] Dizer o que foi e o que não foi testado (celulares reais, Wi-Fi da faculdade).
- [ ] Cópia do deck para estudo com `LINKS.gameUrl` gravado, avisando que as notas vão junto.
- [ ] Checklist do dia (`app-ao-vivo.md`, seção 7).
