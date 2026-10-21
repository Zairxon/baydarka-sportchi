import { state, save, today, addDays, diffDays } from '../store.js'
import { dayBurn, targets, latestWeight, movingAvg, weightRate, trendAdvice, sumFood, goalProgress, epley, bmi } from '../calc.js'
import { EX } from '../data/exercises.js'
import { acts, ins, ctx, dd, esc, num, r1, fmtNum, dateLabel, lineChart, barChart, toast } from '../ui.js'

const DAYNAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function weightCard() {
  const t = today()
  const pts = Object.entries(state.weights)
    .filter(([d]) => diffDays(t, d) <= 90)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, w]) => ({ x: -diffDays(t, d), y: w, d }))
  const cur = latestWeight()
  let body
  if (!pts.length) {
    body = '<div class="empty">Взвешивайтесь утром и вводите вес на вкладке «Сегодня» или ниже.</div>'
  } else {
    const avg = movingAvg(pts, 7)
    const xl = [{ x: pts[0].x, t: dateLabel(pts[0].d), a: 'start' }]
    if (pts.length > 1) xl.push({ x: pts[pts.length - 1].x, t: dateLabel(pts[pts.length - 1].d), a: 'end' })
    body = lineChart([
      { pts, color: 'var(--muted)', dots: true },
      { pts: avg, color: 'var(--accent)' },
    ], { xLabels: xl })
  }
  const rate = weightRate()
  const adv = trendAdvice()
  const first = pts.length ? pts[0] : null
  const stats = pts.length ? `<div class="stats3">
    <div><b>${fmtNum(cur)}</b><span>кг сейчас</span></div>
    <div><b>${first && pts.length > 1 ? (cur - first.y > 0 ? '+' : '') + fmtNum(cur - first.y) : '—'}</b><span>с ${first ? dateLabel(first.d) : ''}</span></div>
    <div><b>${rate == null ? '—' : (rate > 0 ? '+' : '') + rate.toFixed(2).replace('.', ',')}</b><span>кг / неделю</span></div></div>` : ''
  const p = state.profile
  const target = goalProgress(p, cur)
  const b = cur ? `ИМТ ${fmtNum(bmi(cur, p.height))}` : ''
  return `<div class="card">
    <div class="row-h"><b>Вес</b><span class="sub">${b}</span></div>
    ${stats}${target ? `<div class="card verdict info inner"><div class="v-t">🎯 Целевой вес</div><p>${target.text}</p></div>` : ''}${body}
    <div class="legend"><span><i style="background:var(--muted)"></i>ежедневно</span><span><i style="background:var(--accent)"></i>среднее за 7 дней</span></div>
    ${adv ? `<div class="card verdict ${adv.adj ? 'info' : 'ok'} inner"><div class="v-t">📈 Темп и калории</div><p>${esc(adv.text)}</p>${adv.adj ? `<button class="btn" data-a="applyAdj" data-adj="${adv.adj}">${adv.adj > 0 ? 'Добавить' : 'Убрать'} ${Math.abs(adv.adj)} ккал в норме</button>` : ''}</div>`
      : '<p class="sub">Через 2 недели ежедневных взвешиваний я оценю темп и подскажу, нужно ли менять калории.</p>'}
    <div class="inline"><input id="pw" type="text" inputmode="decimal" placeholder="Вес сегодня, кг" value="${state.weights[today()] ?? ''}"/><button class="btn" data-a="saveW2">Сохранить</button></div>
  </div>`
}

function kcalCard() {
  const t = targets()
  const bars = []
  let eatenDays = 0
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today(), -i)
    const [y, m, dd] = d.split('-').map(Number)
    const s = sumFood(d)
    if (s.kcal) eatenDays++
    bars.push({ v: Math.round(s.kcal), l: DAYNAMES[new Date(y, m - 1, dd).getDay()], cls: s.kcal > t.kcal * 1.1 ? 'over' : '' })
  }
  const avg = bars.filter(b => b.v).reduce((a, b) => a + b.v, 0) / (eatenDays || 1)
  const verdict = eatenDays < 3 ? 'Записывайте еду хотя бы 3–4 дня в неделю — тогда картина будет честной.'
    : Math.abs(avg - t.kcal) / t.kcal <= 0.1 ? 'В среднем вы укладываетесь в норму — отлично.'
      : avg > t.kcal ? `В среднем на ${Math.round(avg - t.kcal)} ккал выше нормы.` : `В среднем на ${Math.round(t.kcal - avg)} ккал ниже нормы — для роста мышц нужно есть больше.`
  return `<div class="card"><div class="row-h"><b>Калории за 7 дней</b><span class="sub">норма ${t.kcal}</span></div>
    ${barChart(bars, { target: t.kcal })}<p class="sub">${verdict}</p></div>`
}

function strengthCard() {
  const ids = [...new Set(state.workouts.flatMap(w => w.ex.map(e => e.id)))]
  if (!ids.length) return `<div class="card"><b>Силовой прогресс</b><div class="empty">Проведите первую тренировку — здесь появятся графики по каждому упражнению.</div></div>`
  if (!ctx.exSel || !ids.includes(ctx.exSel)) ctx.exSel = ids[0]
  const id = ctx.exSel
  const sessions = state.workouts
    .map(w => ({ w, e: w.ex.find(x => x.id === id) }))
    .filter(x => x.e)
    .map(({ w, e }) => {
      const best = e.sets.reduce((a, s) => (epley(s.w, s.r) > epley(a.w, a.r) ? s : a), e.sets[0])
      return { d: w.date, rm: epley(best.w, best.r), best, sets: e.sets }
    })
  const t = today()
  const pts = sessions.map(s => ({ x: -diffDays(t, s.d), y: r1(s.rm) }))
  const first = sessions[0]
  const last = sessions[sessions.length - 1]
  const gain = last.rm - first.rm
  const xl = [{ x: pts[0].x, t: dateLabel(first.d), a: 'start' }]
  if (pts.length > 1) xl.push({ x: pts[pts.length - 1].x, t: dateLabel(last.d), a: 'end' })
  return `<div class="card"><div class="row-h"><b>Силовой прогресс</b></div>
    ${dd('exsel', ids.map(i => [i, EX[i]?.n || i]), id)}
    <div class="sub mt">Расчётный максимум на 1 повтор (1ПМ) по лучшему подходу тренировки</div>
    ${lineChart([{ pts, color: 'var(--accent)', dots: true }], { xLabels: xl })}
    <div class="stats3"><div><b>${fmtNum(last.rm)}</b><span>кг 1ПМ сейчас</span></div><div><b>${gain >= 0 ? '+' : ''}${fmtNum(gain)}</b><span>с первой</span></div><div><b>${sessions.length}</b><span>тренировок</span></div></div>
    ${sessions.slice(-4).reverse().map(s => `<div class="srow"><span>${dateLabel(s.d)}</span><span>${s.sets.map(x => `${fmtNum(x.w)}×${x.r}`).join('  ')}</span></div>`).join('')}
  </div>`
}

function trainingCard() {
  const weeks = []
  const t = today()
  for (let i = 5; i >= 0; i--) {
    const from = addDays(t, -i * 7 - 6)
    const to = addDays(t, -i * 7)
    const ws = state.workouts.filter(w => w.date >= from && w.date <= to)
    weeks.push({ v: ws.length, l: i === 0 ? 'эта' : `-${i}н`, cls: '' })
  }
  const total = state.workouts.length
  const goal = state.profile.days
  const thisWeek = weeks[weeks.length - 1].v
  return `<div class="card"><div class="row-h"><b>Тренировки по неделям</b><span class="sub">цель: ${goal} в неделю</span></div>
    ${barChart(weeks, { target: goal })}
    <p class="sub">На этой неделе: ${thisWeek} из ${goal}. Всего тренировок: ${total}.</p></div>`
}

const MEAS = [['height', 'Рост'], ['arm', 'Бицепс'], ['chest', 'Грудь'], ['waist', 'Талия'], ['thigh', 'Бедро'], ['neck', 'Шея'], ['calf', 'Голень']]

function measCard() {
  const list = state.meas
  const first = list[0]
  const last = list[list.length - 1]
  const rows = list.length
    ? MEAS.filter(([k]) => last[k]).map(([k, n]) => {
      const f = list.find(m => m[k])
      const diff = last[k] - f[k]
      return `<div class="srow"><span>${n}</span><span><b>${fmtNum(last[k])} см</b> ${list.length > 1 && f !== last ? `<em class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${fmtNum(diff)}</em>` : ''}</span></div>`
    }).join('')
    : '<div class="empty">Раз в 2 недели измеряйте сантиметром — это показывает то, чего не видно по весам.</div>'
  return `<div class="card"><div class="row-h"><b>Замеры тела</b>${first ? `<span class="sub">с ${dateLabel(first.date)}</span>` : ''}</div>
    ${rows}
    <div class="grid3">${MEAS.map(([k, n]) => `<label>${n}<input id="m-${k}" type="text" inputmode="decimal"/></label>`).join('')}</div>
    <button class="btn full" data-a="saveMeas">Сохранить замеры</button></div>`
}

function stepsCard() {
  const bars = []
  let tot = 0
  let kc = 0
  let days = 0
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today(), -i)
    const b = dayBurn(d)
    if (b.steps) { tot += b.steps; kc += b.total; days++ }
    bars.push({ v: b.steps, l: String(Number(d.slice(8))), cls: '' })
  }
  const goal = state.stepGoal || 10000
  return `<div class="card"><div class="row-h"><b>Шаги за 14 дней</b><span class="sub">цель ${goal}</span></div>
    ${barChart(bars, { target: goal })}
    <p class="sub">${days ? `В среднем ${Math.round(tot / days)} шагов и ${Math.round(kc / days)} ккал активного расхода в день.` : 'Шаги считаются автоматически по датчику телефона.'}</p></div>`
}

export function renderProgress() {
  return `<h2>Прогресс</h2>${weightCard()}${kcalCard()}${stepsCard()}${measCard()}`
}

acts.saveW2 = () => {
  const v = num(document.getElementById('pw').value)
  if (!(v >= 25 && v <= 300)) return toast('Введите вес в кг, например 72,5')
  state.weights[today()] = r1(v)
  save()
  toast('Вес сохранён')
  ctx.render()
}

acts.applyAdj = ({ adj }) => {
  state.profile.kcalAdj = (state.profile.kcalAdj || 0) + Number(adj)
  save()
  toast('Норма калорий обновлена: ' + targets().kcal + ' ккал')
  ctx.render()
}

acts.saveMeas = () => {
  const m = { date: today() }
  let any = false
  for (const [k] of MEAS) {
    const v = num(document.getElementById('m-' + k).value)
    if (v > 0) { m[k] = r1(v); any = true }
  }
  if (!any) return toast('Введите хотя бы один замер')
  state.meas = state.meas.filter(x => x.date !== m.date)
  state.meas.push(m)
  state.meas.sort((a, b) => (a.date < b.date ? -1 : 1))
  save()
  toast('Замеры сохранены')
  ctx.render()
}

ins.exsel = el => { ctx.exSel = el.value; ctx.render() }
