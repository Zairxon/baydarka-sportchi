import { Capacitor, registerPlugin } from './cap-shim.js'
import { state, today, diffDays } from './store.js'
import { tt } from './i18n/core.js'

// Локальные уведомления (плагин @capacitor/local-notifications). В браузере не работают.
let plugin
const P = () => (plugin ??= registerPlugin('LocalNotifications'))
export const canNotify = () => !!(P() && Capacitor.isNativePlatform())

const SLEEP_IDS = [101, 102, 103, ...Array.from({ length: 7 }, (_, i) => 450 + i)]
const WATER_IDS = Array.from({ length: 14 }, (_, i) => 201 + i)
const MEAL_IDS = [400, 401, 402, ...Array.from({ length: 21 }, (_, i) => 420 + i)]
const BACKUP_ID = 410

let voicePlugin
const V = () => (voicePlugin ??= registerPlugin('Voice'))

// Каналы уведомлений: со звуком-колокольчиком (res/raw/chime.wav) и тихий. Звук задаётся каналом, поэтому нужны оба
const CH_SOUND = 'torso_chime'
const CH_QUIET = 'torso_quiet'
async function ensureChannels() {
  try {
    await P().createChannel({ id: CH_SOUND, name: 'Напоминания (со звуком)', description: 'Вода, сон, еда, отдых между подходами', importance: 4, sound: 'chime.wav', vibration: true })
    await P().createChannel({ id: CH_QUIET, name: 'Напоминания (без звука)', description: 'Тихие напоминания', importance: 2, vibration: false })
  } catch { /* каналы есть только на Android 8+ */ }
}
const channel = () => (state.voiceCfg?.on === false ? CH_QUIET : CH_SOUND)

export async function ensurePermission() {
  if (!canNotify()) return false
  try {
    let s = await P().checkPermissions()
    if (s.display !== 'granted') s = await P().requestPermissions()
    await ensureChannels()
    return s.display === 'granted'
  } catch { return false }
}

export const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const at = min => { const m = ((min % 1440) + 1440) % 1440; return { hour: Math.floor(m / 60), minute: m % 60 } }

// Окно питья воды: от пробуждения +1 ч до «отхода ко сну −2 ч» (много воды перед сном — ночью придётся вставать)
export function waterSlots() {
  const c = state.sleepCfg
  const w = state.waterCfg
  if (!w.every) return []
  const wake = toMin(c.wake)
  const span = (toMin(c.bed) - wake + 1440) % 1440
  const slots = []
  for (let off = 60; off <= span - 120 && slots.length < WATER_IDS.length; off += w.every * 60) slots.push((wake + off) % 1440)
  return slots
}

// Пересоздаёт все напоминания по текущим настройкам (старые отменяются)
export async function syncReminders() {
  if (!canNotify()) return
  const p = P()
  try { await p.cancel({ notifications: [...SLEEP_IDS, ...WATER_IDS, ...MEAL_IDS, BACKUP_ID].map(id => ({ id })) }) } catch { /* нет запланированных */ }
  await ensureChannels()
  const c = state.sleepCfg
  const list = []
  const daily = (id, min, title, body) => list.push({ id, title: tt(title), body: tt(body), channelId: channel(), schedule: { on: at(min), allowWhileIdle: true } })
  if (c.remind) {
    const bed = toMin(c.bed)
    daily(101, bed - (c.lead || 30), '🌙 Скоро время сна', `Через ${c.lead || 30} минут пора спать. Отложите телефон: цель — ${c.need} ч сна для восстановления мышц.`)
    daily(102, bed, '😴 Пора спать', 'Сон — часть тренировки: мышцы растут во время восстановления.')
  }
  if (c.nap) {
    // Разовые на 7 дней: сегодняшнее пропускаем, если дневной сон уже был или идёт
    const napToday = (state.sleep || []).some(e => e.nap && e.s.slice(0, 10) === today()) || !!state.sleepNow?.nap
    const m = toMin(c.napTime)
    for (let day = 0; day < 7; day++) {
      if (day === 0 && napToday) continue
      const when = new Date()
      when.setDate(when.getDate() + day)
      when.setHours(Math.floor(m / 60), m % 60, 0, 0)
      if (when.getTime() <= Date.now() + 5000) continue
      list.push({ id: 450 + day, title: tt('💤 Время дневного сна'), body: tt('Лучше 20–30 минут: так меньше шанс проснуться разбитым.'), channelId: channel(), schedule: { at: when, allowWhileIdle: true } })
    }
  }
  waterSlots().forEach((min, i) => daily(201 + i, min, '💧 Выпейте воды', 'Стакан воды (200–300 мл). В день тренировки нормы выше — смотрите карточку «Вода».'))
  const vc = state.voiceCfg
  if (vc?.meals) {
    // Не повторяющиеся, а разовые на 7 дней вперёд: если приём пищи на сегодня уже записан, сегодняшнее напоминание пропускается
    const meals = [['b', vc.breakfast || '08:30', 'завтрак'], ['l', vc.lunch, 'обед'], ['d', vc.dinner, 'ужин']]
    const logged = new Set((state.food?.[today()] || []).map(e => e.meal))
    const now = Date.now()
    for (let day = 0; day < 7; day++) {
      meals.forEach(([key, hhmm, name], i) => {
        if (day === 0 && logged.has(key)) return
        const m = toMin(hhmm)
        const when = new Date()
        when.setDate(when.getDate() + day)
        when.setHours(Math.floor(m / 60), m % 60, 0, 0)
        if (when.getTime() <= now + 5000) return
        list.push({ id: 420 + day * 3 + i, title: tt('🍽 Что вы ели на ' + name + '?'), body: tt('Запишите блюда в приложении — я посчитаю калории.'), channelId: channel(), schedule: { at: when, allowWhileIdle: true } })
      })
    }
  }
  // раз в неделю (воскресенье, 11:00), пока копии не было больше недели
  if (!state.lastBackup || diffDays(today(), state.lastBackup) >= 7) list.push({ id: BACKUP_ID, title: tt('💾 Сделайте копию данных'), body: tt('Профиль → Данные → «Скопировать копию». Так вы не потеряете историю при смене телефона.'), channelId: CH_QUIET, schedule: { on: { weekday: 1, hour: 11, minute: 0 }, allowWhileIdle: true } })
  if (list.length) { try { await p.schedule({ notifications: list }) } catch { /* нет разрешения */ } }
  await clearVoice()
}

// Раньше напоминания озвучивались голосом — теперь только звук-колокольчик. Снимаем старые голосовые будильники.
async function clearVoice() {
  try { await V().schedule({ items: [] }) } catch { /* плагин недоступен */ }
}

// Проверка звука: через 2 секунды приходит тестовое уведомление
export async function testSound() {
  if (!canNotify()) return false
  try {
    await ensureChannels()
    await P().schedule({ notifications: [{ id: 999, title: tt('🔔 Проверка звука'), body: tt('Так звучат напоминания'), channelId: channel(), schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true } }] })
    return true
  } catch { return false }
}

// Сигнал об окончании отдыха, когда приложение свёрнуто (в открытом приложении звучит бип и вибрация)
export async function scheduleRest(ms) {
  if (!canNotify() || ms < 1000) return
  try {
    await P().cancel({ notifications: [{ id: 300 }] })
    await P().schedule({ notifications: [{ id: 300, title: tt('⏱ Отдых закончен'), body: tt('Пора на следующий подход'), channelId: channel(), schedule: { at: new Date(Date.now() + ms), allowWhileIdle: true } }] })
  } catch { /* нет разрешения */ }
}
export async function cancelRest() {
  if (!canNotify()) return
  try { await P().cancel({ notifications: [{ id: 300 }] }) } catch { /* нечего отменять */ }
}
