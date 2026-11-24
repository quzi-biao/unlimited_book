import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlinePlugin } from './offline-plugin.js';

export default defineConfig({
  base: './',
  plugins: [react(), offlinePlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8888',
        changeOrigin: true,
        secure: false,          // 跳过自签名证书校验
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
