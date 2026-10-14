// Каталог упражнений (Торсо) для приложения: берётся из справочника Байдарки.
// Запуск: node scripts/make-catalog.mjs [путь к torsoExercises.json]
import { readFileSync, writeFileSync } from 'node:fs'
const src = process.argv[2] || '../baydarka/src/data/torsoExercises.json'
const all = JSON.parse(readFileSync(new URL(src, new URL('../', import.meta.url)), 'utf8'))
const out = all.map(e => ({ id: e.id, code: e.code, name: e.name_uz, group: e.muscle, cat: e.category, mode: e.mode, level: e.level || null, rest: e.rest_sec, count: e.count || null, info: e.info?.uz || null }))
writeFileSync(new URL('../src/catalog.json', import.meta.url), JSON.stringify(out))
console.log(out.length, 'exercises')
