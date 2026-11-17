// Filtro simples de palavrões em português. Não é infalível: o host ainda pode
// remover o jogador no lobby.

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');

/** Bloqueados se aparecerem em qualquer lugar do nome. */
const SUBSTRINGS = [
  'porra', 'caralh', 'buceta', 'boceta', 'merda', 'foda', 'fodi', 'viado', 'arromb',
  'cacete', 'piroca', 'bosta', 'xoxota', 'vagabund', 'babaca', 'otari', 'cuzao', 'punheta',
  'boquete', 'siririca', 'rapariga', 'escrot', 'pqp', 'vsf', 'vtnc', 'fdp', 'retardad',
  'piranha', 'penis', 'vagina', 'nazis', 'hitler', 'cuzinho', 'filhodaput',
];
/** Bloqueados só como palavra inteira (curtos demais ou comuns dentro de outras palavras). */
const WORDS = [
  'cu', 'cus', 'pau', 'pica', 'rola', 'puta', 'puto', 'putas', 'xota', 'tnc', 'kct', 'krl', 'prr', 'bct',
  'sexo', 'corno', 'gozo',
];

export function isProfane(name: string): boolean {
  const n = normalize(name);
  const compact = n.replace(/[^a-z]/g, '');
  if (SUBSTRINGS.some((w) => compact.includes(w))) return true;
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => WORDS.includes(t));
}
