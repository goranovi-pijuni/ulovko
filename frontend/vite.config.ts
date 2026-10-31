import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Same-origin /api in development, matching the production setup
    // (Nginx/Caddy serves the SPA and proxies /api to the backend).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
