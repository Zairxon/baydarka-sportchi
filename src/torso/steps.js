import { Capacitor, registerPlugin } from './cap-shim.js'
import { state, save, today, fmt } from './store.js'
import { ctx } from './ui.js'

// Нативный StepCounterService постоянно держит аппаратный счётчик зарегистрированным в фоне.
// Плагин Steps возвращает журнал замеров; дневные значения восстанавливаются по разнице показаний.
let plugin
const P = () => (plugin ??= registerPlugin('Steps'))

export const stepsInfo = { status: 'unknown', samples: 0, last: null, sensorPresent: null, tracking: false } // unknown | ok | denied | nosensor | stalled | error | web

const DAY = 86400000

function parseSamples(str) {
  return (str || '').split(';').filter(Boolean).map(x => {
    const [t, c, b] = x.split(',').map(Number)
    return { t, c, b }
  }).filter(s => Number.isFinite(s.t) && Number.isFinite(s.c))
}

// Шаги по дням из журнала. Между двумя замерами шаги распределяются по времени равномерно;
// если телефон перезагружался (счётчик обнулился), берётся значение счётчика после перезагрузки.
export function stepsByDay(samples) {
  const out = {}
  if (!samples.length) return out
  const pts = [...samples]
  const f = pts[0]
  // телефон включали недавно — до первого замера счётчик шёл с нуля с момента загрузки
  if (f.b && f.b < f.t && f.t - f.b < 4 * DAY) pts.unshift({ t: f.b, c: 0, b: f.b })
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (b.t <= a.t) continue
    const sameBoot = !a.b || !b.b || Math.abs(a.b - b.b) < 120000
    const delta = sameBoot && b.c >= a.c ? b.c - a.c : b.c
    if (delta <= 0) continue
    let t0 = a.t
    while (t0 < b.t) {
      const d = new Date(t0)
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      const t1 = Math.min(next, b.t)
      const key = fmt(d)
      out[key] = (out[key] || 0) + (delta * (t1 - t0)) / (b.t - a.t)
      t0 = t1
    }
  }
  return out
}

// Браузерный шагомер: считает по датчику движения, только пока приложение открыто (в фоне браузер датчик отключает).
let webOn = false, wBase = null, wLast = 0, wBuf = 0
export const webStepsOn = () => webOn
function onMotion(e) {
  const a = e.accelerationIncludingGravity
  if (!a) return
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0)
  wBase = wBase == null ? m : wBase * 0.9 + m * 0.1
  const t = Date.now()
  if (m - wBase > 1.6 && t - wLast > 330) {
    wLast = t
    state.steps[today()] = (state.steps[today()] || 0) + 1
    if (++wBuf >= 15) { wBuf = 0; save() }
  }
}
export async function webStepsToggle(force) {
  if (Capacitor.isNativePlatform()) return false
  const want = force ?? !webOn
  if (want === webOn) return webOn
  if (want) {
    if (typeof DeviceMotionEvent === 'undefined') return false
    if (DeviceMotionEvent.requestPermission) { try { if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return false } catch { return false } }
    window.addEventListener('devicemotion', onMotion)
    webOn = true
  } else {
    window.removeEventListener('devicemotion', onMotion)
    webOn = false
    save()
  }
  state.webSteps = webOn
  save()
  return webOn
}
export function webStepsResume() { if (state.webSteps && !Capacitor.isNativePlatform()) webStepsToggle(true) }

export async function syncSteps() {
  const p = P()
  if (!p || !Capacitor.isNativePlatform()) { stepsInfo.status = 'web'; return false }
  let r
  try { r = await p.sync() } catch { stepsInfo.status = 'error'; return false }
  const samples = parseSamples(r.samples)
  stepsInfo.samples = samples.length
  stepsInfo.sensorPresent = r.sensorPresent ?? null
  stepsInfo.tracking = Boolean(r.tracking)
  stepsInfo.last = samples.length ? samples[samples.length - 1].t : null
  stepsInfo.status = r.available ? 'ok' : r.denied ? 'denied' : r.sensorPresent === false ? 'nosensor' : 'stalled'
  state.stepsManual = {}
  let changed = false
  for (const [d, v] of Object.entries(stepsByDay(samples))) {
    const n = Math.round(v)
    // Сегодня берём значение с датчика: ручной ввод не должен блокировать обновление.
    // Для прошлых дней сохраняем большую из имеющихся оценок.
    const next = d === today() ? n : Math.max(n, state.steps[d] || 0)
    if (next !== (state.steps[d] || 0)) { state.steps[d] = next; changed = true }
  }
  save()
  return changed
}

export async function openStepSettings() {
  try { await P()?.openSettings?.() } catch { /* доступ к настройкам недоступен */ }
}

export function startStepSync() {
  let last = ''
  const tick = async () => {
    const changed = await syncSteps()
    const st = stepsInfo.status
    const statusChanged = st !== last
    last = st
    const busy = document.activeElement?.tagName === 'INPUT' || document.getElementById('sheet')?.classList.contains('open')
    if ((changed || statusChanged) && ctx.tab === 'today' && !busy && !ctx.tsub) ctx.render()
  }
  tick()
  // Не опрашиваем счётчик каждые 30 секунд: слишком частые замеры засоряли журнал и теряли накопленные шаги.
  // Служба сохраняет показания каждые 5 минут; эта синхронизация обновляет экран и запрашивает разрешение.
  setInterval(tick, 15 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() })
}
