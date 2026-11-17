// Texto público do case, mostrado no telão e no celular antes do leilão.
// Os recursos (e o que cada um vale) ficam em server/src/lots.ts.

export const CASE = {
  title: 'A guerra do streaming',
  kicker: 'O case',
  /** Parágrafos da etapa 1, no telão e no celular. */
  story: [
    'Você é CEO de uma startup brasileira de streaming de vídeo. Os gigantes globais dominam o mercado e todo ano alguém fecha as portas.',
    'Sua startup acaba de receber R$ 100 milhões de investimento.',
    'Hoje acontece o Leilão de Ativos do Streaming: estúdios, fundos e empresas que quebraram estão vendendo recursos.',
  ],
  question: 'Quais recursos vão manter a sua empresa na frente daqui a 5 anos?',
  /** Etapa 2: como se ganha. */
  mission: {
    title: 'Sua missão',
    lead: 'Vence quem construir vantagem competitiva, não quem gastar mais.',
    scale: [
      { label: 'Vantagem sustentável', points: '+3', hint: 'Valioso, raro, difícil de imitar e a empresa sabe explorar' },
      { label: 'Vantagem temporária', points: '+1', hint: 'Valioso e raro, mas os concorrentes copiam logo' },
      { label: 'Paridade', points: '0', hint: 'Valioso, mas qualquer um tem ou compra igual' },
      { label: 'Desvantagem', points: '−2', hint: 'Custa mais do que entrega' },
    ],
    footer: 'A classificação de cada recurso só aparece no fim. Desempate: quem tiver mais dinheiro sobrando.',
  },
} as const;
