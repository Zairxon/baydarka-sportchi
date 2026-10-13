import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Относительные пути: сайт лежит в подпапке GitHub Pages (…github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
})
