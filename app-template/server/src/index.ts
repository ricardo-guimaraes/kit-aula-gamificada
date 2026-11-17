import { buildServer, optionsFromEnv } from './http.ts';

const PORT = Number(process.env.PORT) || 3001;
const opts = optionsFromEnv();
const { httpServer } = buildServer(opts);

httpServer.listen(PORT, () => {
  console.log(`Leilão VRIO ouvindo na porta ${PORT}`);
  console.log(`Apresentação da aula em ${opts.deckPath}`);
});
