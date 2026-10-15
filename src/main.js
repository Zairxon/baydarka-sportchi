import './style.css'
import { S, sessionExercises, saveSettings, saveExtras, myBoat } from './state.js'
import { store } from './store.js'
import { apiLogin, sync, queue } from './api.js'
import { isoDate, addDays, formatDuration, esc } from './util.js'
import { toast, closeSheet, applyTheme, flipTheme } from './ui.js'
import { tr, tt, setLang } from './i18n.js'
import { mountFooter, draw as drawFooter } from './footer.js'
import { bindRestBar } from './flows.js'
import { cardAction, onInput, addExtra } from './cards.js'
import { boatPickHtml, langSheet, heroHtml, loginHtml, tabsHtml, todayHtml, deptHtml, sessionHtml, statsHtml, pickerSheet, finishSheet, finishDone, profileSheet, kindOfSession, gymKcal } from './views.js'

applyTheme()
S.starts = store.get('starts', {})
const $ = id => document.getElementById(id)
let loginErr = '', loginBusy = false

function render() {
  const y = window.scrollY
  $('hero').innerHTML = tr(heroHtml())
  if (!S.auth || !S.me) { $('app').innerHTML = tr(loginHtml(loginErr, loginBusy)); drawFooter(); return }
  if (!myBoat()) { $('app').innerHTML = tr(boatPickHtml()); drawFooter(); return }   // сначала лодка
  let body
  if (S.open && S.plan.sessions.some(s => s.id === S.open)) body = sessionHtml()
  else {
    S.open = null
    body = tabsHtml() + (S.tab === 'today' ? todayHtml() : S.tab === 'stats' ? statsHtml() : deptHtml(S.tab))
  }
  $('app').innerHTML = tr(body)
  drawFooter()
  window.scrollTo(0, y)
}
S.render = render

const currentSession = () => S.plan.sessions.find(s => s.id === S.open)
const ctx = () => { const s = currentSession(); const k = { ...s, kind: kindOfSession(s) }; return { session: k, exercises: sessionExercises(k) } }

// ---------- синхронизация ----------
async function doSync(quiet = true) {
  if (!S.auth) return
  try {
    S.plan = await sync(S.auth)
    S.online = true
  } catch (e) {
    S.online = false
    if (e.status === 400 && /forbidden/.test(e.message)) return logout()   // логин или пароль сменили
  }
  const a = document.activeElement
  if (quiet && a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { $('hero').innerHTML = tr(heroHtml()); return }   // не мешаем вводу
  render()
}
S.afterSave = () => { doSync(false) }

function logout() {
  store.wipe()
  Object.assign(S, { auth: null, me: null, open: null, drafts: {}, extras: {}, history: [], fatigue: null })
  S.plan = { sessions: [], logs: [], feedback: [], age: null, boat: null }
  render()
}

// ---------- события ----------
document.addEventListener('click', async e => {
  if (e.target.classList?.contains('sheet') || (e.target.closest('[data-close]') && !e.target.closest('[data-act]'))) { closeSheet(); return }
  const el = e.target.closest('[data-act]')
  if (!el) return
  const act = el.dataset.act

  if (act === 'login') {
    const l = $('lg-l').value.trim(), p = $('lg-p').value
    if (!l || !p) return
    loginBusy = true; loginErr = ''; render()
    try {
      const me = await apiLogin(l, p)
      S.auth = { login: l, password: p }; S.me = me
      store.set('auth', S.auth); store.set('me', me)
      loginBusy = false
      await doSync(false)
    } catch (ex) {
      loginBusy = false
      loginErr = ex.status >= 400 && ex.status < 500 ? "Login yoki parol noto'g'ri. Murabbiydan so'rang." : "Internetga ulanib bo'lmadi. Qayta urinib ko'ring."
      render()
    }
    return
  }
  if (act === 'setboat') { S.settings.boat = el.dataset.b; saveSettings(); return render() }
  if (act === 'theme') return flipTheme()
  if (act === 'lang') return langSheet()
  if (act === 'setlang') { setLang(el.dataset.l); closeSheet(); return render() }
  if (act === 'install') { await S.installEvent?.prompt(); S.installEvent = null; S.canInstall = false; return render() }
  if (act === 'tab') { S.tab = el.dataset.tab; S.open = null; return render() }
  if (act === 'day') { S.day = addDays(S.day || isoDate(), Number(el.dataset.d)); return render() }
  if (act === 'open') {
    S.open = el.dataset.id; S.history = []; S.fatigue = null
    if (!S.starts[S.open]) { S.starts[S.open] = Date.now(); store.set('starts', S.starts) }
    history.pushState({ s: 1 }, '')
    render(); window.scrollTo(0, 0); return
  }
  if (act === 'back') { if (history.state?.s) history.back(); else { S.open = null; render() } return }
  if (act === 'profile') return profileSheet()
  if (act === 'logout') { if (confirm(tt('Chiqishni xohlaysizmi?'))) { closeSheet(); logout() } return }
  if (act === 'pfboat') { S.settings.boat = el.dataset.b; saveSettings(); profileSheet(); return render() }

  // каталог упражнений
  if (act === 'picker') { S.pickQ = ''; S.pickG = ''; return pickerSheet(ctx().session.kind) }
  if (act === 'pkg') { S.pickG = el.dataset.g; return pickerSheet(ctx().session.kind) }
  if (act === 'pickadd') { addExtra(ctx().session, el.dataset.id); saveExtras(); closeSheet(); toast('Mashq qo\'shildi'); return render() }

  // оценка занятия
  if (act === 'finish') {
    const s = ctx().session
    const fb = S.plan.feedback.find(f => f.session_id === s.id)
    const start = S.starts[s.id], mins = start ? Math.round((Date.now() - start) / 60000) : null
    S.fv = fb ? { rpe: fb.rpe, minutes: fb.minutes, mood: fb.mood, fatigue: fb.fatigue, soreness: fb.soreness, note: fb.note }
      : { rpe: null, minutes: mins > 0 && mins < 300 ? mins : s.planned_minutes || '', mood: null, fatigue: null, soreness: null, note: '' }
    return finishSheet(s, S.fv)
  }
  if (act === 'fv') { S.fv.minutes = $('fv-min')?.value ?? S.fv.minutes; S.fv.note = $('fv-note')?.value ?? S.fv.note; S.fv[el.dataset.k] = Number(el.dataset.v); return finishSheet(ctx().session, S.fv) }
  if (act === 'fsend') {
    const v = S.fv; v.minutes = $('fv-min').value; v.note = $('fv-note').value
    if (!v.rpe || !v.mood || !v.fatigue || !v.soreness) { $('fv-err').textContent = 'Barcha savollarga javob bering.'; return }
    const s = ctx().session
    const row = { session_id: s.id, logged_on: s.session_date, rpe: v.rpe, minutes: Math.round(Number(v.minutes)) || null, mood: v.mood, fatigue: v.fatigue, soreness: v.soreness, note: v.note || null }
    queue.addFb(row)
    S.plan.feedback = [...S.plan.feedback.filter(f => f.session_id !== s.id), row]
    store.set('plan', S.plan)
    finishDone({ ...v, minutes: row.minutes }, S.plan.logs.filter(l => l.session_id === s.id))
    render(); doSync(true); return
  }

  // карточка упражнения
  if (S.open) {
    const r = cardAction(act, el, ctx())
    if (r === 'render') render()
  }
})

document.addEventListener('input', e => {
  const t = e.target
  if (t.dataset?.in) return onInput(t)
  if (t.id === 'pk-q') { S.pickQ = t.value; pickerSheet(ctx().session.kind) }
  if (t.id === 'pf-w') { S.settings.weight = t.value; saveSettings() }
})

document.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target.id === 'lg-l' || e.target.id === 'lg-p')) document.querySelector('[data-act="login"]')?.click() })
window.addEventListener('popstate', () => { if (S.open) { S.open = null; render() } })
window.addEventListener('online', () => doSync(true))
window.addEventListener('focus', () => doSync(true))
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvent = e; S.canInstall = true; if (!S.auth) render() })

// Время и расход тренировки в зале обновляются раз в полминуты.
setInterval(() => {
  if (!S.open) return
  const t = document.getElementById('wk-time'); if (!t) return
  t.textContent = formatDuration(Math.floor((Date.now() - (S.starts[S.open] || Date.now())) / 1000))
  const k = document.getElementById('wk-kcal'); const c = ctx()
  if (k) k.textContent = Math.round(gymKcal(c.session, c.exercises))
}, 30000)

bindRestBar()
render()
mountFooter()
if (S.auth) doSync(true)
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
