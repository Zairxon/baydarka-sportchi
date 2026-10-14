import { tr } from './i18n.js'

// Версия приложения и уведомление об обновлении. На сервере лежит version.json; если в нём сборка
// новее нашей — сверху появляется заметная полоса «Есть обновление», внизу кнопка «Обновить».
const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev'
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev'
let newer = false, started = false, busy = false

const stamp = iso => {
  const d = new Date(Date.parse(iso) + 5 * 3600e3)   // время Ташкента
  return Number.isFinite(+d) ? `${d.toISOString().slice(8, 10)}.${d.toISOString().slice(5, 7)} ${d.toISOString().slice(11, 16)}` : iso
}

// Сбрасывает service worker и кэш и открывает страницу заново.
export async function hardRefresh() {
  newer = false; busy = true; draw()
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())) } catch { /* без service worker */ }
  try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))) } catch { /* без кэша */ }
  const u = new URL(location.href); u.searchParams.set('u', Date.now()); location.replace(u.toString())
}

export function draw() {
  let el = document.getElementById('appfoot')
  if (!el) {
    el = document.createElement('footer'); el.id = 'appfoot'; document.body.appendChild(el)
    el.addEventListener('click', e => { if (e.target.closest('[data-upd]')) hardRefresh() })
  }
  el.innerHTML = tr(`<span class="fv">Baydarka · Sportchi · Versiya ${VERSION}${BUILD !== 'dev' ? ` · ${stamp(BUILD)}` : ''}</span>${newer || busy ? `<button type="button" class="fup${newer ? ' new' : ''}" data-upd ${busy ? 'disabled' : ''}>${busy ? 'Yangilanmoqda…' : 'Yangilash: yangi versiya bor'}</button>` : ''}`)
  const bar = document.getElementById('upd')
  if (bar) {
    bar.hidden = !newer
    bar.innerHTML = newer ? tr('<b>🔔 Yangi versiya bor!</b><button type="button" class="btn" data-upd>Yangilash va qayta ochish</button>') : ''
    if (!bar.dataset.bound) { bar.dataset.bound = '1'; bar.addEventListener('click', e => { if (e.target.closest('[data-upd]')) hardRefresh() }) }
  }
}

async function check() {
  try {
    const r = await fetch('./version.json?' + Date.now(), { cache: 'no-store' }); if (!r.ok) return
    const j = await r.json()
    const n = !!j.build && BUILD !== 'dev' && j.build !== BUILD
    if (n !== newer) { newer = n; draw() }
  } catch { /* нет сети */ }
}

export function mountFooter() {
  draw()
  if (started) return
  started = true
  check(); setInterval(check, 5 * 60e3)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
}
