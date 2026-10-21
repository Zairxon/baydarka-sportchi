import { Capacitor, registerPlugin } from './cap-shim.js'
import { state, save, fmt } from './store.js'
import { ctx } from './ui.js'
import { tt, getLang } from './i18n/core.js'
import { foodWaterMl, waterTarget } from './calc.js'
import { applySleepEvent, totalFor } from './views/sleep.js'

// Виджет главного экрана (вода и сон). Нажатия на виджете складываются в очередь, приложение забирает её при открытии.
let plugin
const W = () => (plugin ??= registerPlugin('Widget'))
const native = () => Capacitor.isNativePlatform()

// Применяет события с виджета к данным; возвращает true, если что-то изменилось
export async function pullWidget() {
  if (!native()) return false
  let r
  try { r = await W().pull() } catch { return false }
  const events = (r?.events || []).sort((a, b) => a.t - b.t)
  for (const e of events) {
    if (e.type === 'water') {
      const d = fmt(new Date(e.t))
      state.water[d] = (state.water[d] || 0) + (Number(e.ml) || 0)
    } else if (e.type === 'sleep') applySleepEvent(e.kind, e.t)
  }
  if (events.length) save()
  return events.length > 0
}

let last = ''
// Отправляет виджету свежие данные дня (вода: напитки и вода из еды, цель, сон)
export function pushWidget() {
  if (!native() || !state.profile) return
  const d = fmt(new Date())
  const snap = {
    date: d,
    waterMl: state.water[d] || 0,
    foodMl: foodWaterMl(d),
    goalMl: waterTarget(d).total,
    sleeping: !!state.sleepNow,
    sleepSince: state.sleepNow ? state.sleepNow.s.slice(11) : '',
    sleepTodayMin: totalFor(d).total,
    sleepGoalMin: Math.round((state.sleepCfg?.need || 8) * 60),
    labels: {
      dec: getLang() === 'en' ? '.' : ',',
      title: tt('💧 Вода'),
      unit: tt('л'),
      sleeping: tt('🌙 Сон с'),
      idle: tt('🌙 Сон не идёт'),
      start: tt('😴 Лёг спать'),
      stop: tt('☀️ Проснулся'),
      hintWater: tt('+50 мл'),
      hintSleep: tt('Сон'),
      toastWater: tt('+50 мл воды'),
      toastSleep: tt('😴 Спокойной ночи — сон записан'),
      toastWake: tt('☀️ С добрым утром — сон записан'),
    },
  }
  const s = JSON.stringify(snap)
  if (s === last) return
  last = s
  W().push(snap).catch(() => { last = '' })
}

// Забрать события, перерисовать экран и обновить виджет
export async function syncWidget() {
  if (!native()) return
  if (await pullWidget()) ctx.render()
  else pushWidget()
}
