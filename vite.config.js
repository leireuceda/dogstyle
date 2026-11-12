import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// La base depende del hosting:
// - GitHub Pages sirve el proyecto en /dogstyle/ (se define con VITE_BASE).
// - Vercel sirve en la raíz, por lo que el valor por defecto es /.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
