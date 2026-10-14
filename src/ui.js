import { tr, tt } from './i18n.js'

// Мелкие общие элементы: уведомление, нижняя панель, тема.
let toastTimer = null
export function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return
  t.textContent = tt(msg); t.hidden = false
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true }, 2200)
}

export function openSheet(html) {
  const h = document.getElementById('sheet')
  h.innerHTML = tr(`<div class="sheet"><div class="sheet-in">${html}</div></div>`)
}
export function closeSheet() { document.getElementById('sheet').innerHTML = '' }

export function applyTheme() {
  let t = null
  try { t = localStorage.getItem('bs2_theme') } catch { /* без сохранения */ }
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
}
export function flipTheme() {
  const dark = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'
  try { localStorage.setItem('bs2_theme', dark ? 'light' : 'dark') } catch { /* без сохранения */ }
  applyTheme()
}
