import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // El prefijo solo se usa en la página publicada (GitHub Pages); en tu computador es http://localhost:5173
  base: command === 'build' ? '/cardiovalveai/' : '/',
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 1200 },
}));
