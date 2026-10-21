const KEY = 'forma_v1'

const z = n => String(n).padStart(2, '0')
export const fmt = d => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
export const today = () => fmt(new Date())
export const addDays = (ds, n) => {
  const [y, m, d] = ds.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + n))
}
export const diffDays = (a, b) => {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((p(a) - p(b)) / 86400000)
}
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

const defaults = () => ({
  profile: null,
  lastBackup: null,
  weights: {},
  steps: {},
  water: {},
  customEx: [],
  supp: { on: [], taken: {} },
  ai: { key: '' },
  hiddenFoods: [],
  stepsManual: {},
  sleep: [],
  sleepNow: null,
  sleepCfg: { bed: '23:00', wake: '07:00', need: 8, remind: true, lead: 30, nap: false, napTime: '14:00' },
  waterCfg: { every: 2 },
  voiceCfg: { on: true, water: true, meals: true, breakfast: '08:30', lunch: '13:30', dinner: '19:30' },
  notifAsked: false,
  stepBase: null,
  stepGoal: 10000,
  meas: [],
  food: {},
  customFoods: [],
  plan: null,
  workouts: [],
  active: null,
})

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && typeof s === 'object') return { ...defaults(), ...s }
  } catch { /* пустое хранилище */ }
  return defaults()
}

export let state = load()

let afterSave = null
export const onSave = f => { afterSave = f }
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* переполнено */ }
  try { afterSave?.() } catch { /* синхронизация необязательна */ }
}

export function replaceState(s) {
  state = { ...defaults(), ...s }
  save()
}

export function resetAll() {
  state = defaults()
  save()
}
