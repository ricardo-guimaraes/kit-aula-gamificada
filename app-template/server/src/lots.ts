import type { PublicLot, SecretInfo } from '../../shared/types.ts';

export type LotDef = PublicLot & { secret: SecretInfo; /** fica fora da versão curta */ optional?: boolean };

/**
 * Case: a guerra do streaming. Cada jogador é CEO de uma startup brasileira de
 * streaming de vídeo e compra recursos no "Leilão de Ativos do Streaming".
 * A história contada no telão fica em shared/case.ts.
 *
 * Os lotes vão a pregão nesta ordem, alternando recursos bons e armadilhas.
 * Os campos de `secret` NUNCA vão para o front antes da revelação.
 *
 * - O lote com `reorgCost` é "a gaveta": quem arrematar recebe a proposta secreta.
 * - Lotes com `optional: true` saem da versão curta (8 lotes, ~10 min).
 * - Cada lote tem várias unidades (calculado pelo nº de jogadores), então os
 *   textos falam de "um" recurso daquele tipo: cada vencedor leva o seu.
 */
export const LOTS: LotDef[] = [
  {
    id: 1,
    icon: '📊',
    name: '10 anos de dados de audiência',
    pitch: 'O que milhões de brasileiros assistiram minuto a minuto, mais o time que transformou isso em algoritmo',
    secret: {
      label: 'Sustentável',
      points: 3,
      revealText: 'Valioso, raro e impossível de recriar sem os mesmos 10 anos e as mesmas pessoas. E a empresa inteira decide com base nele.',
    },
  },
  {
    id: 2,
    icon: '☁️',
    name: 'Servidores e CDN de ponta',
    pitch: 'Infraestrutura em nuvem para transmitir em 4K sem travar, do Oiapoque ao Chuí',
    secret: {
      label: 'Paridade',
      points: 0,
      revealText: 'Valioso, mas qualquer concorrente contrata a mesma nuvem amanhã. É o mínimo para jogar, não uma vantagem.',
    },
  },
  {
    id: 3,
    icon: '🎬',
    name: 'Série hit com exclusividade de 1 ano',
    pitch: 'A série mais comentada do ano, só no seu catálogo… até o contrato acabar',
    secret: {
      label: 'Temporária',
      points: 1,
      revealText: 'Rara hoje. Em 12 meses o estúdio vende a próxima temporada para quem pagar mais.',
    },
  },
  {
    id: 4,
    icon: '😎',
    name: 'CEO estrela do setor',
    pitch: 'O executivo mais famoso do streaming. Contrato sem multa de saída',
    secret: {
      label: 'Paridade',
      points: 0,
      revealText: 'O valor está nele, não na empresa. Sem multa, ele sai amanhã e leva tudo para o concorrente.',
    },
  },
  {
    id: 5,
    icon: '💬',
    name: 'Comunidade de 2 mi de fãs',
    pitch: 'Fãs que criam memes, teorias e defendem a marca nas redes, de graça',
    secret: {
      label: 'Sustentável',
      points: 3,
      revealText: 'Complexidade social: anos de relação e cultura que nenhum concorrente compra nem copia.',
    },
  },
  {
    id: 6,
    icon: '🎁',
    name: 'Retrospectiva anual viral',
    pitch: 'O "seu ano em séries" que vira trend em todas as redes em dezembro',
    optional: true,
    secret: {
      label: 'Temporária',
      points: 1,
      revealText: 'Funcionou. No ano seguinte, todo app lançou a sua retrospectiva.',
    },
  },
  {
    id: 7,
    icon: '🎥',
    name: 'Estúdio com 15 anos de time criativo',
    pitch: 'Roteiristas e diretores que há 15 anos transformam histórias brasileiras em sucesso',
    secret: {
      label: 'Sustentável',
      points: 3,
      revealText: 'Trajetória e cultura únicas: o concorrente constrói um prédio igual, mas não 15 anos de time.',
    },
  },
  {
    id: 8,
    icon: '🍿',
    name: 'Pacote de 500 filmes de Hollywood',
    pitch: 'Licença de 3 anos para clássicos e blockbusters dos grandes estúdios',
    optional: true,
    secret: {
      label: 'Paridade',
      points: 0,
      revealText: 'Os estúdios licenciam o mesmo pacote para todo mundo. Valioso, mas nada raro.',
    },
  },
  {
    id: 9,
    icon: '🗄️',
    name: 'Tecnologia na gaveta',
    pitch: 'Streaming interativo em que o público escolhe o final. Pronto há 5 anos, nunca lançado',
    secret: {
      label: 'Não explorada',
      points: 0,
      revealText: 'O efeito Kodak: valor, raridade e proteção não bastam se a empresa não se organiza para explorar.',
      reorgCost: 20,
      reorgPoints: 3,
    },
  },
  {
    id: 10,
    icon: '📼',
    name: 'Rede de 9.000 videolocadoras',
    pitch: 'A maior rede de locadoras do país, porteira fechada, com 2 milhões de DVDs no estoque',
    secret: {
      label: 'Desvantagem',
      points: -2,
      revealText: 'O efeito Blockbuster: o mercado mudou e o recurso virou peso. Aluguel, estoque e gente para pagar.',
    },
  },
];

export function lotsFor(short: boolean): LotDef[] {
  return short ? LOTS.filter((l) => !l.optional) : LOTS;
}

export function toPublic(lot: LotDef): PublicLot {
  return { id: lot.id, icon: lot.icon, name: lot.name, pitch: lot.pitch };
}
