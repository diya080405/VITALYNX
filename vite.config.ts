import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true as const,
      // Disable file watching when DISABLE_HMR is true to prevent flickering during agent edits,
      // while keeping Vite WS attached to the Express HTTP server so /@vite/client connects cleanly.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true
        }
      }
    },
  };
});
