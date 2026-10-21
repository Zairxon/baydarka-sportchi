import './style.css'
import { state, save, today } from './store.js'
import { acts, ins, ctx, fmtTime, toast, closeDd, closeSheet } from './ui.js'
import { startStepSync, webStepsResume } from './steps.js'
import { tr, tt, detectLang } from './i18n/core.js'
import { syncWidget, pushWidget } from './widget.js'
import { checkUpdate, updateInfo } from './update.js'
import { syncReminders, ensurePermission, scheduleRest, cancelRest } from './notify.js'
import { renderToday } from './views/today.js'
import { renderWorkout } from './views/workout.js'
import { renderProgress } from './views/progress.js'
import { renderProfile, renderKnowledge, profileForm, resetDraft } from './views/profile.js'

// Язык берём из приложения спортсмена (ключ uzi-lang): ru, uz (кириллица), uzl (латиница), en.
try { const L = localStorage.getItem('uzi-lang'); if (['ru', 'uz', 'uzl', 'en'].includes(L)) state.lang = L; else if (!state.lang) state.lang = 'uzl' } catch { /* без хранилища */ }
document.documentElement.lang = ({ ru: 'ru', uz: 'uz-Cyrl', uzl: 'uz-Latn', en: 'en' })[state.lang] || 'uz-Latn'

const bl = document.querySelector('.backlink')
if (bl) bl.textContent = '‹ ' + ({ ru: 'Назад', uz: 'Орқага', uzl: 'Orqaga', en: 'Back' })[state.lang]

const app = document.getElementById('app')

const TABS = [
  ['today', 'Питание', '<path d="M4 3v7a3 3 0 0 0 3 3v8M7 3v6M10 3v7a3 3 0 0 1-3 3M17 3c-2 1-3 4-3 8h3v10"/>'],
  ['progress', 'Прогресс', '<path d="M3 20h18M6 16l4-5 4 3 5-8"/>'],
  ['learn', 'Знания', '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z M12 6v13"/>'],
  ['profile', 'Профиль', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/>'],
]

let currentDate = today()

function render() {
  document.title = tt('Здоровье')
  const actualDate = today()
  if (ctx.date === currentDate && actualDate !== currentDate) ctx.date = actualDate
  currentDate = actualDate
  const scroll = window.scrollY
  if (!state.profile) {
    app.innerHTML = tr(`<main class="page">${profileForm(true)}</main>`)
    document.getElementById('rest')?.remove()
    return
  }
  let body
  switch (ctx.tab) {
    case 'workout': body = renderWorkout(); break
    case 'progress': body = renderProgress(); break
    case 'learn': body = renderKnowledge(); break
    case 'profile': body = renderProfile(); break
    default: body = renderToday()
  }
  app.innerHTML = tr(`<main class="page">${body}</main>
    <nav class="tabs">${TABS.map(([k, n, ic]) => `<button class="${ctx.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg><span>${n}</span></button>`).join('')}</nav>`)
  window.scrollTo(0, scroll)
  updateRest()
  pushWidget()
}
ctx.render = render

// Переключаем дневные данные после полуночи и при возвращении в приложение.
const refreshDay = () => {
  const previous = ctx.date
  render()
  if (ctx.date !== previous) window.scrollTo(0, 0)
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay() })
window.addEventListener('focus', refreshDay)
setInterval(() => { if (today() !== currentDate) refreshDay() }, 30000)

// Android Back закрывает верхний уровень и возвращает на главный экран.
window.handleTorsoAndroidBack = () => {
  if (document.getElementById('sheet')?.classList.contains('open')) { closeSheet(); return true }
  if (document.querySelector('.dd.open')) { closeDd(); return true }
  if (ctx.wsub) { ctx.wsub = null; render(); return true }
  if (ctx.psub) { ctx.psub = null; render(); return true }
  if (ctx.tab === 'learn' && ctx.ksub === 'supp') { ctx.ksub = 'art'; render(); return true }
  if (ctx.tab !== 'today') {
    ctx.tab = 'today'
    ctx.wsub = ctx.tsub = ctx.psub = null
    render()
    window.scrollTo(0, 0)
    return true
  }
  if (ctx.date !== today()) { ctx.date = today(); render(); window.scrollTo(0, 0); return true }
  return false
}

acts.tab = ({ t }) => {
  ctx.tab = t
  ctx.wsub = null
  ctx.tsub = null
  ctx.psub = null
  resetDraft()
  render()
  window.scrollTo(0, 0)
}

document.addEventListener('click', ev => {
  if (!ev.target.closest('.dd')) closeDd()
  const el = ev.target.closest('[data-a]')
  if (!el) return
  const fn = acts[el.dataset.a]
  if (fn) fn(el.dataset, el)
})

const onInput = ev => {
  const el = ev.target
  const key = el.dataset?.in || el.id
  if (key && ins[key]) ins[key](el)
}
document.addEventListener('input', onInput)
document.addEventListener('change', onInput)

// ---------- таймер отдыха и часы тренировки ----------
// Звуковой сигнал: три коротких бипа (AudioContext создаётся при первом касании — иначе WebView его не разрешит)
let audio
const unlockAudio = () => {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch { /* нет звука */ }
}
document.addEventListener('pointerdown', unlockAudio, { passive: true })
function beep() {
  try {
    unlockAudio()
    if (!audio) return
    for (let i = 0; i < 3; i++) {
      const t0 = audio.currentTime + i * 0.32
      const o = audio.createOscillator()
      const g = audio.createGain()
      o.type = 'sine'
      o.frequency.value = i === 2 ? 1175 : 880
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24)
      o.connect(g).connect(audio.destination)
      o.start(t0)
      o.stop(t0 + 0.26)
    }
  } catch { /* нет звука */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ctx.rest && state.active) scheduleRest(ctx.rest.end - Date.now())
  else cancelRest()
})

function updateRest() {
  let bar = document.getElementById('rest')
  const r = ctx.rest
  if (!r || !state.active) { bar?.remove(); return }
  const left = Math.ceil((r.end - Date.now()) / 1000)
  if (left <= 0) {
    ctx.rest = null
    bar?.remove()
    try { navigator.vibrate?.([300, 120, 300, 120, 500]) } catch { /* нет вибрации */ }
    beep()
    cancelRest()
    toast('Отдых закончен — следующий подход')
    return
  }
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'rest'
    bar.innerHTML = tr('<span class="rt-l">Отдых</span><b id="rest-t"></b><button data-a="restAdd">+15с</button><button data-a="restSkip">Пропустить</button>')
    document.body.appendChild(bar)
  }
  document.getElementById('rest-t').textContent = fmtTime(left)
}
acts.restAdd = () => { if (ctx.rest) { ctx.rest.end += 15000; updateRest() } }
acts.restSkip = () => { ctx.rest = null; cancelRest(); updateRest() }

setInterval(() => {
  updateRest()
  const t = document.getElementById('wk-time')
  if (t && state.active) t.textContent = fmtTime((Date.now() - state.active.start) / 1000)
}, 500)

if (!state.lang) { state.lang = detectLang(); save() }
document.documentElement.lang = ({ ru: 'ru', uz: 'uz-Cyrl', uzl: 'uz-Latn', en: 'en' })[state.lang] || 'ru'
render()
startStepSync()
webStepsResume()
syncWidget()
// «Есть обновление»: проверяем при запуске и при возврате в приложение (не чаще раза в 30 минут)
const checkNew = async () => { const had = !!updateInfo(); await checkUpdate(); if (!had && updateInfo()) render() }
checkNew()
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNew() })
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncWidget() })
window.addEventListener('focus', () => syncWidget())
// Напоминания (сон, вода): при первом запуске после обновления просим разрешение, затем пересоздаём расписание
;(async () => {
  if (!state.profile) return
  if (!state.notifAsked) { state.notifAsked = true; save(); await ensurePermission() }
  await syncReminders()
})()
