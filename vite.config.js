import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, open: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900, // three.js alone is ~700 kB minified
  },
});
