import { state } from '../store.js'

export const MUSCLES = {
  chest: 'Грудь', back: 'Спина', shoulders: 'Плечи', biceps: 'Бицепс', triceps: 'Трицепс',
  forearms: 'Предплечья и кисть', legs: 'Ноги и ягодицы', core: 'Пресс',
}

// Уровень нагрузки определяет MET и время отдыха между подходами.
// MET по Compendium of Physical Activities (Ainsworth, 2011): силовая тренировка лёгкая/умеренная — 3,5,
// интенсивная («vigorous effort») — 6,0; средний уровень взят посередине (5,0).
// 40 с — время работы в подходе, остальное — отдых (рекомендации по отдыху: 1–3 мин).
export const LEVELS = {
  iso: { t: 'Лёгкая (изолирующее)', met: 3.5, rest: 75 },
  core: { t: 'Лёгкая (пресс)', met: 3.8, rest: 60 },
  comp: { t: 'Средняя (базовое)', met: 5, rest: 120 },
  heavy: { t: 'Тяжёлая (большие базовые)', met: 6, rest: 150 },
}
const WORK_SEC = 40

// [id, название, мышцы, уровень]
const raw = [
  // Грудь
  ['bench', 'Жим штанги лёжа', 'chest', 'comp'],
  ['incbench', 'Жим штанги на наклонной скамье', 'chest', 'comp'],
  ['decbench', 'Жим на скамье с отрицательным наклоном', 'chest', 'comp'],
  ['incdb', 'Жим гантелей на наклонной скамье', 'chest', 'comp'],
  ['dbpress', 'Жим гантелей лёжа', 'chest', 'comp'],
  ['smithbench', 'Жим лёжа в машине Смита', 'chest', 'comp'],
  ['chestmach', 'Жим от груди сидя (тренажёр)', 'chest', 'iso'],
  ['incmach', 'Жим сидя на наклонной скамье (тренажёр)', 'chest', 'iso'],
  ['dips', 'Отжимания на брусьях (грудь)', 'chest', 'comp'],
  ['pushup', 'Отжимания от пола', 'chest', 'comp'],
  ['fly', 'Разводка гантелей лёжа', 'chest', 'iso'],
  ['incfly', 'Разводка гантелей на наклонной скамье', 'chest', 'iso'],
  ['pecdeck', 'Сведение рук в тренажёре «бабочка»', 'chest', 'iso'],
  ['crossover', 'Кроссовер: сведение с верхних блоков', 'chest', 'iso'],
  ['lowcross', 'Кроссовер: сведение с нижних блоков', 'chest', 'iso'],
  ['pullover', 'Пулловер с гантелью', 'chest', 'iso'],
  // Спина
  ['pullup', 'Подтягивания широким хватом', 'back', 'comp'],
  ['chinup', 'Подтягивания обратным хватом', 'back', 'comp'],
  ['neutralpull', 'Подтягивания нейтральным хватом', 'back', 'comp'],
  ['latpd', 'Тяга верхнего блока к груди', 'back', 'comp'],
  ['latclose', 'Тяга верхнего блока узким/V-хватом', 'back', 'comp'],
  ['latrev', 'Тяга верхнего блока обратным хватом', 'back', 'comp'],
  ['row', 'Тяга штанги в наклоне', 'back', 'comp'],
  ['dbrow', 'Тяга гантели одной рукой', 'back', 'comp'],
  ['tbar', 'Т-образная тяга', 'back', 'comp'],
  ['chestrow', 'Тяга в тренажёре с упором грудью', 'back', 'iso'],
  ['cablerow', 'Тяга нижнего блока к поясу', 'back', 'comp'],
  ['machrow', 'Горизонтальная тяга в тренажёре', 'back', 'iso'],
  ['straightarm', 'Пулловер на блоке прямыми руками', 'back', 'iso'],
  ['deadlift', 'Становая тяга', 'back', 'heavy'],
  ['sumo', 'Становая тяга сумо', 'back', 'heavy'],
  ['trapbar', 'Становая тяга с трэп-грифом', 'back', 'heavy'],
  ['goodmorning', 'Наклоны со штангой «Доброе утро»', 'back', 'comp'],
  ['hyper', 'Гиперэкстензия', 'back', 'iso'],
  ['shrug', 'Шраги с гантелями', 'back', 'iso'],
  ['bbshrug', 'Шраги со штангой', 'back', 'iso'],
  // Плечи
  ['ohp', 'Жим штанги стоя', 'shoulders', 'comp'],
  ['dbohp', 'Жим гантелей сидя', 'shoulders', 'comp'],
  ['arnold', 'Жим Арнольда', 'shoulders', 'comp'],
  ['smithohp', 'Жим сидя в машине Смита', 'shoulders', 'comp'],
  ['shmach', 'Жим вверх сидя (тренажёр, плечи)', 'shoulders', 'iso'],
  ['latraise', 'Махи гантелями в стороны', 'shoulders', 'iso'],
  ['cablelat', 'Махи в сторону на блоке', 'shoulders', 'iso'],
  ['machlat', 'Разведение рук в тренажёре (средняя дельта)', 'shoulders', 'iso'],
  ['frontraise', 'Подъём рук перед собой', 'shoulders', 'iso'],
  ['reardelt', 'Махи в наклоне (задняя дельта)', 'shoulders', 'iso'],
  ['revpec', 'Обратная «бабочка» (задняя дельта)', 'shoulders', 'iso'],
  ['facepull', 'Тяга каната к лицу', 'shoulders', 'iso'],
  ['upright', 'Протяжка штанги к подбородку', 'shoulders', 'comp'],
  // Бицепс
  ['bbcurl', 'Подъём штанги на бицепс', 'biceps', 'iso'],
  ['ezcurl', 'Подъём EZ-штанги на бицепс', 'biceps', 'iso'],
  ['dbcurl', 'Подъём гантелей на бицепс', 'biceps', 'iso'],
  ['hammer', 'Молотки', 'biceps', 'iso'],
  ['preacher', 'Сгибание на скамье Скотта (штанга / EZ)', 'biceps', 'iso'],
  ['preachmach', 'Сгибание рук в тренажёре Скотта', 'biceps', 'iso'],
  ['inccurl', 'Подъём гантелей на наклонной скамье', 'biceps', 'iso'],
  ['conc', 'Концентрированный подъём', 'biceps', 'iso'],
  ['cablecurl', 'Сгибание рук на нижнем блоке', 'biceps', 'iso'],
  ['spider', 'Паучьи сгибания', 'biceps', 'iso'],
  // Трицепс
  ['pushdown', 'Разгибание рук на блоке (прямая рукоять)', 'triceps', 'iso'],
  ['ropepd', 'Разгибание рук на блоке (канат)', 'triceps', 'iso'],
  ['skull', 'Французский жим лёжа', 'triceps', 'iso'],
  ['ohtri', 'Разгибание рук из-за головы (гантель)', 'triceps', 'iso'],
  ['cableoh', 'Разгибание из-за головы на блоке', 'triceps', 'iso'],
  ['cgbench', 'Жим узким хватом', 'triceps', 'comp'],
  ['dipsmach', 'Брусья в тренажёре', 'triceps', 'iso'],
  ['benchdip', 'Обратные отжимания от скамьи', 'triceps', 'comp'],
  ['dips3', 'Отжимания на брусьях (трицепс)', 'triceps', 'comp'],
  ['kickback', 'Разгибание руки в наклоне', 'triceps', 'iso'],
  // Предплечья
  ['wristcurl', 'Сгибание кисти со штангой/гантелью', 'forearms', 'iso'],
  ['revwrist', 'Разгибание кисти (обратный хват)', 'forearms', 'iso'],
  ['revcurl', 'Подъём штанги обратным хватом', 'forearms', 'iso'],
  ['farmer', 'Фермерская прогулка', 'forearms', 'comp'],
  ['hang', 'Вис на турнике', 'forearms', 'iso'],
  // Ноги
  ['squat', 'Приседания со штангой', 'legs', 'heavy'],
  ['front', 'Фронтальные приседания', 'legs', 'heavy'],
  ['goblet', 'Гоблет-присед с гантелью', 'legs', 'comp'],
  ['hack', 'Гакк-присед (тренажёр)', 'legs', 'comp'],
  ['smithsquat', 'Приседания в машине Смита', 'legs', 'comp'],
  ['legpress', 'Жим ногами', 'legs', 'comp'],
  ['lunge', 'Выпады с гантелями', 'legs', 'comp'],
  ['bulgar', 'Болгарские сплит-приседы', 'legs', 'comp'],
  ['stepup', 'Зашагивания на платформу', 'legs', 'comp'],
  ['rdl', 'Румынская тяга', 'legs', 'heavy'],
  ['hipthrust', 'Ягодичный мостик со штангой', 'legs', 'comp'],
  ['legext', 'Разгибание ног сидя (тренажёр)', 'legs', 'iso'],
  ['seatedcurl', 'Сгибание ног сидя (тренажёр)', 'legs', 'iso'],
  ['legcurl', 'Сгибание ног лёжа (тренажёр)', 'legs', 'iso'],
  ['abduct', 'Разведение ног сидя (тренажёр)', 'legs', 'iso'],
  ['adduct', 'Сведение ног сидя (тренажёр)', 'legs', 'iso'],
  ['kickmach', 'Отведение ноги назад (тренажёр / блок)', 'legs', 'iso'],
  ['calf', 'Подъём на носки стоя', 'legs', 'iso'],
  ['seatcalf', 'Подъём на носки сидя', 'legs', 'iso'],
  ['calfpress', 'Подъём на носки в жиме ногами', 'legs', 'iso'],
  // Пресс
  ['crunch', 'Скручивания', 'core', 'core'],
  ['cablecrunch', 'Скручивания на блоке', 'core', 'core'],
  ['declsit', 'Пресс на наклонной скамье (упор для ног)', 'core', 'core'],
  ['abwheel', 'Ролик для пресса', 'core', 'core'],
  ['legraise', 'Подъём ног в висе', 'core', 'core'],
  ['kneeraise', 'Подъём коленей в висе / упоре', 'core', 'core'],
  ['lyingleg', 'Подъём ног лёжа', 'core', 'core'],
  ['russian', 'Русские скручивания', 'core', 'core'],
  ['bicycle', 'Велосипед', 'core', 'core'],
  ['woodchop', 'Рубка дров на блоке', 'core', 'core'],
  ['plank', 'Планка (секунды вместо повторов)', 'core', 'core'],
  ['sideplank', 'Боковая планка (секунды)', 'core', 'core'],
]

const base = {}
for (const [id, n, m, l] of raw) base[id] = { id, n, m, l, c: l === 'comp' || l === 'heavy' }

// Пользовательские упражнения хранятся в состоянии; EX отдаёт и встроенные, и свои
export const EX = new Proxy(base, {
  get: (t, k) => t[k] ?? state.customEx?.find(e => e.id === k),
})

export const listExercises = () => [...Object.values(base), ...(state.customEx || []).map(e => ({ ...e, c: e.l === 'comp' || e.l === 'heavy' }))]

// Энергозатраты на 1 подход сверх покоя: (MET − 1) × вес × время(работа + отдых) / 3600
export function setKcal(exId, weight) {
  const lv = LEVELS[EX[exId]?.l] || LEVELS.comp
  return ((lv.met - 1) * weight * (WORK_SEC + lv.rest)) / 3600
}

// Разминка и кардио: записываются в минутах. MET по Compendium of Physical Activities (2011):
// скакалка (умеренный темп) ≈ 11, бег ≈ 9,8 (около 8 км/ч), велотренажёр ≈ 7, гребной тренажёр ≈ 7, борьба ≈ 8, суставная разминка ≈ 3.
export const WARMUPS = [
  ['rope', 'Скакалка', 5, 11],
  ['run', 'Бег (дорожка / улица)', 5, 9.8],
  ['bike', 'Велотренажёр', 5, 7],
  ['rowm', 'Гребной тренажёр', 5, 7],
  ['jj', 'Суставная разминка и динамическая растяжка', 5, 3],
  // В Compendium 2024 расход борьбы приводится как оценка; фактические калории сильно зависят от пауз и раундов.
  ['wrestletech', 'Борьба — спокойная отработка техники (оценка)', 30, 4],
  ['wrestle', 'Борьба — интенсивные спарринги (оценка)', 30, 8],
  ['walk', 'Быстрая ходьба / ходьба в горку', 20, 4.3],
  ['elliptic', 'Эллипс / лёгкое кардио', 20, 5],
].map(([id, n, min, met]) => ({ id, n, min, met }))
export const WU = Object.fromEntries(WARMUPS.map(w => [w.id, w]))
