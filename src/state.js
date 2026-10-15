import { store } from './store.js'
import { EMPTY_PLAN, queue } from './api.js'
import catalog from './catalog.json'

// Общее состояние приложения. Экран перерисовывается через S.render().
export const S = {
  auth: store.get('auth'),
  me: store.get('me'),
  plan: { ...EMPTY_PLAN, ...store.get('plan', {}) },
  settings: store.get('set', { weight: '', boat: '' }),
  drafts: store.get('dr', {}),
  extras: store.get('extra', {}),
  tab: 'today',
  day: null,
  open: null,
  online: null,
  pickQ: '',
  pickG: '',
  history: [],       // оценки восстановления по упражнениям открытого занятия
  render: () => {},
}

export const saveDrafts = () => store.set('dr', S.drafts)
export const saveExtras = () => store.set('extra', S.extras)
export const saveSettings = () => store.set('set', S.settings)

export const CAT = catalog
export const catById = new Map(catalog.map(e => [e.id, e]))
export const groupOf = id => catById.get(id)?.group || null

// Отделы тренировок.
export const KINDS = {
  water: { icon: '🛶', name: 'Suv kuni', short: 'Suv', text: "Suvda eshish: otrezoklar va vaqt" },
  gym: { icon: '🏋️', name: 'Zal kuni', short: 'Zal', text: "Trenajyor zali: kuch mashqlari, og'irlik va takror" },
  land: { icon: '🧍', name: 'Quruqlikda imitatsiya', short: 'Quruqlik', text: "Havoda eshkak eshish, trenajyor, kanal ustida" },
  ofp: { icon: '🤸', name: 'OFP kuni', short: 'OFP', text: "Umumiy jismoniy tayyorgarlik" },
  game: { icon: '⚽', name: "O'yin kuni", short: "O'yin", text: "Futbol va harakatli o'yinlar" },
}

export const lastLogFor = sx => S.plan.logs.find(l => l.session_exercise_id === sx)

// Упражнения-близнецы: для байдарки и для каноэ. Тренер ставит любое из пары, а спортсмен видит своё:
// байдарочнику — «байдарка», каноисту — «каноэ». Запись результата идёт на упражнение, которое задал тренер.
const PAIRS = { T_land_kayak: ['T_land_canoe', 'kayak'], T_land_canoe: ['T_land_kayak', 'canoe'], M01: ['M02', 'kayak'], M02: ['M01', 'canoe'] }
const catByCode = new Map(catalog.map(e => [e.code, e]))
export const myBoat = () => S.me?.boat || S.plan.boat || S.settings.boat || ''

export function adaptExercise(x) {
  const boat = myBoat()
  const c = catById.get(x.ex)
  const pair = c && PAIRS[c.code]
  if (!boat || !pair) return x
  const [partnerCode, variantOf] = pair
  if (variantOf === boat) return x            // это уже вариант под мою лодку
  const partner = catByCode.get(partnerCode)
  return partner ? { ...x, dispEx: partner.id, name: partner.name, info: partner.info || x.info } : x
}

// Упражнения занятия: план тренера + добавленные спортсменом (зал, ОФП) + записи, которых нет в плане.
export function sessionExercises(s) {
  const base = [...(s.exercises || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  const have = new Set(base.map(x => x.sx))
  const extra = (S.extras[s.id] || []).filter(x => !have.has(x.sx))
  extra.forEach(x => have.add(x.sx))
  const fromLogs = []
  for (const l of S.plan.logs) {
    if (l.session_id !== s.id || !l.session_exercise_id || have.has(l.session_exercise_id)) continue
    const c = catById.get(l.exercise_id)
    if (!c) continue
    have.add(l.session_exercise_id)
    fromLogs.push(makeExtra(c, l.session_exercise_id, l.set_no))
  }
  return [...base, ...extra, ...fromLogs].map(adaptExercise)
}

// Упражнение из каталога в виде элемента плана.
export function makeExtra(c, sx, setNo = 1) {
  return { sx, ex: c.id, name: c.name, mode: c.mode, plan: {}, rest: c.rest || 90, muscles: c.cat, count: c.count, info: c.info, prescription: '', set_no: setNo, of: 1, extra: true }
}

export const pendingCount = () => queue.count()
