// Каталог упражнений (Торсо) для приложения: берётся из справочника Байдарки.
// Запуск: node scripts/make-catalog.mjs [путь к torsoExercises.json]
import { readFileSync, writeFileSync } from 'node:fs'
const src = process.argv[2] || '../baydarka/src/data/torsoExercises.json'
const all = JSON.parse(readFileSync(new URL(src, new URL('../', import.meta.url)), 'utf8'))
const seed = JSON.parse(readFileSync(new URL('../baydarka/src/data/seed.json', new URL('../', import.meta.url)), 'utf8')).exercises || []
const out = all.map(e => ({ ru: { n: e.name_ru, info: e.info?.ru || null }, en: e.name_en ? { n: e.name_en, info: e.info?.en || null } : null, id: e.id, code: e.code, name: e.name_uz, group: e.muscle, cat: e.category, mode: e.mode, level: e.level || null, rest: e.rest_sec, count: e.count || null, kinds: e.kinds || [], info: e.info?.uz || null }))
// Беговые и прыжковые упражнения (R_…): названия и описания на трёх языках.
const runList = JSON.parse(readFileSync(new URL('../baydarka/src/data/runExercises.json', new URL('../', import.meta.url)), 'utf8'))
for (const e of runList) out.push({ ru: { n: e.name_ru, info: e.info?.ru || null }, en: { n: e.name_en, info: e.info?.en || null }, id: e.id, code: e.code, name: e.name_uz, group: 'run', cat: e.category, mode: e.mode, level: null, rest: e.rest_sec, count: null, kinds: e.kinds || [], info: e.info?.uz || null })
// Упражнения со своим весом (B_…) для ОФП.
const bodyList = JSON.parse(readFileSync(new URL('../baydarka/src/data/bodyExercises.json', new URL('../', import.meta.url)), 'utf8'))
for (const e of bodyList) out.push({ ru: { n: e.name_ru, info: e.info?.ru || null }, en: { n: e.name_en, info: e.info?.en || null }, id: e.id, code: e.code, name: e.name_uz, group: 'body', cat: e.category, mode: e.mode, level: null, rest: e.rest_sec, count: null, kinds: e.kinds || [], info: e.info?.uz || null })
// Упражнения М01–М43 (из справочника тренера): только названия для показа на других языках.
for (const e of seed) out.push({ id: e.id, code: e.code, name: e.name_uz, group: 'special', cat: e.category, mode: null, level: null, rest: 90, count: null, kinds: [], ru: { n: e.name_ru || e.name_uz, info: null }, en: null, info: null })
writeFileSync(new URL('../src/catalog.json', import.meta.url), JSON.stringify(out))
console.log(out.length, 'exercises')
