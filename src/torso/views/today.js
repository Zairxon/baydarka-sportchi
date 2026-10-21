import { state, save, today, addDays, uid } from '../store.js'
import { targets, sumFood, dayVerdict, dayBurn, walkMin, waterTarget, foodWaterMl, latestWeight, bmi } from '../calc.js'
import { SUPPS } from '../data/supplements.js'
import { sleepMini, sleepBanner, renderSleep } from './sleep.js'
import { updateBanner } from '../update.js'
import { syncReminders, ensurePermission, canNotify, toMin } from '../notify.js'
import { stepsInfo, syncSteps, openStepSettings, webStepsOn, webStepsToggle } from '../steps.js'
import { FOODS, searchFoods } from '../data/foods.js'
import { setHtml, acts, ins, ctx, esc, num, r1, fmtNum, dateLong, toast, openSheet, closeSheet, dd, ddVal, ask } from '../ui.js'

const MEALS = [['b', 'Завтрак'], ['l', 'Обед'], ['d', 'Ужин'], ['s', 'Перекус']]

const allFoods = () => [...state.customFoods, ...FOODS]
const byId = id => allFoods().find(f => f.id === id)

function defaultMeal() {
  const h = new Date().getHours()
  return h < 11 ? 'b' : h < 16 ? 'l' : h < 21 ? 'd' : 's'
}

// Дуга по часовой стрелке; угол 0 — сверху
// Та же дуга, но в обратную сторону (для подписей на нижних дугах)
function arcPathRev(cx, cy, r, a0, a1) {
  const rad = a => ((a - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a1))
  const y0 = cy + r * Math.sin(rad(a1))
  const x1 = cx + r * Math.cos(rad(a0))
  const y1 = cy + r * Math.sin(rad(a0))
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

function arcPath(cx, cy, r, a0, a1) {
  const rad = a => ((a - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(rad(a0))
  const y0 = cy + r * Math.sin(rad(a0))
  const x1 = cx + r * Math.cos(rad(a1))
  const y1 = cy + r * Math.sin(rad(a1))
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

// Кольцо питания: снаружи три сектора (жиры, углеводы, белки), внутри кольцо делений как у часов — заполняется по калориям
function ring(s, tg) {
  const p = Math.min(1, s.kcal / tg.kcal)
  const over = s.kcal > tg.kcal * 1.1
  const left = tg.kcal - s.kcal
  const sectors = [
    { a: -30, v: s.f / tg.fat, c: '#fbbf24', n: 'Жиры', g: s.f, goal: tg.fat, k: 'f' }, // жиры — сверху
    { a: 90, v: s.c / tg.carbs, c: '#2dd4bf', n: 'Углеводы', g: s.c, goal: tg.carbs, k: 'c' }, // углеводы — справа снизу
    { a: 210, v: s.p / tg.protein, c: '#a78bfa', n: 'Белки', g: s.p, goal: tg.protein, k: 'p' }, // белки — слева
  ]
  const span = 80
  const outer = sectors.map(x => {
    const f = Math.max(0, Math.min(1, x.v))
    const up = !(x.a + span / 2 > 90 && x.a + span / 2 < 270) // верхние дуги подписываем по часовой, нижние — против, чтобы текст не был перевёрнут
    const mid = x.a + span / 2
    const lp = up ? arcPath(90, 90, 76, mid - 54, mid + 54) : arcPathRev(90, 90, 87, mid - 54, mid + 54)
    const id = 'rl' + x.k
    const label = `<path id="${id}" d="${lp}" fill="none"/><text class="ring-lab ${Math.round(x.g) > x.goal ? 'over' : ''}" fill="${x.c}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${x.n} ${Math.round(x.g)}/${x.goal} г</textPath></text>`
    return label + `<path d="${arcPath(90, 90, 66, x.a, x.a + span)}" class="rg-track"/>${f > 0.005 ? `<path d="${arcPath(90, 90, 66, x.a, x.a + Math.max(2, span * f))}" class="rg-arc" stroke="${x.c}"/>` : ''}`
  }).join('')
  const ticks = []
  const n = 60
  for (let i = 0; i < n; i++) {
    const a = ((135 + (270 * i) / (n - 1)) * Math.PI) / 180
    const on = i / (n - 1) <= p && s.kcal > 0
    ticks.push(`<line x1="${(90 + Math.cos(a) * 38).toFixed(1)}" y1="${(90 + Math.sin(a) * 38).toFixed(1)}" x2="${(90 + Math.cos(a) * 49).toFixed(1)}" y2="${(90 + Math.sin(a) * 49).toFixed(1)}" class="tick-m ${on ? 'on' : ''} ${on && over ? 'over' : ''}"/>`)
  }
  return `<svg viewBox="-14 -14 208 208" class="ring">
    ${outer}
    ${ticks.join('')}
    <text x="90" y="88" class="ring-n ${s.kcal > tg.kcal * 1.1 ? 'over' : ''}" style="font-size:24px" text-anchor="middle">${Math.round(s.kcal)}</text>
    <text x="90" y="103" class="ring-t" style="font-size:10px" text-anchor="middle">калорий</text>
    <text x="90" y="124" style="font-size:20px" class="ring-rem ${left > 500 ? 'ok' : 'low'}" text-anchor="middle">${left < 0 ? '−' : ''}${Math.abs(Math.round(left))}</text>
  </svg>`
}

function macroBar(label, val, goal, cls) {
  const pct = Math.min(100, (val / goal) * 100)
  return `<div class="macro"><div class="macro-h"><span>${label}</span><span>${Math.round(val)}/${goal}${cls === 'k' ? '' : ' гр'}</span></div><div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct.toFixed(0)}%"></div></div></div>`
}

const ICON = {
  flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  arrow: '<path d="M4 12l16-8-6 16-2-7z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  walk: '<path d="M13 4a1.5 1.5 0 1 0 0 .01M9 21l2-6-2-3 1-5 4 2 2 4M11 9l-3 2"/>',
  drop: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>',
  apple: '<path d="M12 7c-3-2-7 0-7 5 0 4 2 8 4 8 1 0 2-1 3-1s2 1 3 1c2 0 4-4 4-8 0-5-4-7-7-5zM12 7c0-2 1-3 3-4"/>',
}
const ic = (k, color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tile-ic">${ICON[k]}</svg>`

function weekBars(target) {
  const goalSteps = state.stepGoal || 10000
  const DN = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const t = today()
  const [y, m, d] = t.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7 // 0 = понедельник
  const cols = []
  let sum = 0
  let cnt = 0
  for (let i = 0; i < 7; i++) {
    const ds = addDays(t, i - dow)
    const kc = ds > t ? 0 : state.steps[ds] || 0
    if (kc) { sum += kc; cnt++ }
    const [yy, mm, dd] = ds.split('-').map(Number)
    const name = DN[new Date(yy, mm - 1, dd).getDay()]
    const h = Math.min(100, (kc / goalSteps) * 100)
    cols.push(`<div class="wcol ${ds === t ? 'now' : ''}"><div class="wtrack"><div class="wfill" style="height:${h.toFixed(0)}%"></div></div><span>${name}</span></div>`)
  }
  return { html: cols.join(''), avg: cnt ? Math.round(sum / cnt) : 0 }
}

const HELPERS = [
  ['Куриная грудка, варёная/запечённая', 'курицы'],
  ['Творог 0–1%', 'творога'],
  ['Йогурт греческий 2%', 'греческого йогурта'],
  ['Тунец консервированный (в соку)', 'тунца'],
]

function suggestions(left) {
  if (left.p < 15 || left.kcal < 120) return ''
  const out = []
  for (const [name, label] of HELPERS) {
    const f = FOODS.find(x => x.n === name)
    const want = Math.min(left.p, 40)
    const g = Math.round(want / (f.p / 100) / 10) * 10
    const kc = Math.round((g * f.k) / 100)
    if (kc > left.kcal + 50) continue
    out.push(`<button class="chip" data-a="quickAdd" data-id="${f.id}" data-g="${g}">≈ ${g} г ${label} · ${Math.round((g * f.p) / 100)} г белка · ${kc} ккал</button>`)
    if (out.length === 3) break
  }
  return out.length ? `<div class="sug"><div class="sub">Чтобы добрать белок:</div>${out.join('')}</div>` : ''
}

const Lw = ml => (ml / 1000).toFixed(2).replace('.', ',')

// Предупреждение, если вы отстаёте от равномерного графика питья (с пробуждения до «отбой − 2 ч»)
function waterPace(date, drunk, total) {
  if (date !== today()) return ''
  const c = state.sleepCfg
  const d = new Date()
  const cur = d.getHours() * 60 + d.getMinutes()
  const wake = toMin(c.wake)
  const span = (toMin(c.bed) - wake + 1440) % 1440
  const t = (cur - wake + 1440) % 1440 // минут с момента подъёма
  const end = span - 120
  if (t > span) return ''
  if (t >= 120 && t <= end) {
    const exp = (total * t) / end
    if (drunk < exp - total * 0.2) return `<div class="warn-line">⚠️ Пора выпить воды: за сегодня получено ${Lw(drunk)} л (напитки и еда), к этому времени нужно около ${Lw(exp)} л. Выпейте 300–500 мл.</div>`
  } else if (t > end && total - drunk > 600) {
    return `<div class="warn-line">⚠️ До нормы ещё ${Lw(total - drunk)} л. Не переносите всё на вечер: много воды перед сном заставит вставать ночью.</div>`
  }
  return ''
}

// Кольцо воды: нажатие на кольцо или каплю открывает ввод количества
function waterRing(drunk, total) {
  const p = Math.min(1, drunk / total)
  const L = ml => (ml / 1000).toFixed(1).replace('.', ',')
  return `<svg viewBox="-14 -14 208 208" class="ring">
    <defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc9f0"/><stop offset="1" stop-color="#4361ee"/></linearGradient></defs>
    <path d="${arcPath(90, 90, 80, 135, 405)}" class="rg-track"/>
    ${p > 0.005 ? `<path d="${arcPath(90, 90, 80, 135, 135 + 270 * p)}" class="rg-arc" stroke="url(#wg)"/>` : ''}
    <path d="M90 52c5 6 9 11 9 16a9 9 0 0 1-18 0c0-5 4-10 9-16z" class="drop-g"/>
    <text x="90" y="104" class="ring-n" text-anchor="middle">${L(drunk)}</text>
    <text x="90" y="120" class="ring-t" text-anchor="middle">из ${L(total)} л</text>
  </svg>`
}

// Кольцо сожжённых калорий с огоньком: дуга заполняется до ориентира 500 ккал активного расхода в день
function burnRing(burn) {
  const p = Math.min(1, burn.total / 500)
  return `<svg viewBox="-14 -14 208 208" class="ring">
    <defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#ff4d2e"/></linearGradient></defs>
    <path d="${arcPath(90, 90, 80, 135, 405)}" class="rg-track"/>
    ${p > 0.005 ? `<path d="${arcPath(90, 90, 80, 135, 135 + 270 * p)}" class="rg-arc" stroke="url(#bg2)"/>` : ''}
    <g transform="translate(66 44) scale(2)"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" fill="url(#bg2)"/></g>
    <text x="90" y="112" class="ring-n" text-anchor="middle">${Math.round(burn.total)}</text>
    <text x="90" y="130" class="ring-t" text-anchor="middle">ккал</text>
  </svg>`
}

// Предупреждение, напоминания и пояснение к норме воды (под кольцами)
function waterExtras(date, w, drunk, drinks, foodW) {
  const L = ml => (ml / 1000).toFixed(2).replace('.', ',')
  return `${waterPace(date, drunk, w.total)}
    <button class="btn ghost sm full drinkbtn" data-a="openDrink">☕ Чай, кофе, другой напиток</button>
    <button class="link remind" data-a="waterRemind">🔔 Вода: ${state.waterCfg.every ? `напоминать каждые ${state.waterCfg.every} ч` : 'напоминания выключены — включить'}</button>
    <div class="sub water-split">Напитки ${L(drinks)} л + вода из еды ≈ ${L(foodW)} л</div>
    <details class="note-d"><summary>Как считается норма воды (${L(w.total)} л)</summary><div class="sub">Норма — общая вода из всех источников (EFSA: 2,5 л для мужчин и 2,0 л для женщин): напитки (вода, чай, кофе, молоко, суп) и влага, которая есть в еде — в огурце около 95% воды, в плове около 60%. Воду из еды приложение считает само по записям питания (оценка приблизительная), поэтому выпивать всю норму не нужно${w.extra ? ` + ${L(w.extra)} л на тренировку (ACSM: 0,4–0,8 л в час, берём 0,6)` : ''}. ${w.extra ? `За ≈4 часа до тренировки выпейте около ${w.pre} мл (5–7 мл/кг), после — по жажде, чтобы вернуть потерянный вес.` : 'Чай, кофе и суп тоже считаются.'} Количество воды можно ввести нажатием на кольцо или каплю. Чай и кофе тоже считаются: кнопка «Чай, кофе, другой напиток».</div></details>`
}

// Индекс массы тела (категории ВОЗ)
const BMI_CATS = [
  [18.5, 'Недостаточная масса', '#4cc9f0'],
  [25, 'Норма', '#19e38a'],
  [30, 'Избыточная масса', '#fbbf24'],
  [35, 'Ожирение I степени', '#ff9f43'],
  [40, 'Ожирение II степени', '#ff6b4a'],
  [99, 'Ожирение III степени', '#ff5d6c'],
]

function bmiCard() {
  const p = state.profile
  const wt = latestWeight() || p.weight
  const b = bmi(wt, p.height)
  const cat = BMI_CATS.find(c => b < c[0])
  const pos = v => ((Math.max(15, Math.min(40, v)) - 15) / 25) * 100
  const bounds = [15, 18.5, 25, 30, 35, 40]
  const zones = BMI_CATS.slice(0, 5).map((c, i) => `<i style="flex:${bounds[i + 1] - bounds[i]};background:${c[2]}"></i>`).join('')
  const marks = [18.5, 25, 30, 35].map(v => `<span style="left:${pos(v)}%">${v}</span>`).join('')
  return `<div class="card bmi-c">
    <div class="bmi-row"><span class="sub">ИМТ</span><b class="bmi-n">${b.toFixed(1).replace('.', ',')}</b><span class="cat" style="background:${cat[2]}">${cat[1]}</span></div>
    <div class="scale sm"><div class="zones">${zones}</div><b class="pin" style="left:${pos(b)}%"></b><div class="marks">${marks}</div></div>
    <details class="note-d"><summary>О показателе</summary><div class="sub">Категории ВОЗ. ИМТ не отличает мышцы от жира: при большой мышечной массе он завышен — ориентируйтесь ещё на замеры талии.</div></details>
  </div>`
}

function activityCard(burn, goalSteps, stNote, date) {
  const pct = Math.min(100, (burn.steps / goalSteps) * 100)
  return `<div class="card act">
    <div class="act-grid">
      <div class="act-col">
        <div class="act-h"><span class="em">🚶</span><b>Шаги</b><button class="link r" data-a="refreshSteps">обновить</button></div>
        <div class="act-big">${burn.steps.toLocaleString('ru-RU')}</div>
        <div class="sub">шагов из ${goalSteps.toLocaleString('ru-RU')}</div>
        <div class="bar-track thin"><div class="bar-fill k" style="width:${pct.toFixed(0)}%"></div></div>
        <div class="act-s">≈ ${Math.round(burn.walk)} ккал · ${burn.km.toFixed(1).replace('.', ',')} км · ${walkMin(burn.steps)} мин${burn.train ? ` · тренировка ≈ ${Math.round(burn.train)} ккал` : ''}</div>
      </div>
      <div class="act-div"></div>
      ${sleepMini(date)}
    </div>
    ${stepsInfo.status === 'web' ? `<div class="row-in"><input id="st-man" type="text" inputmode="numeric" placeholder="шагов за сегодня"/><button class="btn" data-a="stepsSet">Сохранить шаги</button></div><button class="btn ${webStepsOn() ? '' : 'ghost'} full" data-a="stepsToggle">${webStepsOn() ? 'Подсчёт шагов включён — выключить' : 'Считать шаги (приложение открыто)'}</button>` : ''}
    ${stNote ? `<div class="sub note">${stNote}</div>${stepsInfo.status === 'denied' ? `<button class="btn ghost full" data-a="stepSettings">Открыть настройки разрешений</button>` : ''}` : ''}
  </div>`
}

function suppCard(date) {
  const on = state.supp.on.map(id => SUPPS.find(s => s.id === id)).filter(Boolean)
  if (!on.length) return ''
  const taken = state.supp.taken[date] || {}
  return `<div class="card"><div class="card-h">${ic('apple', '#fbbf24')}<b>Добавки</b></div>${on.map(s => `<button class="chk ${taken[s.id] ? 'on' : ''}" data-a="suppTake" data-id="${s.id}"><i>${taken[s.id] ? '✓' : ''}</i>${esc(s.n)}</button>`).join('')}</div>`
}

export function renderToday() {
  if (ctx.tsub === 'sleep') return renderSleep()
  const t = targets()
  const date = ctx.date
  const s = sumFood(date)
  const list = state.food[date] || []
  const left = { kcal: t.kcal - s.kcal, p: t.protein - s.p }
  const v = dayVerdict(date)
  const isToday = date === today()
  const w = state.weights[date]
  const wk = weekBars(t.kcal)
  const wtg = waterTarget(date)
  const drinks = state.water[date] || 0
  const foodW = foodWaterMl(date)
  const drunk = drinks + foodW // всего воды за день: напитки + влага из еды
  const burn = dayBurn(date)
  const goalSteps = state.stepGoal || 10000
  const lastT = stepsInfo.last ? new Date(stepsInfo.last).toTimeString().slice(0, 5) : ''
  const stNote = { denied: 'Разрешите доступ к «Физической активности» в настройках телефона (Приложения → Torso → Разрешения)', nosensor: 'В телефоне не обнаружен аппаратный счётчик шагов. Напиши модель телефона — проверю совместимость.', stalled: 'Разрешение есть, но счётчик не вернул показания. Проверь энергосбережение для Torso и перезагрузи телефон. Если не поможет, напиши модель телефона.', web: 'В браузере шаги считаются по датчику движения, только пока приложение открыто. Для точного счёта впишите шаги из «Здоровья» или Samsung Health вручную.', error: 'Не удалось связаться с модулем шагомера. Закрой и снова открой приложение.', ok: stepsInfo.tracking ? `Счётчик отвечает · замеров: ${stepsInfo.samples}${lastT ? ` · последний в ${lastT}` : ''}. Фоновый подсчёт активен — оставь уведомление Torso включённым.` : `Счётчик ответил, но фоновая служба не запущена. Открой Torso ещё раз и проверь, что включено уведомление подсчёта.` }[stepsInfo.status] || ''

  const meals = MEALS.map(([k, name]) => {
    const items = list.filter(e => e.meal === k)
    const kc = items.reduce((a, e) => a + e.kcal, 0)
    return `<div class="card meal">
      <div class="meal-h"><b>${name}</b><span>${Math.round(kc)} ккал</span></div>
      ${items.map((e, ix) => `<div class="entry" data-a="editFood" data-id="${e.id}"><div><div class="e-n">${esc(e.name)}${items.findIndex(o => o.name === e.name && o.g === e.g) < ix ? ' <span class="dup">повтор?</span>' : ''}</div><div class="e-s">${e.g ? fmtNum(e.g) + ' г · ' : ''}Белки ${r1(e.p)} · Жиры ${r1(e.f)} · Углеводы ${r1(e.c)}</div></div><div class="e-k">${Math.round(e.kcal)}<button class="x" data-a="delFood" data-id="${e.id}" aria-label="Удалить">✕</button></div></div>`).join('')}
      <button class="add" data-a="addFood" data-meal="${k}">＋ Добавить</button>
    </div>`
  }).join('')

  const yest = state.food[addDays(date, -1)] || []
  const copyBtn = !list.length && yest.length
    ? `<button class="btn ghost" data-a="copyYesterday">Скопировать вчерашний день</button>` : ''

  return `
  <div class="datebar">
    <button class="icon" data-a="dayShift" data-d="-1">‹</button>
    <div><h1 class="title">${isToday ? 'Сегодня' : dateLong(date)}</h1><div class="sub">${isToday ? dateLong(date) : ''}</div></div>
    <button class="icon" data-a="dayShift" data-d="1" ${isToday ? 'disabled' : ''}>›</button>
  </div>
  ${updateBanner()}
  ${bmiCard()}
  ${activityCard(burn, goalSteps, stNote, date)}
${sleepBanner(date)}
  ${suppCard(date)}
  <h2 class="sec">Питание</h2>
  <div class="card rings3">
    <div class="ringcol">${ring(s, t)}<div class="rl">Съедено ккал</div></div>
    <div class="ringcol"><button type="button" class="water-ring-button" data-a="openWater" aria-label="Добавить воду">${waterRing(drunk, wtg.total)}</button><div class="rl">Вода${wtg.note ? ' · ' + wtg.note : ''}</div></div>
    <div class="ringcol">${burnRing(burn)}<div class="rl">Сожжено ккал</div></div>
  </div>
  <div class="card summary">
    <div class="card-h">${ic('apple', '#ffb36b')}<b>Питание и вода</b></div>
    ${waterExtras(date, wtg, drunk, drinks, foodW)}
    <button class="grad" data-a="addFood" data-meal="${defaultMeal()}">＋ Добавить еду</button>
  </div>
  ${v ? `<div class="card verdict ${v.level}"><div class="v-t">${v.level === 'ok' ? '✅ Питание' : v.level === 'warn' ? '⚠️ Внимание' : v.level === 'info' ? '💡 Подсказка' : '🍽 Питание'}</div><p>${esc(v.text)}</p>${(v.avoid || []).map(a => `<div class="avoid"><b>🚫 ${esc(a.t)}</b><p>${esc(a.x)}</p></div>`).join('')}${suggestions(left)}</div>` : ''}
  ${copyBtn}
  ${meals}
  <div class="card">
    <div class="row-h"><b>Вес ${isToday ? 'сегодня' : 'за ' + dateLong(date)}</b><span class="sub">утром, натощак</span></div>
    <div class="inline"><input id="wt" type="text" inputmode="decimal" placeholder="кг" value="${w ?? ''}"/><button class="btn" data-a="saveWeight">Сохранить</button></div>
  </div>`
}

// ---------- действия ----------
acts.dayShift = ({ d }) => {
  const nd = addDays(ctx.date, Number(d))
  if (nd > today()) return
  ctx.date = nd
  ctx.render()
}

acts.delFood = ({ id }) => {
  state.food[ctx.date] = (state.food[ctx.date] || []).filter(e => e.id !== id)
  save()
  ctx.render()
}

acts.copyYesterday = () => {
  const y = state.food[addDays(ctx.date, -1)] || []
  state.food[ctx.date] = y.map(e => ({ ...e, id: uid() }))
  save()
  ctx.render()
}

acts.saveWeight = () => {
  const v = num(document.getElementById('wt').value)
  if (!(v >= 25 && v <= 300)) return toast('Введите вес в кг, например 72,5')
  state.weights[ctx.date] = r1(v)
  save()
  toast('Вес сохранён')
  ctx.render()
}

function addEntry(food, grams, meal) {
  const k = grams / 100
  const lst = (state.food[ctx.date] ||= [])
  const last = lst[lst.length - 1]
  if (last && last.name === food.n && last.g === grams && last.meal === meal && Date.now() - (last.t || 0) < 2500) return // двойное нажатие
  const e = { t: Date.now(), id: uid(), name: food.n, g: grams, kcal: food.k * k, p: food.p * k, f: food.f * k, c: food.c * k, meal, b: { k: food.k, p: food.p, f: food.f, c: food.c } }
  ;(state.food[ctx.date] ||= []).push(e)
  save()
  if (ctx.date === today()) syncReminders()
}

acts.quickAdd = ({ id, g }) => {
  addEntry(byId(id), Number(g), defaultMeal())
  toast('Добавлено')
  ctx.render()
}

// ---------- окно добавления еды ----------
let sel = null

function resultsHtml(q) {
  const res = searchFoods(q, state.customFoods, state.hiddenFoods)
  if (!res.length) return '<div class="empty">Не найдено. Создайте свой продукт ниже.</div>'
  return res.map(f => `<div class="fr-wrap"><button class="fr food" data-a="pickFood" data-id="${f.id}"><span>${esc(f.n)}</span><em>${f.k} ккал · белки ${r1(f.p)} · жиры ${r1(f.f)} · углеводы ${r1(f.c)} (на 100 г)</em></button><button class="fx" data-a="delCatalog" data-id="${f.id}" aria-label="Удалить из списка">✕</button></div>`).join('')
}

acts.addFood = ({ meal }) => {
  sel = { meal }
  openSheet(`
    <div class="sh-h"><b>Добавить еду</b><button class="icon" data-a="closeSheet">✕</button></div>
    <input id="fq" type="search" placeholder="Поиск: курица, рис, плов…" autocomplete="off"/>
    <div id="fres" class="fres">${resultsHtml('')}</div>
    ${state.hiddenFoods.length ? `<button class="link" data-a="restoreFoods">Вернуть удалённые продукты (${state.hiddenFoods.length})</button>` : ''}
    <div class="row2 mt"><button class="btn ghost" data-a="newFood">Свой продукт</button><button class="btn ghost" data-a="quickKcal">Просто ккал</button></div>`)
}

ins.fq = el => { setHtml(document.getElementById('fres'), resultsHtml(el.value)) }

acts.pickFood = ({ id }) => {
  const f = byId(id)
  sel.food = f
  const hasU = !!f.u
  openSheet(`
    <div class="sh-h"><b>${esc(f.n)}</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sub">На 100 г: ${f.k} ккал · белки ${r1(f.p)} · жиры ${r1(f.f)} · углеводы ${r1(f.c)}</div>
    <div class="inline mt"><input id="amt" type="text" inputmode="decimal" value="${hasU ? 1 : 100}"/>
      ${dd('unit', [...(hasU ? [['u', `${f.u[0]} (${f.u[1]} г)`]] : []), ['g', 'граммы']], hasU ? 'u' : 'g')}</div>
    <div class="sel-row">${MEALS.map(([k, n]) => `<button class="pill ${k === sel.meal ? 'on' : ''}" data-a="setMeal" data-m="${k}">${n}</button>`).join('')}</div>
    <div id="prev" class="preview"></div>
    <button class="btn full" data-a="confirmFood">Добавить</button>`)
  updatePreview()
}

function grams() {
  const a = num(document.getElementById('amt').value)
  const u = ddVal('unit')
  return u === 'u' ? a * sel.food.u[1] : a
}
function updatePreview() {
  const g = grams()
  const f = sel.food
  const el = document.getElementById('prev')
  if (!el) return
  if (!(g > 0)) { el.textContent = '—'; return }
  const k = g / 100
  setHtml(el, `<b>${Math.round(f.k * k)} ккал</b> · белки ${r1(f.p * k)} · жиры ${r1(f.f * k)} · углеводы ${r1(f.c * k)} <span class="sub">(${Math.round(g)} г)</span>`)
}
ins.amt = updatePreview
ins.unit = updatePreview

acts.setMeal = ({ m }, el) => {
  sel.meal = m
  document.querySelectorAll('.sel-row .pill').forEach(p => p.classList.toggle('on', p === el))
}

acts.confirmFood = () => {
  const g = grams()
  if (!(g > 0 && g < 5000)) return toast('Введите количество')
  addEntry(sel.food, g, sel.meal)
  closeSheet()
  toast('Добавлено')
  ctx.render()
}

acts.newFood = () => {
  openSheet(`
    <div class="sh-h"><b>Свой продукт</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sub">Значения на 100 г — берите с упаковки.</div>
    <label>Название<input id="nf-n" type="text"/></label>
    <div class="grid4">
      <label>Ккал<input id="nf-k" type="text" inputmode="decimal"/></label>
      <label>Белки<input id="nf-p" type="text" inputmode="decimal"/></label>
      <label>Жиры<input id="nf-f" type="text" inputmode="decimal"/></label>
      <label>Углев.<input id="nf-c" type="text" inputmode="decimal"/></label>
    </div>
    <button class="btn full" data-a="saveNewFood">Сохранить и выбрать</button>`)
}

acts.saveNewFood = () => {
  const g = id => num(document.getElementById(id).value)
  const n = document.getElementById('nf-n').value.trim()
  const k = g('nf-k')
  if (!n || !(k >= 0)) return toast('Нужны название и калории')
  const f = { id: 'c' + uid(), n, k, p: g('nf-p') || 0, f: g('nf-f') || 0, c: g('nf-c') || 0, u: null }
  state.customFoods.unshift(f)
  save()
  acts.pickFood({ id: f.id })
}

acts.quickKcal = () => {
  openSheet(`
    <div class="sh-h"><b>Быстрое добавление</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sub">Если знаете только итог порции (например, из ресторана).</div>
    <label>Название<input id="qk-n" type="text" placeholder="Обед в кафе"/></label>
    <div class="grid4">
      <label>Ккал<input id="qk-k" type="text" inputmode="decimal"/></label>
      <label>Белки<input id="qk-p" type="text" inputmode="decimal"/></label>
      <label>Жиры<input id="qk-f" type="text" inputmode="decimal"/></label>
      <label>Углев.<input id="qk-c" type="text" inputmode="decimal"/></label>
    </div>
    <button class="btn full" data-a="saveQuick">Добавить</button>`)
}

acts.saveQuick = () => {
  const g = id => num(document.getElementById(id).value)
  const k = g('qk-k')
  if (!(k >= 0)) return toast('Введите калории')
  const e = { id: uid(), name: document.getElementById('qk-n').value.trim() || 'Порция', g: 0, kcal: k, p: g('qk-p') || 0, f: g('qk-f') || 0, c: g('qk-c') || 0, meal: sel?.meal || defaultMeal() }
  ;(state.food[ctx.date] ||= []).push(e)
  save()
  if (ctx.date === today()) syncReminders()
  closeSheet()
  toast('Добавлено')
  ctx.render()
}


acts.stepSettings = async () => { await openStepSettings() }

acts.stepsSet = () => {
  const v = Math.round(num(document.getElementById('st-man')?.value))
  if (!(v >= 0 && v <= 100000)) return toast('Введите число шагов')
  state.steps[ctx.date || today()] = v
  save()
  toast('Шаги сохранены')
  ctx.render()
}

acts.stepsToggle = async () => {
  const on = await webStepsToggle()
  toast(on ? 'Подсчёт шагов включён' : webStepsOn() ? 'Подсчёт шагов выключен' : 'Датчик движения недоступен на этом телефоне')
  ctx.render()
}

acts.refreshSteps = async () => {
  await syncSteps()
  ctx.render()
  if (stepsInfo.status === 'denied') toast('Разрешите доступ к физической активности в настройках телефона')
  else if (stepsInfo.status === 'nosensor') toast('Встроенный датчик шагов не найден')
  else if (stepsInfo.status === 'stalled') toast('Счётчик есть, но не ответил; проверьте энергосбережение')
  else if (stepsInfo.status === 'ok') toast('Шаги обновлены')
}

acts.openWater = () => {
  openSheet(`
    <div class="sh-h"><b>Добавить воду</b><button class="icon" data-a="closeSheet">✕</button></div>
    <label>Количество, мл (примерно столько же граммов)<input id="water-amount" type="text" inputmode="numeric" value="200" placeholder="Например, 50 или 100"/></label>
    <div class="sel-row">
      <button class="pill" data-a="setWaterAmount" data-ml="50">50 мл</button>
      <button class="pill" data-a="setWaterAmount" data-ml="100">100 мл</button>
      <button class="pill" data-a="setWaterAmount" data-ml="200">200 мл</button>
    </div>
    <button class="btn full mt" data-a="confirmWater">Добавить</button>`)
}
acts.setWaterAmount = ({ ml }) => {
  const input = document.getElementById('water-amount')
  if (input) input.value = ml
}
acts.confirmWater = () => {
  const ml = Number.parseInt(document.getElementById('water-amount')?.value, 10)
  if (!Number.isInteger(ml) || ml < 1 || ml > 5000) return toast('Введите количество от 1 до 5000 мл')
  state.water[ctx.date] = (state.water[ctx.date] || 0) + ml
  save()
  closeSheet()
  toast(`Добавлено ${ml} мл воды`)
  ctx.render()
}

acts.suppTake = ({ id }) => {
  const day = (state.supp.taken[ctx.date] ||= {})
  day[id] = !day[id]
  save()
  ctx.render()
}

// ---------- редактирование записи ----------
const entryOf = id => (state.food[ctx.date] || []).find(x => x.id === id)
const baseOf = e => e.b || { k: (e.kcal / e.g) * 100, p: (e.p / e.g) * 100, f: (e.f / e.g) * 100, c: (e.c / e.g) * 100 }

acts.editFood = ({ id }) => {
  const e = entryOf(id)
  if (!e) return
  sel = { meal: e.meal, editId: id }
  const quick = !(e.g > 0)
  const body = quick
    ? `<div class="sub">Значения за всю порцию.</div><div class="grid4">
        <label>Ккал<input id="ed-k" type="text" inputmode="decimal" value="${r1(e.kcal)}"/></label>
        <label>Белки<input id="ed-p" type="text" inputmode="decimal" value="${r1(e.p)}"/></label>
        <label>Жиры<input id="ed-f" type="text" inputmode="decimal" value="${r1(e.f)}"/></label>
        <label>Углев.<input id="ed-c" type="text" inputmode="decimal" value="${r1(e.c)}"/></label></div>`
    : `<label>Вес, г<input id="ed-g" type="text" inputmode="decimal" value="${e.g}"/></label><div id="ed-prev" class="preview"></div>`
  openSheet(`
    <div class="sh-h"><b>Изменить запись</b><button class="icon" data-a="closeSheet">✕</button></div>
    <label>Название<input id="ed-n" type="text" value="${esc(e.name)}"/></label>
    ${body}
    <div class="sel-row">${MEALS.map(([k, n]) => `<button class="pill ${k === e.meal ? 'on' : ''}" data-a="setMeal" data-m="${k}">${n}</button>`).join('')}</div>
    <div class="row2"><button class="btn bad" data-a="editDelete">Удалить</button><button class="btn" data-a="saveEdit">Сохранить</button></div>`)
  if (!quick) updateEditPreview()
}

function updateEditPreview() {
  const e = entryOf(sel?.editId)
  const el = document.getElementById('ed-prev')
  if (!e || !el) return
  const g = num(document.getElementById('ed-g').value)
  if (!(g > 0)) { el.textContent = '—'; return }
  const b = baseOf(e)
  const k = g / 100
  setHtml(el, `<b>${Math.round(b.k * k)} ккал</b> · белки ${r1(b.p * k)} · жиры ${r1(b.f * k)} · углеводы ${r1(b.c * k)}`)
}
ins['ed-g'] = updateEditPreview

acts.saveEdit = () => {
  const e = entryOf(sel?.editId)
  if (!e) return closeSheet()
  const val = id => num(document.getElementById(id).value)
  if (e.g > 0) {
    const g = val('ed-g')
    if (!(g > 0 && g < 5000)) return toast('Введите вес в граммах')
    const b = baseOf(e)
    Object.assign(e, { b, g, kcal: (b.k * g) / 100, p: (b.p * g) / 100, f: (b.f * g) / 100, c: (b.c * g) / 100 })
  } else {
    const k = val('ed-k')
    if (!(k >= 0)) return toast('Введите калории')
    Object.assign(e, { kcal: k, p: val('ed-p') || 0, f: val('ed-f') || 0, c: val('ed-c') || 0 })
  }
  e.name = document.getElementById('ed-n').value.trim() || e.name
  e.meal = sel.meal
  save()
  closeSheet()
  toast('Сохранено')
  ctx.render()
}

acts.editDelete = () => {
  const id = sel?.editId
  state.food[ctx.date] = (state.food[ctx.date] || []).filter(x => x.id !== id)
  save()
  closeSheet()
  ctx.render()
}

acts.waterRemind = async () => {
  const order = [0, 2, 3]
  const cur = state.waterCfg.every || 0
  const next = order[(order.indexOf(cur) + 1) % order.length]
  state.waterCfg.every = next
  save()
  if (next) {
    if (!canNotify()) toast('Напоминания работают в приложении на телефоне')
    else if (!(await ensurePermission())) toast('Разрешите уведомления в настройках телефона')
    else toast(`Напоминания каждые ${next} ч — с утра до за 2 часа до сна`)
  } else toast('Напоминания о воде выключены')
  await syncReminders()
  ctx.render()
}

// ---------- удаление продуктов из общего списка ----------
acts.delCatalog = async ({ id }) => {
  const f = byId(id)
  if (!f) return
  const meal = sel?.meal || defaultMeal()
  const ok = await ask(`Удалить «${f.n}» из списка продуктов? Уже внесённые записи не изменятся. Вернуть удалённое можно в окне добавления еды.`, 'Удалить', true)
  if (ok) {
    if (String(f.id).startsWith('c')) state.customFoods = state.customFoods.filter(x => x.id !== f.id)
    else if (!state.hiddenFoods.includes(f.n)) state.hiddenFoods.push(f.n)
    save()
    toast('Удалено из списка')
  }
  acts.addFood({ meal })
}
acts.restoreFoods = () => {
  state.hiddenFoods = []
  save()
  toast('Продукты возвращены')
  acts.addFood({ meal: sel?.meal || defaultMeal() })
}

// ---------- напитки ----------
// на 100 мл: [id, название, ккал, белки, жиры, углеводы]
const DRINKS = [
  ['water', 'Вода', 0, 0, 0, 0],
  ['mineral', 'Минеральная вода (негазированная)', 0, 0, 0, 0],
  ['sparkling', 'Минеральная вода газированная', 0, 0, 0, 0],
  ['soda0', 'Газированная вода без сахара', 0, 0, 0, 0],
  ['cola0', 'Кола без сахара', 0.3, 0, 0, 0],
  ['tea', 'Чай без сахара', 1, 0, 0, 0.3],
  ['tea1', 'Чай с 1 ч. л. сахара', 8, 0, 0, 2],
  ['tea2', 'Чай с 2 ч. л. сахара', 16, 0, 0, 4],
  ['coffee', 'Кофе без сахара', 2, 0.1, 0, 0],
  ['latte', 'Кофе с молоком и сахаром', 45, 1.5, 1.5, 6.5],
  ['milk', 'Молоко', 52, 2.8, 2.5, 4.7],
  ['kefir', 'Кефир / айран', 55, 2.9, 2.8, 4],
  ['juice', 'Сок', 45, 0.7, 0.2, 10.4],
  ['compot', 'Компот', 45, 0.2, 0, 11],
  ['cola', 'Кола / лимонад', 42, 0, 0, 10.6],
  ['soda', 'Газированная вода сладкая (лимонад)', 42, 0, 0, 10.5],
  ['tonic', 'Тоник', 34, 0, 0, 8.5],
  ['energy', 'Энергетический напиток', 45, 0, 0, 11],
  ['kvass', 'Квас', 27, 0.2, 0, 5.2],
  ['icetea', 'Холодный чай сладкий', 30, 0, 0, 7.5],
  ['mors', 'Морс ягодный', 35, 0.1, 0, 8.8],
]
const VOLS = [150, 200, 250, 300, 400, 500].map(v => [v, v + ' мл'])
const drinkOf = () => DRINKS.find(d => d[0] === ddVal('dr-t')) || DRINKS[1]

function drinkPreview() {
  const el = document.getElementById('dr-prev')
  if (!el) return
  const d = drinkOf()
  const ml = Number(ddVal('dr-v')) || 250
  const k = (d[2] * ml) / 100
  setHtml(el, `В воду: <b>+${ml} мл</b>${k >= 1 ? ` · В еду: <b>${Math.round(k)} ккал</b> (углеводы ${r1((d[5] * ml) / 100)} г)` : ' · калорий нет'}`)
}
ins['dr-t'] = drinkPreview
ins['dr-v'] = drinkPreview

acts.openDrink = () => {
  openSheet(`
    <div class="sh-h"><b>Напиток</b><button class="icon" data-a="closeSheet">✕</button></div>
    <label>Что выпили</label>${dd('dr-t', DRINKS.map(d => [d[0], d[1]]), 'tea')}
    <label>Сколько</label>${dd('dr-v', VOLS, 250)}
    <div id="dr-prev" class="preview mt"></div>
    <div class="sub">Чай, кофе и другие напитки засчитываются в воду полностью: по данным исследований они гидратируют так же, как вода (Maughan, 2016; Killer, 2014), а слабое мочегонное действие кофеина при нагрузке не проявляется (Zhang, 2015). Молоко удерживает жидкость даже лучше воды. Калории от сахара и молока автоматически записываются в еду. Кофеина — не больше около 400 мг в сутки (примерно 4 чашки кофе).</div>
    <button class="btn full" data-a="addDrink">Добавить</button>`)
  drinkPreview()
}

acts.addDrink = () => {
  const d = drinkOf()
  const ml = Number(ddVal('dr-v')) || 250
  state.water[ctx.date] = (state.water[ctx.date] || 0) + ml
  const k = ml / 100
  if (d[2] * k >= 1) {
    ;(state.food[ctx.date] ||= []).push({
      t: Date.now(), drink: true, id: uid(), name: `${d[1]} ${ml} мл`, g: ml, kcal: d[2] * k, p: d[3] * k, f: d[4] * k, c: d[5] * k, meal: 's',
      b: { k: d[2], p: d[3], f: d[4], c: d[5] },
    })
  }
  save()
  closeSheet()
  toast(d[2] * k >= 1 ? 'Добавлено в воду и в еду' : 'Добавлено в воду')
  ctx.render()
}
