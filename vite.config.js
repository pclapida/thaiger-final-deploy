import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // El bundle superaba 1 MB en un solo archivo; se separan las librerias pesadas.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
    // Las Edge Functions corren en Deno, pero su lógica pura (firma de Mercado
    // Pago, empaquetado, plantillas de correo) se prueba aquí con Node.
    include: ['src/**/*.test.{js,jsx}', 'supabase/functions/**/*.test.ts'],
  },
})
