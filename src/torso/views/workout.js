import { state, save, today, uid } from '../store.js'
import { epley, bodyWeight, workoutKcal, goalInfo, goalDirection } from '../calc.js'
import { buildPlan } from '../data/plans.js'
import { EX, MUSCLES, WU, WARMUPS, LEVELS, listExercises, setKcal } from '../data/exercises.js'
import { setHtml, acts, ins, ctx, esc, num, r1, fmtNum, dateLabel, fmtTime, toast, openSheet, closeSheet, ask, dd, ddVal } from '../ui.js'
import { uid as newId } from '../store.js'
import { tt } from '../i18n/core.js'
import { INFO } from '../data/exinfo.js'

export function ensurePlan() {
  if (state.profile && !state.plan) {
    state.plan = buildPlan(state.profile.days, state.profile.level, goalDirection(state.profile))
    state.planVer = 4
    state.planAbFix = true
    if (!state.stepGoalCustom) state.stepGoal = goalInfo(state.profile.goal).steps
    save()
  }
  // Добавляем борьбу в уже созданный план, сохраняя пользовательские упражнения и расписание
  if (state.profile && state.plan && state.planVer !== 4) {
    const firstDay = state.plan[0]
    firstDay.warm ||= []
    if (!firstDay.warm.some(x => x.id === 'wrestletech')) firstDay.warm.push({ id: 'wrestletech', min: 30 })
    state.planVer = 4
    save()
  }
  // Скручивания на блоке заменяем прессом на наклонной скамье один раз, остальные правки плана сохраняем
  if (state.plan && !state.planAbFix) {
    for (const d of state.plan) for (const e of d.ex) if (e.id === 'cablecrunch') e.id = 'declsit'
    state.planAbFix = true
    save()
  }
}

// последняя выполненная тренировка с этим упражнением
function lastSets(exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const e = state.workouts[i].ex.find(x => x.id === exId)
    if (e && e.sets.length) return e.sets
  }
  return null
}

// «Двойная прогрессия»: все подходы достигли верха диапазона → прибавляем вес
function suggest(exId, lo, hi, nSets) {
  const prev = lastSets(exId)
  if (!prev) return { w: '', r: lo, prev: null, up: false }
  const best = prev.reduce((a, s) => (s.w > a.w ? s : a), prev[0])
  const allTop = prev.length >= Math.min(nSets, 2) && prev.every(s => s.r >= hi)
  const step = EX[exId]?.c ? 2.5 : 2
  if (allTop) return { w: r1(best.w + step), r: lo, prev, up: true }
  const reps = Math.min(hi, Math.max(...prev.map(s => s.r)) + (prev.every(s => s.r >= lo) ? 1 : 0))
  return { w: best.w, r: Math.max(lo, reps), prev, up: false }
}

// Совет по рабочему весу из ваших прошлых тренировок (нужно минимум 2 тренировки с этим упражнением и 3 всего)
function advice(exId, lo, hi) {
  if (state.workouts.length < 3) return ''
  const sess = state.workouts.map(wk => wk.ex.find(x => x.id === exId)).filter(e => e && e.sets.length)
  if (sess.length < 2) return ''
  const best = sess.slice(-2).map(e => Math.max(...e.sets.map(s => epley(s.w, s.r))))
  const rm = Math.max(...best)
  if (!(rm > 0)) return '' // упражнения с собственным весом
  lo = lo || 8
  hi = hi || 12
  const mid = Math.round((lo + hi) / 2)
  const step = EX[exId]?.c ? 2.5 : 1
  const w1 = Math.max(step, Math.round(rm / (1 + (mid + 2) / 30) / step) * step) // запас 2 повтора
  // Застой: три тренировки подряд без роста расчётного максимума — неделя разгрузки (−10% веса) и затем снова вверх
  const last3 = sess.slice(-3).map(e => Math.max(...e.sets.map(s => epley(s.w, s.r))))
  const stall = last3.length === 3 && last3[2] <= last3[0] ? ' ⚠️ Прогресса нет уже 3 тренировки: сделайте неделю разгрузки (вес −10%, на 1–2 подхода меньше), а затем снова добавляйте.' : ''
  return `<div class="advice">💡 Совет по вашим ${sess.length} тренировкам: начните с <b>${fmtNum(w1)} кг</b> и делайте ${lo}–${hi} повторов (работайте, оставляя в запасе 1–2 повтора). Ваш расчётный максимум на 1 повтор — ${fmtNum(Math.round(rm * 2) / 2)} кг. Когда во всех подходах выйдет ${hi} — прибавьте ${step === 2.5 ? '2,5' : '1'} кг.${stall}</div>`
}

function nextIdx() {
  const plan = state.plan || []
  // дни привязаны к дням недели — берём ближайший (сегодня или позже)
  if (plan.length && plan.every(d => d.dow)) {
    const dow = new Date().getDay()
    let best = 0
    let bd = 9
    plan.forEach((d, i) => { const k = (d.dow - dow + 7) % 7; if (k < bd) { bd = k; best = i } })
    return best
  }
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const w = state.workouts[i]
    if (w.planIdx != null && w.planName === plan[w.planIdx]?.name) return (w.planIdx + 1) % plan.length
  }
  return 0
}

const volume = w => w.ex.reduce((a, e) => a + e.sets.reduce((s, x) => s + x.w * x.r, 0), 0)

function historyHtml() {
  const list = [...state.workouts].reverse().slice(0, 10)
  if (!list.length) return ''
  return `<h3>История</h3>` + list.map(w => `<div class="card hist">
    <div><b>${esc(w.name)}</b><div class="sub">${dateLabel(w.date)} · ${w.ex.reduce((a, e) => a + e.sets.length, 0)} подходов · ${Math.round(volume(w))} кг объём${w.dur ? ' · ' + Math.round(w.dur / 60) + ' мин' : ''}</div>
    <div class="sub">${(w.warm || []).length ? 'Разминка: ' + w.warm.map(x => `${esc(WU[x.id]?.n || x.id)} ${x.min} мин`).join(', ') + '. ' : ''}${w.ex.map(e => esc(EX[e.id]?.n || e.id)).join(', ')}</div></div>
    <button class="x" data-a="delWorkout" data-id="${w.id}" aria-label="Удалить">✕</button></div>`).join('')
}

export function renderWorkout() {
  ensurePlan()
  if (state.active) return renderActive()
  if (ctx.wsub === 'plan') return renderPlanEdit()
  const plan = state.plan || []
  const ni = nextIdx()
  const days = plan.map((d, i) => `<div class="card day ${i === ni ? 'next' : ''}">
    <div class="row-h"><b>${esc(d.name)}</b>${i === ni ? `<span class="tag">${d.dow === new Date().getDay() ? 'сегодня' : 'ближайшая'}</span>` : ''}</div>
    <div class="sub">Разминка: ${(d.warm || []).map(x => `${x.post ? 'после: ' : ''}${esc(WU[x.id]?.n || x.id)} ${x.min} мин`).join(', ') || '—'}</div>
    <div class="sub">${d.ex.map(e => esc(EX[e.id]?.n || e.id)).join(' · ')}</div>
    <button class="btn ${i === ni ? '' : 'ghost'} full" data-a="startDay" data-i="${i}">Начать тренировку</button>
  </div>`).join('')
  return `
  <h2>Тренировка</h2>
  <div class="sub mb">План по вашему профилю: ${state.profile.days} трен./нед.</div>
  <div class="card verdict ok"><div class="v-t">🎯 Цель: ${goalInfo(state.profile.goal).title}</div><p>${esc(goalInfo(state.profile.goal).plan)}</p></div>
  ${days}
  <div class="row2"><button class="btn ghost" data-a="startEmpty">Пустая тренировка</button><button class="btn ghost" data-a="editPlan">Изменить план</button></div>
  ${historyHtml()}`
}

// ---------- активная тренировка ----------
function setRow(ei, si, s) {
  return `<div class="set ${s.done ? 'done' : ''}">
    <span class="sn">${si + 1}</span>
    <input type="text" inputmode="decimal" placeholder="кг" value="${s.w}" data-in="setw" data-e="${ei}" data-s="${si}"/>
    <input type="text" inputmode="numeric" placeholder="${s.tr || 'повт'}" value="${s.r}" data-in="setr" data-e="${ei}" data-s="${si}"/>
    <button class="tick ${s.done ? 'on' : ''}" data-a="tick" data-e="${ei}" data-s="${si}" aria-label="Готово">✓</button>
  </div>`
}

function liveKcal(a) {
  const wt = bodyWeight()
  const lift = a.ex.reduce((s, e) => s + e.sets.filter(x => x.done).length * setKcal(e.id, wt), 0)
  const warm = (a.warm || []).filter(x => x.done).reduce((s, x) => s + (((WU[x.id]?.met || 5) - 1) * wt * x.min) / 60, 0)
  return lift + warm
}

function infoBtn(id) {
  return `<span class="exi" role="button" data-a="exInfo" data-id="${id}" aria-label="Описание упражнения">i</span>`
}

function renderActive() {
  const a = state.active
  const cards = a.ex.map((e, ei) => {
    const ex = EX[e.id]
    const prev = e.prev
    const hint = prev
      ? `Прошлый раз: ${prev.map(s => `${fmtNum(s.w)}×${s.r}`).join(', ')}`
      : 'Раньше не делали — подберите вес, с которым получится ' + (e.lo || 8) + ' повторов'
    const goal = e.up
      ? `<span class="tag good">Пора прибавить вес: цель ${fmtNum(e.sw)} кг × ${e.lo}+</span>`
      : (e.sw !== '' && e.sw != null ? `<span class="tag">Цель: ${fmtNum(e.sw)} кг × ${e.sr}</span>` : '')
    return `<div class="card ex">
      <div class="row-h"><b>${esc(ex?.n || e.id)} ${infoBtn(e.id)}</b><button class="x" data-a="delEx" data-e="${ei}" aria-label="Убрать">✕</button></div>
      <div class="sub">${e.lo ? `План: ${e.sets.length} × ${e.lo}–${e.hi}` : ''} ${MUSCLES[ex?.m] ? '· ' + MUSCLES[ex.m] : ''} · ≈ ${Math.round(setKcal(e.id, bodyWeight()))} ккал/подход</div>
      <div class="sub">${hint}</div>${goal}${advice(e.id, e.lo, e.hi)}
      <div class="set head"><span></span><span>Вес, кг</span><span>Повторы</span><span></span></div>
      ${e.sets.map((s, si) => setRow(ei, si, s)).join('')}
      <button class="add" data-a="addSet" data-e="${ei}">＋ Подход</button>
    </div>`
  }).join('')
  const wuRow = (x, wi) => `<div class="wu ${x.done ? 'done' : ''}"><span class="wu-n">${esc(WU[x.id]?.n || x.id)} ${infoBtn(x.id)}</span><input class="mini" type="text" inputmode="numeric" value="${x.min}" data-in="wmin" data-w="${wi}"/><button class="tick ${x.done ? 'on' : ''}" data-a="wtick" data-w="${wi}" aria-label="Готово">✓</button><button class="x" data-a="wdel" data-w="${wi}" aria-label="Убрать">✕</button></div>`
  const wl = (a.warm || []).map((x, wi) => [x, wi])
  const warmCard = `<div class="card"><div class="row-h"><b>Разминка</b><span class="sub">минуты</span></div>
    ${wl.filter(([x]) => !x.post).map(([x, wi]) => wuRow(x, wi)).join('')}
    <button class="add" data-a="pickWarmA">＋ Скакалка, бег, борьба…</button>
    <div class="sub mt">Перед первым упражнением сделайте 1–2 разминочных подхода с 50% рабочего веса.</div></div>`
  const postItems = wl.filter(([x]) => x.post)
  const postCard = postItems.length || state.profile.goal === 'cut'
    ? `<div class="card"><div class="row-h"><b>Кардио после тренировки</b><span class="sub">минуты</span></div>${postItems.map(([x, wi]) => wuRow(x, wi)).join('')}<button class="add" data-a="pickWarmP">＋ Кардио</button></div>` : ''
  return `
  <div class="wk-top"><div><b>${esc(a.name)}</b><div class="sub"><span id="wk-time">${fmtTime((Date.now() - a.start) / 1000)}</span> · ≈ <span id="wk-kcal">${Math.round(liveKcal(a))}</span> ккал</div></div>
  <button class="btn" data-a="finish">Завершить</button></div>
  ${warmCard}
  ${cards}
  ${postCard}
  <button class="btn ghost full" data-a="pickEx" data-mode="active">＋ Добавить упражнение</button>
  <button class="btn danger full" data-a="cancelWk">Отменить тренировку</button>`
}

function startFrom(name, planIdx, list, warm = []) {
  const ex = list.map(p => {
    const sg = suggest(p.id, p.lo, p.hi, p.sets)
    return {
      id: p.id, lo: p.lo, hi: p.hi, prev: sg.prev, up: sg.up, sw: sg.w, sr: sg.r,
      sets: Array.from({ length: p.sets }, () => ({ w: sg.w === '' ? '' : sg.w, r: '', tr: sg.r, done: false })),
    }
  })
  state.active = { id: uid(), date: today(), name, planIdx, planName: name, start: Date.now(), ex, warm: warm.map(x => ({ id: x.id, min: x.min, post: !!x.post, done: false })) }
  save()
  ctx.render()
}

acts.startDay = ({ i }) => { const d = state.plan[Number(i)]; startFrom(d.name, Number(i), d.ex, d.warm) }
acts.startEmpty = () => startFrom('Свободная тренировка', null, [])

acts.wtick = ({ w }) => { const x = state.active.warm[Number(w)]; x.done = !x.done; save(); ctx.render() }
ins.wmin = el => { const v = parseInt(el.value, 10); if (v > 0) { state.active.warm[+el.dataset.w].min = v; save() } }
acts.wdel = ({ w }) => { state.active.warm.splice(Number(w), 1); save(); ctx.render() }
acts.pickWarm = () => {
  openSheet(`<div class="sh-h"><b>Разминка / кардио</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="fres">${WARMUPS.map(x => `<button class="fr" data-a="addWarm" data-id="${x.id}"><span>${esc(x.n)}</span><em>${x.min} мин · ≈${x.met} MET</em></button>`).join('')}</div>`)
}
acts.addWarm = ({ id }) => {
  if (ctx.wday != null) state.plan[ctx.wday].warm.push({ id, min: WU[id].min, post: !!ctx.wpost })
  else state.active.warm.push({ id, min: WU[id].min, post: !!ctx.wpost, done: false })
  ctx.wday = null
  ctx.wpost = false
  save()
  closeSheet()
  ctx.render()
}
acts.pwAdd = ({ d }) => { ctx.wday = Number(d); ctx.wpost = false; acts.pickWarm() }
acts.pwAddP = ({ d }) => { ctx.wday = Number(d); ctx.wpost = true; acts.pickWarm() }
acts.pwDel = ({ d, x }) => { state.plan[Number(d)].warm.splice(Number(x), 1); save(); ctx.render() }

acts.tick = ({ e, s }) => {
  const set = state.active.ex[Number(e)].sets[Number(s)]
  if (!set.done) {
    if (set.r === '' && set.tr) set.r = set.tr // не ввели повторы — считаем по цели
    if (!(num(set.r) > 0) || !(num(set.w) >= 0)) return toast('Введите вес и повторы')
    set.done = true
    const ex = EX[state.active.ex[Number(e)].id]
    const t = ex?.c ? 120 : 75
    ctx.rest = { end: Date.now() + t * 1000, total: t }
  } else {
    set.done = false
  }
  save()
  ctx.render()
}

ins.setw = el => { state.active.ex[+el.dataset.e].sets[+el.dataset.s].w = el.value; save() }
ins.setr = el => { state.active.ex[+el.dataset.e].sets[+el.dataset.s].r = el.value; save() }

acts.addSet = ({ e }) => {
  const ex = state.active.ex[Number(e)]
  const last = ex.sets[ex.sets.length - 1]
  ex.sets.push({ w: last ? last.w : '', r: '', tr: last?.tr, done: false })
  save()
  ctx.render()
}

acts.delEx = async ({ e }) => {
  if (!(await ask('Убрать упражнение из тренировки?', 'Убрать', true))) return
  state.active.ex.splice(Number(e), 1)
  save()
  ctx.render()
}

acts.cancelWk = async () => {
  if (!(await ask('Отменить тренировку? Записанные подходы пропадут.', 'Отменить тренировку', true))) return
  state.active = null
  ctx.rest = null
  save()
  ctx.render()
}

acts.finish = () => {
  const a = state.active
  const done = a.ex
    .map(e => ({ id: e.id, sets: e.sets.filter(s => s.done).map(s => ({ w: num(s.w), r: num(s.r) })) }))
    .filter(e => e.sets.length)
  const warm = (a.warm || []).filter(x => x.done).map(x => ({ id: x.id, min: x.min }))
  if (!done.length && !warm.length) {
    ask('Не отмечено ни одного подхода. Отменить тренировку?', 'Отменить', true).then(ok => { if (ok) { state.active = null; ctx.rest = null; save(); ctx.render() } })
    return
  }
  // рекорды: сравниваем расчётный 1ПМ с прошлыми тренировками
  const prs = []
  for (const e of done) {
    const past = state.workouts.flatMap(w => w.ex.filter(x => x.id === e.id).flatMap(x => x.sets))
    const oldBest = past.length ? Math.max(...past.map(s => epley(s.w, s.r))) : 0
    const newBest = Math.max(...e.sets.map(s => epley(s.w, s.r)))
    if (oldBest && newBest > oldBest + 0.01 && newBest > 0) prs.push(EX[e.id]?.n || e.id)
  }
  const w = { id: a.id, date: a.date, name: a.name, planIdx: a.planIdx, planName: a.planName, dur: (Date.now() - a.start) / 1000, ex: done, warm }
  state.workouts.push(w)
  state.active = null
  ctx.rest = null
  save()
  openSheet(`
    <div class="sh-h"><b>Тренировка завершена 💪</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="stats3"><div><b>${Math.round(w.dur / 60)}</b><span>минут</span></div><div><b>${done.reduce((s, e) => s + e.sets.length, 0)}</b><span>подходов</span></div><div><b>≈${Math.round(workoutKcal(w))}</b><span>ккал (оценка)</span></div></div>
    <div class="sub">Калории — примерная оценка по длительности, массе тела и MET. Для борьбы фактический расход может заметно отличаться.</div><div class="sub">Объём: ${Math.round(volume(w))} кг (вес × повторы).</div>
    ${prs.length ? `<div class="card verdict ok"><div class="v-t">🏆 Новые рекорды</div><p>${prs.map(esc).join(', ')}</p></div>` : ''}
    <p class="sub">Не забудьте про белок и сон — именно сейчас мышцы начинают восстанавливаться.</p>
    <button class="btn full" data-a="closeSheet">Отлично</button>`)
  ctx.render()
}

acts.delWorkout = async ({ id }) => {
  if (!(await ask('Удалить тренировку из истории?', 'Удалить', true))) return
  state.workouts = state.workouts.filter(w => w.id !== id)
  save()
  ctx.render()
}

// ---------- выбор упражнения ----------
function pickerList(q) {
  const t = q.trim().toLowerCase().replace(/ё/g, 'е')
  const wt = bodyWeight()
  const all = listExercises()
  return Object.entries(MUSCLES).map(([m, name]) => {
    const items = all.filter(e => e.m === m && (!t || e.n.toLowerCase().replace(/ё/g, 'е').includes(t) || tt(e.n).toLowerCase().includes(t)))
    return items.length ? `<div class="grp">${name}</div>` + items.map(e => `<button class="fr" data-a="choose" data-id="${e.id}"><span>${esc(e.n)} ${infoBtn(e.id)}</span><em>≈ ${Math.round(setKcal(e.id, wt))} ккал/подход</em></button>`).join('') : ''
  }).join('') || '<div class="empty">Ничего не найдено — создайте своё упражнение.</div>'
}

acts.pickEx = ({ mode, day }) => {
  ctx.pick = { mode, day }
  openSheet(`
    <div class="sh-h"><b>Выберите упражнение</b><button class="icon" data-a="closeSheet">✕</button></div>
    <input id="exq" type="search" placeholder="Поиск" autocomplete="off"/>
    <div id="exres" class="fres">${pickerList('')}</div>
    <button class="btn ghost full" data-a="newEx">＋ Своё упражнение</button>`)
}
ins.exq = el => { setHtml(document.getElementById('exres'), pickerList(el.value)) }

acts.choose = ({ id }) => {
  const { mode, day } = ctx.pick
  if (mode === 'active') {
    const sg = suggest(id, 8, 12, 3)
    state.active.ex.push({ id, lo: 8, hi: 12, prev: sg.prev, up: sg.up, sw: sg.w, sr: sg.r, sets: Array.from({ length: 3 }, () => ({ w: sg.w, r: '', tr: sg.r, done: false })) })
  } else {
    state.plan[Number(day)].ex.push({ id, sets: 3, lo: 8, hi: 12 })
  }
  save()
  closeSheet()
  ctx.render()
}

// ---------- редактор плана ----------
function renderPlanEdit() {
  const days = state.plan.map((d, di) => `<div class="card">
    <div class="row-h"><b>${esc(d.name)}</b></div>
    <div class="sub">Разминка: ${(d.warm || []).map((x, xi) => `${x.post ? 'после: ' : ''}${esc(WU[x.id]?.n || x.id)} ${x.min} мин <button class="link" data-a="pwDel" data-d="${di}" data-x="${xi}">убрать</button>`).join('; ') || '—'} <button class="link" data-a="pwAdd" data-d="${di}">＋ разминка</button> <button class="link" data-a="pwAddP" data-d="${di}">＋ кардио после</button></div>
    ${d.ex.map((e, ei) => `<div class="pe">
      <div class="pe-n">${esc(EX[e.id]?.n || e.id)} ${infoBtn(e.id)}</div>
      <input class="mini" type="text" inputmode="numeric" value="${e.sets}" data-in="pe" data-f="sets" data-d="${di}" data-e="${ei}"/><span>×</span>
      <input class="mini" type="text" inputmode="numeric" value="${e.lo}" data-in="pe" data-f="lo" data-d="${di}" data-e="${ei}"/><span>–</span>
      <input class="mini" type="text" inputmode="numeric" value="${e.hi}" data-in="pe" data-f="hi" data-d="${di}" data-e="${ei}"/>
      <button class="x" data-a="peDel" data-d="${di}" data-e="${ei}" aria-label="Убрать">✕</button></div>`).join('')}
    <button class="add" data-a="pickEx" data-mode="plan" data-day="${di}">＋ Упражнение</button>
  </div>`).join('')
  return `<div class="datebar"><button class="icon" data-a="planBack">‹</button><b>Изменить план</b><span></span></div>
  <div class="sub mb">Формат: подходы × повторы от–до. Изменения сохраняются сразу.</div>${days}
  <button class="btn ghost full" data-a="planReset">Пересоздать план по профилю</button>`
}
ins.pe = el => {
  const v = parseInt(el.value, 10)
  if (v > 0) { state.plan[+el.dataset.d].ex[+el.dataset.e][el.dataset.f] = v; save() }
}
acts.editPlan = () => { ctx.wsub = 'plan'; ctx.render() }
acts.planBack = () => { ctx.wsub = null; ctx.render() }
acts.peDel = ({ d, e }) => { state.plan[Number(d)].ex.splice(Number(e), 1); save(); ctx.render() }
acts.planReset = async () => {
  if (!(await ask('Заменить ваш план стандартным по профилю? Ваши правки пропадут.', 'Заменить', true))) return
  state.plan = buildPlan(state.profile.days, state.profile.level, goalDirection(state.profile))
  state.planVer = 4
  save()
  ctx.render()
}
acts.pickWarmA = () => { ctx.wday = null; ctx.wpost = false; acts.pickWarm() }
acts.pickWarmP = () => { ctx.wday = null; ctx.wpost = true; acts.pickWarm() }

// ---------- своё упражнение ----------
acts.newEx = () => {
  openSheet(`
    <div class="sh-h"><b>Своё упражнение</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sub">Уровень нагрузки определяет расход калорий и время отдыха. Лёгкая — тренажёры и изоляция (3,5 MET), средняя — базовые со свободным весом (5 MET), тяжёлая — приседания и тяги (6 MET).</div>
    <label>Название<input id="ne-n" type="text"/></label>
    <label>Группа мышц</label>${dd('ne-m', Object.entries(MUSCLES), 'chest')}
    <label>Уровень нагрузки</label>${dd('ne-l', Object.entries(LEVELS).map(([k, v]) => [k, v.t]), 'iso')}
    <button class="btn full" data-a="saveEx">Сохранить</button>`)
}
acts.saveEx = () => {
  const n = document.getElementById('ne-n').value.trim()
  if (!n) return toast('Введите название')
  const ex = { id: 'u' + newId(), n, m: ddVal('ne-m'), l: ddVal('ne-l') }
  state.customEx.push(ex)
  save()
  acts.choose({ id: ex.id })
}

// ---------- описание упражнения ----------
acts.exInfo = ({ id }) => {
  const wu = WU[id]
  const ex = EX[id] || (wu ? { n: wu.n, m: null, l: null, wu } : null)
  if (!ex) return
  const info = INFO[id]
  const lv = LEVELS[ex.l] || LEVELS.comp
  const kc = ex.wu ? Math.round(((ex.wu.met - 1) * bodyWeight() * ex.wu.min) / 60) : Math.round(setKcal(id, bodyWeight()))
  const steps = info ? info[1].split('|').map(s => `<li>${esc(s)}</li>`).join('') : ''
  openSheet(`
    <div class="sh-h"><b>${esc(ex.n)}</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="tags">${ex.wu ? `<span class="tag">Разминка / кардио</span><span class="tag">≈ ${kc} ккал за ${ex.wu.min} мин</span>` : `<span class="tag">${esc(MUSCLES[ex.m] || '')}</span><span class="tag">${esc(lv.t)}</span><span class="tag">≈ ${kc} ккал/подход</span>`}</div>
    ${info ? `<div class="srow"><span>Работают</span><span class="r">${esc(info[0])}</span></div>
    <h3>${ex.wu ? 'Как выполнять' : 'Как делать'}</h3><ol class="steps">${steps}</ol>
    <div class="card verdict info inner"><div class="v-t">Важно</div><p>${esc(info[2])}</p></div>` : '<p class="sub">Это ваше упражнение: описание не добавлено.</p>'}
    <p class="sub">Начинайте с лёгкого веса, пока не освоите технику. При острой боли в суставе остановитесь.</p>
    <button class="btn full" data-a="closeSheet">Понятно</button>`)
}
