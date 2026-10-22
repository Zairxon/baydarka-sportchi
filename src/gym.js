// Система зала из приложения Торсо: уровни нагрузки, двойная прогрессия, совет по рабочему весу,
// расчёт расхода, рекорды по расчётному максимуму на 1 повторение, нагрузка по группам мышц.

// Уровень задаёт MET и отдых между подходами. MET — по Compendium of Physical Activities
// (Ainsworth, 2011): лёгкая силовая 3,5; интенсивная 6,0; отдых 1–3 мин.
export const LEVELS = {
  iso: { t: 'Yengil (izolyatsiya)', met: 3.5, rest: 75 },
  core: { t: 'Yengil (press)', met: 3.8, rest: 60 },
  comp: { t: "O'rtacha (bazaviy)", met: 5, rest: 120 },
  heavy: { t: "Og'ir (katta bazaviy)", met: 6, rest: 150 },
}
const WORK_SEC = 40

export const MUSCLES = {
  chest: "Ko'krak", back: 'Orqa', shoulders: 'Yelka', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Bilak va kaft', legs: 'Oyoq va dumba', core: 'Press', special: 'Maxsus', warm: 'Isitish', run: 'Yugurish va sakrash', body: 'Tana vazni bilan',
}

export const epley = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0)
const r1 = x => Math.round(x * 10) / 10

// Расход на один подход сверх покоя: (MET − 1) × вес × (работа + отдых) / 3600.
export function setKcal(level, weightKg) {
  const lv = LEVELS[level] || LEVELS.comp
  return ((lv.met - 1) * weightKg * (WORK_SEC + lv.rest)) / 3600
}

// Прошлые подходы упражнения (новые сверху), не считая текущего занятия.
export function history(logs, exId, exceptSession) {
  return logs
    .filter(l => l.exercise_id === exId && l.session_id !== exceptSession && l.detail?.sets?.some(s => s.w != null || s.r != null))
    .sort((a, b) => String(b.logged_on).localeCompare(String(a.logged_on)))
}

// «Двойная прогрессия»: все подходы достигли верха диапазона → прибавляем вес.
export function suggest(hist, lo, hi, nSets, comp) {
  const prev = hist[0]?.detail?.sets?.filter(s => s.w != null)
  if (!prev?.length) return { w: '', r: lo, prev: null, up: false }
  const best = prev.reduce((a, s) => (s.w > a.w ? s : a), prev[0])
  const allTop = prev.length >= Math.min(nSets, 2) && prev.every(s => s.r >= hi)
  const step = comp ? 2.5 : 2
  if (allTop) return { w: r1(best.w + step), r: lo, prev, up: true }
  const reps = Math.min(hi, Math.max(...prev.map(s => s.r)) + (prev.every(s => s.r >= lo) ? 1 : 0))
  return { w: best.w, r: Math.max(lo, reps), prev, up: false }
}

// Совет по рабочему весу: нужно минимум 2 занятия с упражнением и 3 дня тренировок всего.
export function advice(hist, totalDays, lo, hi, comp) {
  if (totalDays < 3 || hist.length < 2) return null
  const best = hist.slice(0, 2).map(l => Math.max(...l.detail.sets.map(s => epley(s.w, s.r))))
  const rm = Math.max(...best)
  if (!(rm > 0)) return null   // со своим весом
  lo = lo || 8; hi = hi || 12
  const mid = Math.round((lo + hi) / 2)
  const step = comp ? 2.5 : 1
  const w = Math.max(step, Math.round(rm / (1 + (mid + 2) / 30) / step) * step)   // запас 2 повторения
  return { w, lo, hi, rm: Math.round(rm * 2) / 2, step, sessions: hist.length }
}

// Лучший расчётный максимум по упражнению (для рекордов).
export function bestRm(hist) {
  let m = 0
  for (const l of hist) for (const s of l.detail.sets) m = Math.max(m, epley(s.w, s.r))
  return m
}

// Нагрузка по группам мышц: подходов за последние дни.
export function muscleLoad(logs, groupOf, sinceIso) {
  const out = {}
  for (const l of logs) {
    if (!l.logged_on || l.logged_on < sinceIso) continue
    const g = groupOf(l.exercise_id)
    if (!g || g === 'warm' || g === 'game') continue
    const n = l.detail?.sets?.length || 1
    out[g] = (out[g] || 0) + n
  }
  return out
}
