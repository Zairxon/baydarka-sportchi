import { state } from '../store.js'
import en from './en.js'
import uz from './uz.js'
import { cyrToLatin } from './translit.js'
import { EXTRA } from './extra.js'
import { latToCyr } from '../../i18n.js'

// Языки: ru — исходный (в коде), uz — узбекский кириллицей, uzl — узбекский латиницей, en — английский.
export const LANGS = [['ru', 'Русский'], ['uz', 'Ўзбекча'], ['uzl', 'Oʻzbekcha'], ['en', 'English']]

const BASE = {
  en: { ...en, ...Object.fromEntries(EXTRA.map(([ru, , e]) => [ru, e])) },
  uz: { ...uz, ...Object.fromEntries(EXTRA.map(([ru, l]) => [ru, latToCyr(l)])) },
}
const dicts = {}
const caches = {}

function dictFor(lang) {
  if (dicts[lang]) return dicts[lang]
  let map
  if (lang === 'uzl') map = Object.fromEntries(Object.entries(BASE.uz).map(([k, v]) => [k, cyrToLatin(v)]))
  else map = BASE[lang]
  const keys = Object.keys(map).filter(k => (k.length > 1 || /[А-Яа-я]/.test(k)) && !k.startsWith('#')).sort((a, b) => b.length - a.length)
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // подстановка фраз внутри длинной строки: только по границам слов
  const re = keys.length ? new RegExp(`(?<![А-Яа-яЁё])(?:${keys.map(esc).join('|')})(?![А-Яа-яЁё])`, 'g') : null
  // шаблоны: ключи с # (подстановка произвольного текста), например «Темп #: вес растёт медленнее нужного.»
  const tpls = Object.keys(map)
    .filter(k => k.includes('#') && !k.startsWith('#') && k.replace(/#/g, '').trim().length >= 8 && /[А-Яа-яЁё]/.test(k))
    .sort((a, b) => b.replace(/#/g, '').length - a.replace(/#/g, '').length)
    .map(k => ({ k, re: new RegExp('^' + k.split('#').map(esc).join('(.*?)') + '$', 's') }))
  return (dicts[lang] = { map, re, tpls })
}

export const getLang = () => state.lang || 'ru'

// предпочтительный язык при первом запуске
export function detectLang() {
  const l = (typeof navigator !== 'undefined' && navigator.language || 'ru').toLowerCase()
  if (l.startsWith('uz')) return 'uzl'
  if (l.startsWith('en')) return 'en'
  return 'ru'
}

const CYR = /[А-Яа-яЁё]/
const NUM = /\d{1,2}:\d{2}|\d{1,3}(?:[  ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g

function fmtNumFor(lang, s) {
  if (lang === 'en') {
    if (/[  ]/.test(s)) return s.replace(/[  ]/g, ',').replace(/,(\d{1,2})$/, '.$1')
    return /^\d+,\d+$/.test(s) ? s.replace(',', '.') : s
  }
  return s
}

export function normalize(seg) {
  const nums = []
  const key = seg.replace(NUM, m => { nums.push(m); return '#' })
  return { key, nums }
}

function put(lang, tpl, nums) {
  let i = 0
  return tpl.replace(/#/g, () => (i < nums.length ? fmtNumFor(lang, nums[i++]) : ''))
}

const cyrCount = s => (s.match(/[А-Яа-яЁё]/g) || []).length

function viaTemplate(lang, seg, tpls, map) {
  for (const { k, re } of tpls) {
    const m = re.exec(seg)
    if (!m) continue
    let i = 1
    return map[k].replace(/#/g, () => (i < m.length ? translateSeg(lang, (m[i++] || '').trim()) : ''))
  }
  return null
}

function translateSeg(lang, seg) {
  const c = (caches[lang] ||= new Map())
  if (c.has(seg)) return c.get(seg)
  const { map, re, tpls } = dictFor(lang)
  const { key, nums } = normalize(seg)
  let out
  if (map[key] !== undefined) out = put(lang, map[key], nums)
  else {
    // сначала шаблоны целых предложений с вставками, затем подстановка отдельных фраз
    const viaT = tpls.length ? viaTemplate(lang, seg, tpls, map) : null
    out = viaT !== null ? viaT : (re ? put(lang, key.replace(re, m => map[m] ?? m), nums) : seg)
  }
  c.set(seg, out)
  return out
}

const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const encode = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Перевод на заданный язык, независимо от выбранного в приложении
export function ttIn(lang, text) {
  if (lang === 'ru' || !text || !CYR.test(text)) return text
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  return m[1] + translateSeg(lang, m[2]) + m[3]
}

// Перевод обычной строки (тосты, уведомления)
export function tt(text) {
  const lang = getLang()
  if (lang === 'ru' || !text || !CYR.test(text)) return text
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  return m[1] + translateSeg(lang, m[2]) + m[3]
}

const ATTR = /(\s(?:placeholder|aria-label|title|alt)=)"([^"]*)"/g

// В английском: десятичная точка и запятая в тысячах там, где в тексте только числа
const enNums = s => s.replace(/(d),(d)/g, '$1.$2').replace(/(d)[  ](d{3})/g, '$1,$2')

// Перевод готового HTML: текст между тегами и подписи в атрибутах. Содержимое textarea (копия данных) не трогаем
export function tr(html) {
  const lang = getLang()
  if (lang === 'ru' || !html || !CYR.test(html)) return html
  let skip = false
  return html.split(/(<[^>]*>)/).map(part => {
    if (part.startsWith('<')) {
      if (/^<textarea/i.test(part)) skip = true
      else if (/^<\/textarea/i.test(part)) skip = false
      return CYR.test(part) ? part.replace(ATTR, (m, a, v) => `${a}"${encode(translateSeg(lang, decode(v)))}"`) : part
    }
    if (skip) return part
    if (!CYR.test(part)) return lang === 'en' ? enNums(part) : part
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(part)
    return m[1] + encode(translateSeg(lang, decode(m[2]))) + m[3]
  }).join('')
}

// Сегменты текста в готовом HTML (для сбора ключей перевода)
export function segmentsOf(html) {
  const out = []
  let skip = false
  for (const part of html.split(/(<[^>]*>)/)) {
    if (part.startsWith('<')) {
      if (/^<textarea/i.test(part)) skip = true
      else if (/^<\/textarea/i.test(part)) skip = false
      for (const m of part.matchAll(ATTR)) if (CYR.test(m[2])) out.push(decode(m[2]).trim())
    } else if (!skip && CYR.test(part)) out.push(decode(part).trim())
  }
  return out
}

export function missing(lang, seg) {
  const { map } = dictFor(lang)
  const { key } = normalize(seg)
  return map[key] === undefined
}
export { dictFor }
