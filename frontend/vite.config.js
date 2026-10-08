import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Which backend `npm run dev` talks to. 5000 is a crowded port -- plenty
// of other dev servers claim it -- and when something else is already
// there the shop proxies to it and reports that stranger's 404s as its
// own, which takes a surprisingly long time to see.
//
//   API_PORT=5004 npm run dev
//
const API_PORT = process.env.API_PORT || '5000'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        // Say so in the terminal instead of letting the browser show a
        // bare 500 with nothing to search for.
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error(
              `\n  [api] cannot reach the backend on 127.0.0.1:${API_PORT} -- ${err.message}` +
              `\n  Start it:  cd backend && PORT=${API_PORT} python app.py\n`
            )
          })
        },
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // Fail the build rather than ship something unexpectedly heavy.
    chunkSizeWarningLimit: 350,
    rollupOptions: {
      output: {
        // React and the router change rarely, so a release that touches
        // only shop code leaves them cached in everyone's browser.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]react(-dom)?[\\/]/.test(id)) return 'react'
          if (id.includes('react-router')) return 'router'
          return 'vendor'
        },
        // Hashed names, so assets can be cached for a year.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
