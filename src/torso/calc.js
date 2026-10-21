import { state, today, addDays, diffDays } from './store.js'
import { setKcal, WU } from './data/exercises.js'

export const ACTIVITY = [
  { v: 1.2, t: 'Сидячий образ жизни, без тренировок' },
  { v: 1.375, t: 'Немного движения + 1–3 тренировки в неделю' },
  { v: 1.55, t: 'Активный: 3–5 тренировок в неделю' },
  { v: 1.725, t: 'Очень активный: физический труд + тренировки' },
]

export const GOALS = {
  gain: { t: 'Набор мышц', pct: 0.10, d: 'Небольшой профицит калорий (+10%) — мышцы растут, жира набирается минимум' },
  maintain: { t: 'Рекомпозиция / удержание', pct: 0, d: 'Калории на уровне расхода: подходит новичкам и тем, кто хочет «подсушиться» и нарастить мышцы одновременно' },
  cut: { t: 'Похудение / сушка', pct: -0.2, d: 'Дефицит 20%: жир уходит, мышцы сохраняются при высоком белке и тренировках' },
  target: { t: 'Целевой вес', pct: 0, d: 'Укажите диапазон веса — приложение рассчитает калории, направление и примерный срок.' },
}

export const LEVELS = {
  beginner: 'Новичок (до 1 года)',
  mid: 'Средний (1–3 года)',
  adv: 'Опытный (3+ лет)',
}

export const bmr = p => 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161)

export function targets(p = state.profile) {
  if (!p) return null
  const w = latestWeight() || p.weight
  const pp = { ...p, weight: w }
  const tdee = bmr(pp) * p.activity
  const direction = goalDirection(p, w)
  const pace = Math.min(2, Math.max(0.1, Number(p.targetPace) || 0.5))
  const targetDelta = p.goal === 'target' ? (direction === 'cut' ? -Math.min(1000, tdee * 0.2, pace * 7700 / 7) : direction === 'gain' ? Math.min(500, pace * 7700 / 7) : 0) : tdee * GOALS[p.goal].pct
  let kcal = tdee + targetDelta + (p.kcalAdj || 0)
  kcal = Math.max(p.sex === 'm' ? 1500 : 1200, kcal)
  kcal = Math.round(kcal / 10) * 10
  const protein = Math.round(w * (direction === 'cut' ? 2.0 : 1.8))
  const fat = Math.round(Math.max(w * 0.9, (kcal * 0.2) / 9))
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { bmr: Math.round(bmr(pp)), tdee: Math.round(tdee), kcal, protein, fat, carbs, water: WATER_BASE(p.sex), goalDirection: direction }
}

export function goalDirection(p = state.profile, weight = latestWeight()) {
  if (!p) return 'maintain'
  if (p.goal !== 'target') return p.goal
  const w = Number(weight) || Number(p.weight)
  const min = Number(p.targetMin) || 80
  const max = Number(p.targetMax) || 85
  return w > max ? 'cut' : w < min ? 'gain' : 'maintain'
}

export function goalProgress(p = state.profile, weight = latestWeight()) {
  if (!p || p.goal !== 'target') return null
  const w = Number(weight) || Number(p.weight)
  const min = Number(p.targetMin) || 80
  const max = Number(p.targetMax) || 85
  const direction = goalDirection(p, w)
  if (direction === 'maintain') return { direction, min, max, weeks: 0, text: `Вы уже в целевом диапазоне ${min}–${max} кг. Теперь задача — удерживать вес и становиться сильнее.` }
  const distance = direction === 'cut' ? w - max : min - w
  const pace = Math.min(2, Math.max(0.1, Number(p.targetPace) || 0.5))
  const observed = weightRate()
  const observedInDirection = observed != null && (direction === 'cut' ? observed < -0.05 : observed > 0.05)
  const t = targets(p)
  const caloriePace = direction === 'cut' ? (t.tdee - t.kcal) * 7 / 7700 : (t.kcal - t.tdee) * 7 / 7700
  const actualPace = observedInDirection ? Math.min(1, Math.abs(observed)) : Math.min(pace, caloriePace)
  if (actualPace <= 0.05) return { direction, min, max, distance, weeks: null, text: `До диапазона ${min}–${max} кг осталось около ${distance.toFixed(1).replace('.', ',')} кг. При рассчитанной норме сейчас недостаточно дефицита или профицита для прогноза срока.` }
  const weeks = Math.ceil(distance / actualPace)
  const basis = observedInDirection ? 'по текущему темпу веса' : 'по выбранному темпу и калорийности'
  return { direction, min, max, distance, pace: actualPace, weeks, text: `До диапазона ${min}–${max} кг примерно ${distance.toFixed(1).replace('.', ',')} кг. ${basis} ориентир — около ${weeks} нед. Это приблизительный прогноз.` }
}

export function latestWeight() {
  const ds = Object.keys(state.weights).sort()
  return ds.length ? state.weights[ds[ds.length - 1]] : null
}

export const bmi = (w, h) => w / Math.pow(h / 100, 2)

export const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30))

export function sumFood(date) {
  const list = state.food[date] || []
  return list.reduce((a, e) => ({
    kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c,
  }), { kcal: 0, p: 0, f: 0, c: 0 })
}

export function movingAvg(points, win = 7) {
  return points.map((pt, i) => {
    const slice = points.slice(Math.max(0, i - win + 1), i + 1)
    return { x: pt.x, y: slice.reduce((s, q) => s + q.y, 0) / slice.length }
  })
}

// Темп изменения веса, кг/нед — линейная регрессия по последним 21 дню
export function weightRate() {
  const t = today()
  const pts = Object.entries(state.weights)
    .filter(([d]) => diffDays(t, d) <= 21 && diffDays(t, d) >= 0)
    .map(([d, w]) => ({ x: -diffDays(t, d), y: w }))
  if (pts.length < 5) return null
  const span = Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x))
  if (span < 10) return null
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  return den ? (num / den) * 7 : null
}

export function trendAdvice() {
  const p = state.profile
  const rate = weightRate()
  if (!p || rate == null) return null
  const w = latestWeight() || p.weight
  const goal = goalDirection(p, w)
  const pct = (rate / w) * 100
  const r = `${rate > 0 ? '+' : ''}${rate.toFixed(2)} кг/нед (${pct > 0 ? '+' : ''}${pct.toFixed(2)}% массы)`
  const lo = p.level === 'beginner' ? 0.25 : 0.1
  const hi = p.level === 'beginner' ? 0.75 : 0.5
  if (goal === 'gain') {
    if (pct < lo) return { rate, text: `Темп ${r}: вес растёт медленнее нужного. Добавьте ~150 ккал в день.`, adj: 150 }
    if (pct > hi) return { rate, text: `Темп ${r}: набор слишком быстрый — часть уйдёт в жир. Уберите ~150 ккал в день.`, adj: -150 }
    return { rate, text: `Темп ${r}: отлично, ровно то, что нужно для качественного набора. Ничего не меняйте.`, adj: 0 }
  }
  if (goal === 'cut') {
    if (pct > -0.25) return { rate, text: `Темп ${r}: вес почти не уходит. Уберите ~150 ккал или добавьте шаги/кардио.`, adj: -150 }
    if (pct < -1) return { rate, text: `Темп ${r}: слишком быстро — рискуете потерять мышцы. Добавьте ~200 ккал.`, adj: 200 }
    return { rate, text: `Темп ${r}: хороший темп похудения, мышцы сохраняются. Продолжайте.`, adj: 0 }
  }
  if (pct > 0.25) return { rate, text: `Темп ${r}: вес растёт. Если цель держать вес — уберите ~100 ккал.`, adj: -100 }
  if (pct < -0.25) return { rate, text: `Темп ${r}: вес падает. Если цель держать вес — добавьте ~100 ккал.`, adj: 100 }
  return { rate, text: `Темп ${r}: вес стабилен, как и задумано.`, adj: 0 }
}

// Оценка питания за день: что хорошо, чего не хватает
export function dayVerdict(date) {
  const t = targets()
  const s = sumFood(date)
  if (!t) return null
  if (!(state.food[date] || []).length) return { level: 'idle', text: 'Добавьте, что вы съели — я посчитаю калории и подскажу, что ещё нужно.' }
  const left = t.kcal - s.kcal
  const notes = []
  let level = 'ok'
  const kp = s.kcal / t.kcal
  if (kp > 1.1) { level = 'warn'; notes.push(`Калорий на ${Math.round(s.kcal - t.kcal)} больше нормы.`) }
  else if (kp >= 0.9) notes.push('Калории в норме.')
  else notes.push(`Осталось ${Math.round(left)} ккал — можно ещё поесть.`)
  const pp = s.p / t.protein
  if (pp < 0.8) { if (level === 'ok') level = 'info'; notes.push(`Белка мало: ${Math.round(s.p)} из ${t.protein} г — добавьте ещё ${Math.round(t.protein - s.p)} г.`) }
  else if (pp >= 0.95) notes.push('Белок набран — хорошо для роста мышц.')
  if (s.kcal > 800) {
    const fp = (s.f * 9) / s.kcal
    if (fp > 0.42) { level = 'warn'; notes.push('Много жиров (' + Math.round(fp * 100) + '% калорий) — часть заменяйте углеводами и белком.') }
    else if (fp < 0.18) notes.push('Жиров маловато (' + Math.round(fp * 100) + '%) — добавьте орехи, масло, рыбу или яйца.')
  }
  // Что лучше не есть до конца дня — по тому, какой лимит уже выбран
  const avoid = []
  const list = state.food[date] || []
  const top = (key, unit, n = 2) => list.filter(e => e[key] >= 5).sort((a, b) => b[key] - a[key]).slice(0, n).map(e => `${e.name.replace(/ \(ИИ\)$/, '')} (${Math.round(e[key])} ${unit})`).join(', ')
  if (s.f >= t.fat * 0.85) {
    const over = s.f > t.fat * 1.05
    if (over) level = 'warn'; else if (level === 'ok') level = 'info'
    const src = top('f', 'г жира')
    avoid.push({ t: over ? `Жиры превышены: ${Math.round(s.f)} из ${t.fat} г` : `Жиры почти исчерпаны: ${Math.round(s.f)} из ${t.fat} г`, x: `Сегодня больше не едим: жареное и фастфуд, майонез и сливочное масло, колбасы и сало, жирные сыры и сметану, выпечку и шоколад, орехи. Выбирайте варёное, запечённое, нежирный белок и овощи.${src ? ' Больше всего жира дали: ' + src + '.' : ''}` })
  }
  if (s.c >= t.carbs * 1.05) {
    if (level === 'ok') level = 'info'
    const src = top('c', 'г углеводов')
    avoid.push({ t: `Углеводов больше нормы: ${Math.round(s.c)} из ${t.carbs} г`, x: `Сегодня больше не едим: сахар, сладости и выпечку, газировку и соки, белый хлеб и лепёшки, макароны, картофель фри. Если голодны — белок (творог, яйца, курица, рыба) и овощи.${src ? ' Больше всего углеводов дали: ' + src + '.' : ''}` })
  }
  if (kp > 1.1) avoid.push({ t: 'Калории выше нормы', x: 'До конца дня — без перекусов и сладкого, вечером только белок и овощи. Один день с избытком погоды не делает, главное — не добавлять «зато завтра доем».' })
  else if (kp > 0.9 && s.kcal > 0) avoid.push({ t: 'Норма калорий почти набрана', x: 'Остался небольшой запас — без десертов и жирных соусов, лучше стакан кефира, творог или овощи.' })
  return { level, text: notes.join(' '), avoid }
}

export function weekAvgKcal(endDate = today()) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(endDate, -i)
    if ((state.food[d] || []).length) days.push(sumFood(d).kcal)
  }
  return days.length ? days.reduce((a, b) => a + b, 0) / days.length : null
}

// ---------- ходьба и расход энергии ----------

export function bodyWeight() {
  return latestWeight() || state.profile?.weight || 70
}

export const strideM = () => {
  const p = state.profile
  return ((p?.height || 175) * (p?.sex === 'f' ? 0.413 : 0.415)) / 100
}
export const stepsKm = steps => (steps * strideM()) / 1000
// Чистый расход на ходьбу ≈ 0,57 ккал на кг веса на 1 км (сверх покоя)
export const walkKcal = steps => stepsKm(steps) * 0.57 * bodyWeight()
// Средний темп ходьбы ≈ 100 шагов в минуту
export const walkMin = steps => Math.round(steps / 100)

// Расход на тренировку сверх покоя: каждое упражнение по уровню нагрузки (MET), плюс разминка/кардио по своим MET
export function workoutKcal(w) {
  const wt = bodyWeight()
  const lift = (w.ex || []).reduce((s, e) => s + e.sets.length * setKcal(e.id, wt), 0)
  const warm = (w.warm || []).reduce((s, x) => s + (((WU[x.id]?.met || 5) - 1) * wt * x.min) / 60, 0)
  // Нижняя граница по времени: подходы могли быть записаны не все (силовая тренировка, 3,5 MET, Compendium 2011)
  const byTime = w.dur > 0 ? (2.5 * wt * Math.min(w.dur, 4 * 3600)) / 3600 : 0
  return Math.max(lift + warm, byTime)
}

export function dayBurn(date) {
  const steps = state.steps[date] || 0
  const walk = walkKcal(steps)
  const train = state.workouts.filter(w => w.date === date).reduce((a, w) => a + workoutKcal(w), 0)
  return { steps, walk, train, total: walk + train, km: stepsKm(steps), min: walkMin(steps) }
}

// ---------- вода ----------
// Норма — адекватное потребление EFSA (2010): 2,5 л (муж.) / 2,0 л (жен.) ОБЩЕЙ воды: напитки (в т.ч. суп, чай, молоко) + влага в еде.
// Воду из еды приложение считает само по записям питания (foodWaterMl), поэтому пить нужно меньше нормы.
// В тренировку добавляем 0,4–0,8 л/ч по ACSM (Sawka, 2007), берём середину 0,6 л/ч.
export const WATER_BASE = sex => (sex === 'f' ? 2000 : 2500)

// Вода из еды, мл: всё, что не белки, жиры, углеводы и зола (~1,5 г/100 г), — вода. Огурец ≈ 96%, плов ≈ 60%, хлеб ≈ 38%.
// Напитки из окна «Чай, кофе…» не считаем (они уже в state.water). Записи без веса не учитываются.
export function foodWaterMl(date = today()) {
  let ml = 0
  for (const e of state.food[date] || []) {
    if (e.drink || /sмл$/.test(e.name || '')) continue
    if (!(e.g > 0)) continue
    const dry = ((e.p + e.f + e.c) / e.g) * 100
    ml += (e.g * Math.max(0, Math.min(99, 100 - dry - 1.5))) / 100
  }
  return Math.round(ml)
}
export const SWEAT_L_PER_H = 0.6

export function waterTarget(date = today()) {
  const p = state.profile
  const base = WATER_BASE(p?.sex)
  const done = state.workouts.filter(w => w.date === date)
  let extra = 0
  let note = ''
  if (done.length) {
    const hours = done.reduce((a, w) => a + (w.dur || 3600) / 3600, 0)
    extra = Math.round((Math.min(2, Math.max(0.3, hours)) * SWEAT_L_PER_H * 1000) / 50) * 50
    note = 'была тренировка'
  } else if (p && state.plan) {
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (state.plan.some(x => x.dow === dow)) {
      extra = 650 // ≈ 65–70 минут тренировки
      note = 'день тренировки по плану'
    }
  }
  const pre = Math.round(((bodyWeight() * 6) / 10)) * 10 // 5–7 мл/кг, середина 6
  return { base, extra, total: base + extra, note, pre }
}

// ---------- рекомендации по цели ----------
// Шаги: для похудения выше (дополнительный расход), для набора — умеренные, чтобы не «сжигать» профицит.
// Кардио и активность: ВОЗ (2020) — 150–300 минут умеренной активности в неделю для здоровья.
export const GOAL_INFO = {
  target: {
    title: 'Целевой вес', steps: 9000,
    plan: 'Калории и направление меняются в зависимости от текущего веса относительно вашей цели.',
    tips: ['Взвешивайтесь регулярно: приложение оценивает тренд и обновляет прогноз.', 'При снижении веса сохраняйте силовые тренировки и достаточное количество белка.', 'Изменение веса у разных людей идёт с разной скоростью; прогноз — ориентир, а не обещание.'],
  },
  cut: {
    title: 'Похудение',
    steps: 11000,
    plan: 'Тяжёлые базовые упражнения остаются, на изолирующих на 1 подход меньше. После тренировки — 20 минут быстрой ходьбы.',
    tips: [
      'Дефицит около 20% калорий и белок 2,2 г на кг веса — это главное для сохранения мышц (ISSN, 2017).',
      'Не снижайте рабочие веса: нагрузка — сигнал мышцам остаться. Объём изолирующих упражнений уменьшен, потому что в дефиците восстановление хуже.',
      'Шаги: цель 11 000 в день. Каждые +3000 шагов добавляют примерно 100–150 ккал расхода.',
      'Кардио: быстрая ходьба 20 минут после тренировки (3 раза в неделю ≈ 60 минут). ВОЗ рекомендует 150–300 минут умеренной активности в неделю — шаги тоже считаются.',
      'Темп: 0,5–1% веса в неделю. Если вес не уходит 2 недели — уберите ~150 ккал или добавьте 2000 шагов. Если уходит быстрее 1% — добавьте еды, чтобы не потерять мышцы.',
      'Сон 7–9 часов: при недосыпе теряется больше мышц и усиливается голод.',
    ],
  },
  gain: {
    title: 'Набор мышц',
    steps: 8000,
    plan: 'Полный объём подходов; основной упор на прогрессию рабочих весов. Кардио — по желанию, для здоровья.',
    tips: [
      'Небольшой профицит (+10% калорий) и белок около 2 г на кг веса. Быстрее 0,25–0,5% веса в неделю (новичку до 0,75%) — значит, лишний жир.',
      'Главный сигнал роста — прогрессия: добавляйте повторы, затем вес (приложение подсказывает).',
      'Шаги: цель 8000 в день — достаточно для здоровья, при этом не «съедает» профицит.',
      'Кардио: 1–2 раза в неделю по 20 минут лёгкого темпа для сердца и выносливости (особенно при борьбе). Вес растёт — не нужно гнаться за большим количеством кардио.',
      'Если за 2–3 недели вес не растёт — добавьте ~150 ккал (приложение предложит само).',
      'Сон 7–9 часов и день отдыха между тренировками одной группы мышц.',
    ],
  },
  maintain: {
    title: 'Рекомпозиция / удержание',
    steps: 9000,
    plan: 'Полный объём подходов, работа на прогрессию. Кардио по желанию.',
    tips: [
      'Калории на уровне расхода и белок около 2 г на кг: новичок может одновременно набирать мышцы и терять жир.',
      'Следите не только за весом, но и за замерами и рабочими весами: вес стоит, а талия уменьшается и силы растут — вы на верном пути.',
      'Шаги: цель 9000 в день. Кардио 1–2 раза в неделю по 20 минут.',
      'Если силы не растут 3–4 недели — слегка добавьте калорий; если растёт талия — слегка уберите.',
    ],
  },
}
export const goalInfo = g => GOAL_INFO[g] || GOAL_INFO.maintain
