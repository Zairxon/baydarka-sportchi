import { defineConfig } from 'vite'

// Относительные пути: сайт лежит в подпапке GitHub Pages (…github.io/<repo>/).
export default defineConfig({
  base: './',
  test: { environment: 'node', include: ['test/**/*.test.js'] },
})
