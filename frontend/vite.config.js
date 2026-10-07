import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
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
