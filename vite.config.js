import { defineConfig } from 'vite'

// Версия: номер сборки на GitHub (2.N), время сборки; version.json рядом с сайтом позволяет
// установленным копиям узнать, что вышла новая версия.
const BUILD = new Date().toISOString()
const VERSION = `2.${process.env.GITHUB_RUN_NUMBER || 'dev'}`
const versionJson = () => ({ name: 'version-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, version: VERSION }) }) } })

// Относительные пути: сайт лежит в подпапке GitHub Pages (…github.io/<repo>/).
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD), __VERSION__: JSON.stringify(VERSION) },
  plugins: [versionJson()],
  test: { environment: 'node', include: ['test/**/*.test.js'] },
})
