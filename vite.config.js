import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/ray-tracing-audio/',
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        cayley: resolve(__dirname, 'cayley.html'),
        camera: resolve(__dirname, 'camera.html'),
      },
    },
  },
  server: {
    open: true
  }
});