import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API is called as /api on the same origin, so the login cookie is first-party (dev and production)
    proxy: { '/api': { target: process.env.VITE_API_TARGET ?? 'http://localhost:5000', changeOrigin: true } },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.js', globals: true, css: false },
});
