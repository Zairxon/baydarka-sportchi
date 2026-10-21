import { EX } from './exercises.js'

// Шаблоны по количеству дней: [название дня, [[id, подходы, мин.повт., макс.повт.], ...]]
const FB_A = ['Фулбоди A', [['squat', 3, 6, 10], ['bench', 3, 6, 10], ['row', 3, 8, 12], ['dbohp', 3, 8, 12], ['rdl', 2, 8, 12], ['crunch', 3, 10, 15]]]
const FB_B = ['Фулбоди B', [['legpress', 3, 8, 12], ['incdb', 3, 8, 12], ['latpd', 3, 8, 12], ['latraise', 3, 12, 20], ['legcurl', 3, 10, 15], ['dbcurl', 2, 10, 12], ['pushdown', 2, 10, 12]]]
const FB_C = ['Фулбоди C', [['goblet', 3, 8, 12], ['dips', 3, 6, 12], ['pullup', 3, 5, 10], ['ohp', 3, 6, 10], ['hipthrust', 3, 8, 12], ['legraise', 3, 8, 15]]]
const UP_A = ['Верх A', [['bench', 4, 6, 10], ['row', 4, 6, 10], ['ohp', 3, 8, 12], ['latpd', 3, 8, 12], ['fly', 3, 12, 15], ['bbcurl', 3, 10, 12], ['pushdown', 3, 10, 12]]]
const LO_A = ['Низ A', [['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['legpress', 3, 10, 12], ['legcurl', 3, 10, 15], ['calf', 4, 10, 15], ['crunch', 3, 10, 15]]]
const UP_B = ['Верх B', [['incdb', 4, 8, 12], ['pullup', 4, 6, 10], ['dbohp', 3, 8, 12], ['cablerow', 3, 10, 12], ['latraise', 3, 12, 20], ['facepull', 3, 12, 20], ['hammer', 3, 10, 12], ['skull', 3, 10, 12]]]
const LO_B = ['Низ B', [['lunge', 3, 8, 12], ['hipthrust', 3, 8, 12], ['legext', 3, 12, 15], ['legcurl', 3, 10, 15], ['calf', 4, 12, 15], ['legraise', 3, 8, 15]]]
const PUSH_A = ['Push A (грудь, плечи, трицепс)', [['bench', 4, 6, 10], ['dbohp', 3, 8, 12], ['incdb', 3, 8, 12], ['latraise', 3, 12, 20], ['pushdown', 3, 10, 12], ['ohtri', 3, 10, 12]]]
const PULL_A = ['Pull A (спина, бицепс)', [['pullup', 4, 6, 10], ['row', 4, 6, 10], ['cablerow', 3, 10, 12], ['facepull', 3, 12, 20], ['bbcurl', 3, 8, 12], ['hammer', 3, 10, 12]]]
const LEGS_A = ['Ноги A', [['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['legpress', 3, 10, 12], ['legcurl', 3, 10, 15], ['calf', 4, 10, 15], ['crunch', 3, 10, 15]]]
const PUSH_B = ['Push B', [['ohp', 4, 6, 10], ['dbpress', 3, 8, 12], ['dips', 3, 8, 12], ['fly', 3, 12, 15], ['latraise', 3, 12, 20], ['skull', 3, 10, 12]]]
const PULL_B = ['Pull B', [['latpd', 4, 8, 12], ['dbrow', 3, 8, 12], ['reardelt', 3, 12, 20], ['shrug', 3, 10, 15], ['dbcurl', 3, 10, 12], ['hyper', 3, 10, 15]]]
const LEGS_B = ['Ноги B', [['lunge', 3, 8, 12], ['hipthrust', 3, 8, 12], ['legext', 3, 12, 15], ['legcurl', 3, 10, 15], ['calf', 4, 12, 15], ['legraise', 3, 8, 15]]]

// Ваш сплит: Пн — грудь, широчайшие, пресс; Ср — руки, кисть, пресс; Пт — ноги, плечи, пресс
const MON = ['Пн · Грудь, спина, пресс', [['bench', 4, 6, 10], ['incdb', 3, 8, 12], ['fly', 3, 12, 15], ['pullup', 4, 6, 10], ['latpd', 3, 8, 12], ['row', 3, 8, 12], ['crunch', 3, 10, 15], ['legraise', 3, 8, 15]], 1]
const WED = ['Ср · Бицепс, трицепс, кисть, пресс', [['bbcurl', 4, 8, 12], ['hammer', 3, 10, 12], ['cgbench', 3, 6, 10], ['skull', 3, 10, 12], ['pushdown', 3, 10, 12], ['wristcurl', 3, 12, 20], ['revwrist', 3, 12, 20], ['declsit', 3, 10, 15], ['legraise', 3, 8, 15]], 3]
const FRI = ['Пт · Ноги, плечи, пресс', [['squat', 4, 6, 10], ['rdl', 3, 8, 10], ['legpress', 3, 10, 12], ['legcurl', 3, 10, 15], ['calf', 4, 10, 15], ['ohp', 4, 6, 10], ['latraise', 3, 12, 20], ['reardelt', 3, 12, 20], ['crunch', 3, 10, 15], ['abwheel', 3, 8, 12]], 5]

const TEMPLATES = {
  2: [UP_A, LO_A],
  3: [MON, WED, FRI],
  4: [UP_A, LO_A, UP_B, LO_B],
  5: [PUSH_A, PULL_A, LEGS_A, UP_B, LO_B],
  6: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B],
}

// goal: при похудении тяжёлые базовые остаются как есть (сохранить мышцы), изоляции на 1 подход меньше (восстановление в дефиците хуже),
// после тренировки — 20 минут быстрой ходьбы (лёгкое кардио)
export function buildPlan(days, level, goal) {
  const tpl = TEMPLATES[days] || TEMPLATES[3]
  return tpl.map(([name, list, dow], index) => ({
    name,
    dow: dow || null,
    warm: [{ id: 'rope', min: 5 }, { id: 'jj', min: 5 }, ...(index === 0 ? [{ id: 'wrestletech', min: 30 }] : []), ...(goal === 'cut' ? [{ id: 'walk', min: 20, post: true }] : [])],
    ex: list.map(([id, sets, lo, hi]) => ({
      id,
      // Новичку — меньше объёма: на восстановление уходит больше сил, чем кажется
      sets: Math.max(2, (level === 'beginner' ? sets - 1 : sets) - (goal === 'cut' && !EX[id]?.c && sets > 2 ? 1 : 0)),
      lo,
      hi,
    })),
  }))
}
