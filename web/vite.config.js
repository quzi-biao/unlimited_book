import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'https://101.34.87.172:8888',
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
