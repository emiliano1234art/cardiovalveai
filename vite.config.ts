import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * - `npm run build`          → dist/ para GitHub Pages (base /cardiovalveai/)
 * - `npm run build:offline`  → entrega/ValveSense_presentacion.html, un único
 *                              archivo autocontenido que funciona sin internet.
 */
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    plugins: [react(), ...(offline ? [viteSingleFile()] : [])],
    base: offline ? './' : '/cardiovalveai/',
    server: { port: 5173, host: true },
    publicDir: offline ? false : 'public',
    build: offline
      ? { outDir: 'entrega/.build', emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 }
      : { chunkSizeWarningLimit: 1600 },
  };
});
