import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Genera rutas relativas (./assets/...) para que funcione en cualquier subcarpeta
export default defineConfig({
	plugins: [react()],
	base: './'
})
