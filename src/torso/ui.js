import { today } from './store.js'
import { tr, tt } from './i18n/core.js'

// Реестры обработчиков: клики (data-a) и ввод (data-in)
export const acts = {}
export const ins = {}

// Общий контекст интерфейса
export const ctx = {
  render: () => {},
  tab: 'today',
  date: today(),
  wsub: null, // подраздел вкладки «Тренировка»
  psub: null, // подраздел «Профиль»
  rest: null, // {end, total}
  pick: null,
  exSel: null,
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const r1 = n => Math.round(n * 10) / 10
export const num = v => {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
export const fmtNum = n => (Math.round(n * 10) / 10).toString().replace('.', ',')

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
export function dateLabel(ds) {
  const [y, m, d] = ds.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}
export function dateLong(ds) {
  const [y, m, d] = ds.split('-').map(Number)
  return `${DOW[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}`
}

let toastTimer
export function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = tt(msg)
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600)
}

export const setHtml = (el, html) => { el.innerHTML = tr(html) }

export function openSheet(html) {
  const el = document.getElementById('sheet')
  el.innerHTML = `<div class="sheet-bg" data-a="closeSheet"></div><div class="sheet-body">${tr(html)}</div>`
  el.classList.add('open')
  document.body.classList.add('noscroll')
}
let askRes = null
export function closeSheet() {
  if (askRes) { const r = askRes; askRes = null; r(false) }
  const el = document.getElementById('sheet')
  el.classList.remove('open')
  el.innerHTML = ''
  document.body.classList.remove('noscroll')
}
acts.closeSheet = closeSheet

// Подтверждение в стиле приложения (вместо системного confirm)
export function ask(msg, okLabel = 'Да', danger = false) {
  return new Promise(res => {
    openSheet(`<p class="ask">${esc(msg)}</p><div class="row2"><button class="btn ghost" data-a="askNo">Отмена</button><button class="btn ${danger ? 'bad' : ''}" data-a="askYes">${esc(okLabel)}</button></div>`)
    askRes = res
  })
}
acts.askYes = () => { const r = askRes; askRes = null; closeSheet(); r?.(true) }
acts.askNo = () => closeSheet()

// Выпадающий список в цветах приложения (системный select рисуется в светлой теме)
export function dd(id, options, value) {
  const cur = options.find(o => String(o[0]) === String(value)) || options[0]
  return `<div class="dd" id="${id}" data-value="${esc(cur[0])}"><button type="button" class="dd-b" data-a="ddToggle"><span>${esc(cur[1])}</span><i>▾</i></button><div class="dd-l">${options.map(([v, l]) => `<button type="button" class="dd-o ${String(v) === String(cur[0]) ? 'on' : ''}" data-a="ddPick" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div></div>`
}
export const ddVal = id => document.getElementById(id)?.dataset.value
export const closeDd = () => document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open'))
acts.ddToggle = (d, el) => {
  const box = el.closest('.dd')
  const was = box.classList.contains('open')
  closeDd()
  if (!was) box.classList.add('open')
}
acts.ddPick = (d, el) => {
  const box = el.closest('.dd')
  box.dataset.value = d.v
  box.querySelector('.dd-b span').textContent = el.textContent
  box.querySelectorAll('.dd-o').forEach(o => o.classList.toggle('on', o === el))
  box.classList.remove('open')
  ins[box.id]?.({ value: d.v, id: box.id, dataset: box.dataset })
}

// ---------- графики ----------
const W = 320
const H = 150
const PAD = { l: 34, r: 8, t: 10, b: 20 }

function niceRange(min, max) {
  if (min === max) { min -= 1; max += 1 }
  const pad = (max - min) * 0.12
  return [min - pad, max + pad]
}

/**
 * series: [{ pts: [{x, y}], color, dots?, dash? }], x — номер дня (число), labels: [{x, text}]
 * opts: { hline: число (целевая линия), xLabels: [{x, t}], fmtY }
 */
export function lineChart(series, opts = {}) {
  const all = series.flatMap(s => s.pts)
  if (!all.length) return '<div class="empty">Пока нет данных</div>'
  let xmin = Math.min(...all.map(p => p.x))
  let xmax = Math.max(...all.map(p => p.x))
  if (xmin === xmax) { xmin -= 1; xmax += 1 }
  const ys = all.map(p => p.y)
  if (opts.hline != null) ys.push(opts.hline)
  const [ymin, ymax] = niceRange(Math.min(...ys), Math.max(...ys))
  const X = x => PAD.l + ((x - xmin) / (xmax - xmin)) * (W - PAD.l - PAD.r)
  const Y = y => PAD.t + (1 - (y - ymin) / (ymax - ymin)) * (H - PAD.t - PAD.b)
  const fy = opts.fmtY || (v => fmtNum(v))
  let g = ''
  for (let i = 0; i < 4; i++) {
    const v = ymin + ((ymax - ymin) * i) / 3
    g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${PAD.l - 4}" y="${Y(v) + 3}" class="ax" text-anchor="end">${fy(v)}</text>`
  }
  if (opts.hline != null) g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(opts.hline)}" y2="${Y(opts.hline)}" class="target"/>`
  for (const s of series) {
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
    if (s.pts.length > 1) g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.dots ? 1 : 2.2}" ${s.dash ? 'stroke-dasharray="3 3"' : ''} stroke-linejoin="round" stroke-linecap="round" opacity="${s.dots ? 0.4 : 1}"/>`
    if (s.dots || s.pts.length === 1) g += s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('')
  }
  for (const l of opts.xLabels || []) {
    g += `<text x="${X(l.x)}" y="${H - 5}" class="ax" text-anchor="${l.a || 'middle'}">${esc(l.t)}</text>`
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}</svg>`
}

export function barChart(bars, opts = {}) {
  const max = Math.max(opts.target || 0, ...bars.map(b => b.v), 1) * 1.1
  const bw = (W - PAD.l - PAD.r) / bars.length
  const Y = v => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  let g = ''
  for (let i = 0; i < 3; i++) {
    const v = (max * i) / 2
    g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${PAD.l - 4}" y="${Y(v) + 3}" class="ax" text-anchor="end">${Math.round(v)}</text>`
  }
  bars.forEach((b, i) => {
    const x = PAD.l + i * bw + bw * 0.18
    const w = bw * 0.64
    const cls = b.cls || ''
    if (b.v > 0) g += `<rect x="${x.toFixed(1)}" y="${Y(b.v).toFixed(1)}" width="${w.toFixed(1)}" height="${(H - PAD.b - Y(b.v)).toFixed(1)}" rx="3" class="bar ${cls}"/>`
    g += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 5}" class="ax" text-anchor="middle">${esc(b.l)}</text>`
  })
  if (opts.target) g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(opts.target)}" y2="${Y(opts.target)}" class="target"/>`
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}</svg>`
}

export const fmtTime = sec => {
  sec = Math.max(0, Math.round(sec))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
