import { PHRASES } from './dict.js'

// Языки: узбекский кириллицей (uz) и латиницей (uzl — исходный), русский, английский.
// Ключ языка общий с приложениями «Митти юрак» (uzi-lang).
export const LANGS = [['uz', 'Ўзбекча'], ['uzl', 'Oʻzbekcha'], ['ru', 'Русский'], ['en', 'English']]
const KEY = 'uzi-lang'
let lang = 'uzl'
try { const v = globalThis.localStorage?.getItem(KEY); if (LANGS.some(l => l[0] === v)) lang = v } catch { /* без сохранения */ }

export const getLang = () => lang
export function setLang(l) {
  lang = l
  try { globalThis.localStorage?.setItem(KEY, l) } catch { /* без сохранения */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l === 'uz' || l === 'uzl' ? 'uz' : l
}
if (typeof document !== 'undefined') document.documentElement.lang = lang === 'uz' || lang === 'uzl' ? 'uz' : lang

// Дни недели и месяцы для подписей дат («Seshanba, 14-oktabr»).
const DAYS = [['Yakshanba', 'Воскресенье', 'Sunday'], ['Dushanba', 'Понедельник', 'Monday'], ['Seshanba', 'Вторник', 'Tuesday'], ['Chorshanba', 'Среда', 'Wednesday'], ['Payshanba', 'Четверг', 'Thursday'], ['Juma', 'Пятница', 'Friday'], ['Shanba', 'Суббота', 'Saturday']]
const MONTHS = [['yanvar', 'января', 'January'], ['fevral', 'февраля', 'February'], ['mart', 'марта', 'March'], ['aprel', 'апреля', 'April'], ['may', 'мая', 'May'], ['iyun', 'июня', 'June'], ['iyul', 'июля', 'July'], ['avgust', 'августа', 'August'], ['sentabr', 'сентября', 'September'], ['oktabr', 'октября', 'October'], ['noyabr', 'ноября', 'November'], ['dekabr', 'декабря', 'December']]
const ALL = [...PHRASES, ...DAYS, ...MONTHS.map(([u, r, e]) => [`#-${u}`, `# ${r}`, `${e} #`])]

// ---------- узбекская латиница → кириллица ----------
const APOS = "['ʻʼ’`]"
const PROTECT = /(Chrome|Safari|iPhone|iPad|Telegram|Instagram|RPE|1PM|PM|Android|Baydarka · Sportchi)/g
const LAT = { a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'ц', w: 'в', e: 'е' }
const RULES = [
  [new RegExp(`o${APOS}`, 'gi'), 'ў'], [new RegExp(`g${APOS}`, 'gi'), 'ғ'],
  [/sh/gi, 'ш'], [/ch/gi, 'ч'], [/yo/gi, 'ё'], [/yu/gi, 'ю'], [/ya/gi, 'я'], [/ng/gi, 'нг'],
]
function latToCyr(text) {
  const parts = text.split(PROTECT)
  return parts.map((p, i) => (i % 2 ? p : convert(p))).join('')
}
function convert(s) {
  // Двубуквенные сочетания: сохраняем регистр по первой букве.
  let out = s
  for (const [re, cyr] of RULES) {
    out = out.replace(re, m => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? (m.length > 1 && m[1] === m[1].toUpperCase() && m[1] !== m[1].toLowerCase() ? cyr.toUpperCase() : cyr[0].toUpperCase() + cyr.slice(1)) : cyr))
  }
  out = out.replace(new RegExp(APOS, 'g'), 'ъ')
  // «e» в начале слова — «э»; остальные буквы по таблице.
  out = out.replace(/(^|[^A-Za-zА-Яа-яЎўҚқҒғҲҳ])([Ee])/g, (m, p, e) => p + (e === 'E' ? 'Э' : 'э'))
  return out.replace(/[A-Za-z]/g, ch => {
    const c = LAT[ch.toLowerCase()]
    if (!c) return ch
    return ch === ch.toLowerCase() ? c : c.toUpperCase()
  })
}

// ---------- словарь фраз ----------
const cache = {}
const NUM = '\\d+(?:[.,:]\\d+)?'
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function build(idx) {
  const map = new Map()
  for (const row of ALL) if (row[idx]) map.set(row[0], row[idx])
  const keys = [...map.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\p{L}\\p{N}'ʻʼ’])(?:${keys.map(k => esc(k).replace(/#/g, NUM)).join('|')})(?![\\p{L}\\p{N}'ʻʼ’])`, 'gu')
  return { map, re }
}

function phrase(text, idx) {
  const d = cache[idx] || (cache[idx] = build(idx))
  return text.replace(d.re, m => {
    if (d.map.has(m)) return d.map.get(m)   // ключ с буквальными цифрами («7 kunda…»)
    const nums = m.match(new RegExp(NUM, 'g')) || []
    const key = m.replace(new RegExp(NUM, 'g'), '#')
    const out = d.map.get(key)
    if (out == null) return m
    let i = 0
    return out.replace(/#/g, () => nums[i++] ?? '#')
  })
}

function text(t) {
  if (lang === 'ru') return phrase(t, 1)
  if (lang === 'en') return phrase(t, 2)
  if (lang === 'uz') return latToCyr(t)
  return t
}

// Переводит фрагмент HTML: текст между тегами и атрибуты placeholder / aria-label / title.
export function tr(html) {
  if (lang === 'uzl' || !html) return html
  return String(html).split(/(<[^>]*>)/).map(seg => {
    if (seg.startsWith('<')) return seg.replace(/\b(placeholder|aria-label|title)="([^"]*)"/g, (m, a, v) => `${a}="${text(v.replace(/&#39;/g, "'"))}"`)
    if (!seg.trim()) return seg
    return text(seg.replace(/&#39;/g, "'"))
  }).join('')
}

// Обычный текст (confirm, toast).
export const tt = s => (lang === 'uzl' ? s : text(String(s)))

// ---------- названия и описания упражнений ----------
// c — запись каталога (ru/en — {n, info}); fallback — название от тренера (узбекское).
export function exName(c, fallback) {
  if (lang === 'ru') return c?.ru?.n || fallback
  if (lang === 'en') return c?.en?.n || c?.ru?.n || fallback
  return fallback
}
export function exInfo(c, fallback) {
  if (lang === 'ru') return c?.ru?.info || fallback
  if (lang === 'en') return c?.en?.info || c?.ru?.info || fallback
  return fallback
}
