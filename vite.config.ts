import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, `/anthropic-api` and `/gemini-api` are routed through the Firebase
// Hosting emulator (default port 5000), which applies the rewrites in
// firebase.json and lets the Functions emulator inject the secrets. Run
// `firebase emulators:start` alongside `npm run dev` for AI features to work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/anthropic-api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/gemini-api':    { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
});
