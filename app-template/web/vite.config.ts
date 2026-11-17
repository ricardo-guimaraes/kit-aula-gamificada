import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': 'http://localhost:3001',
      // apresentação da aula (servida pelo Node); mesmo caminho do DECK_PATH
      [process.env.DECK_PATH || '/aula']: 'http://localhost:3001',
    },
  },
});
