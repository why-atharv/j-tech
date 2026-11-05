import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

const SERVER = `http://127.0.0.1:${process.env.WILDSCAN_PORT || 3000}`;

export default defineConfig(({ mode }) => ({
  plugins: mode === 'http' ? [react()] : [react(), basicSsl()],
  server: {
    host: true,
    port: 5199,
    strictPort: true,
    proxy: {
      '/socket.io': { target: SERVER, ws: true, changeOrigin: true },
      '/api': { target: SERVER, changeOrigin: true }
    }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scanner: resolve(__dirname, 'scanner/index.html')
      }
    }
  }
}));
