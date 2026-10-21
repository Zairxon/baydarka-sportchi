import { state, today, addDays } from './store.js'
import { sumFood, dayBurn } from './calc.js'
import { totalFor } from './views/sleep.js'
import { store as appStore } from '../store.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

// Отправка данных «Здоровья» тренеру: вес, замеры, шаги, питание, вода, сон по дням (последние 14 дней).
// Логин и пароль — те же, что у приложения спортсмена (хранятся в bs2_auth). Без сети — повторится при следующем сохранении.
let timer = null
let lastSent = ''

function rowFor(day) {
  const food = sumFood(day)
  const burn = dayBurn(day)
  const sleep = totalFor(day)
  const m = state.meas.find(x => x.date === day)
  const meas = m ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'date')) : null
  const row = {
    day,
    weight: state.weights[day] ?? null,
    steps: state.steps[day] || null,
    kcal_in: food.kcal ? Math.round(food.kcal) : null,
    kcal_out: burn.total ? Math.round(burn.total) : null,
    water_ml: state.water[day] ? Math.round(state.water[day]) : null,
    sleep_min: sleep.total ? Math.round(sleep.total) : null,
    meas,
    goal: state.profile?.goal || null,
  }
  const any = row.weight != null || row.steps || row.kcal_in || row.water_ml || row.sleep_min || row.meas
  return any ? row : null
}

export async function pushHealth() {
  const auth = appStore.get('auth')
  if (!auth?.login || !auth?.password || !state.profile) return false
  const rows = []
  for (let i = 0; i < 14; i++) { const r = rowFor(addDays(today(), -i)); if (r) rows.push(r) }
  if (!rows.length) return false
  const body = JSON.stringify({ p_login: auth.login, p_password: auth.password, p_rows: rows })
  if (body === lastSent) return true
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/athlete_submit_health`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body,
    })
    if (res.ok) { lastSent = body; return true }
  } catch { /* нет сети — отправим при следующем сохранении */ }
  return false
}

export function scheduleHealthPush() {
  clearTimeout(timer)
  timer = setTimeout(pushHealth, 4000)
}

export function startHealthSync() {
  scheduleHealthPush()
  document.addEventListener('visibilitychange', () => { if (document.hidden) pushHealth() })
  setInterval(pushHealth, 5 * 60 * 1000)
}
