import { S, saveDrafts, saveSettings, catById, lastLogFor, makeExtra } from './state.js'
import { store } from './store.js'
import { queue } from './api.js'
import { esc, num, uuid, formatDuration, parseDuration, validPulse } from './util.js'
import { pulseFlow, timerFlow, restStart } from './flows.js'
import { fatigueCheck } from './advice.js'
import { history, suggest, advice, bestRm, epley, MUSCLES, LEVELS } from './gym.js'
import { toast, openSheet } from './ui.js'
import { tr, exName, exInfo } from './i18n.js'

// Карточка упражнения в стиле Торсо: название, «i» с техникой, план тренера, подходы с галочкой,
// затем замер пульса и «Сохранить». Типы ввода:
//   weight — вес и повторы;  reps — повторы;  timed — повторы за заданное время;
//   water — время каждого отрезка;  time — время (в игровой день — минуты);  phases — части тренажёра.

const isMinutes = (s, x) => x.mode === 'time' && s.kind === 'game'

export function planText(x, s) {
  const p = x.plan || {}
  const t = formatDuration
  if (x.mode === 'weight') return [p.sets && p.reps ? `${p.sets} × ${p.reps}` : p.reps ? `${p.reps} marta` : '', p.weight ? `${p.weight} kg` : ''].filter(Boolean).join(' · ')
  if (x.mode === 'reps') return p.reps ? `${p.sets || 1} × ${p.reps}` : ''
  if (x.mode === 'timed') return [p.sets > 1 ? `${p.sets} marta` : '', p.time ? `har biri ${t(p.time)}` : ''].filter(Boolean).join(' · ')
  if (x.mode === 'water') return [p.segments ? `${p.segments} otrezok` : '', p.distance ? `${p.distance} m` : ''].filter(Boolean).join(' × ')
  if (x.mode === 'time') return p.time ? (s?.kind === 'game' ? `${Math.round(p.time / 60)} daq` : t(p.time)) : ''
  if (x.mode === 'phases') {
    const total = (p.phases || []).reduce((a, f) => a + f.sec, 0)
    return (p.phases || []).map(f => `${f.name} ${t(f.sec)}`).join(' + ') + (total ? ` · Jami ${t(total)}` : '')
  }
  return ''
}

const emptySet = (x, i, sug) => {
  const p = x.plan || {}
  if (x.mode === 'weight') return { w: sug?.w !== '' && sug?.w != null ? String(sug.w) : (p.weight != null ? String(p.weight) : ''), r: '', done: false }
  if (x.mode === 'timed') return { r: '', t: p.time || 60, done: false }
  if (x.mode === 'water' || x.mode === 'time') return { t: '', done: false, n: i + 1 }
  return { r: '', done: false }
}

// Сколько подходов по плану и диапазон повторов для двойной прогрессии.
const planSets = x => {
  const p = x.plan || {}
  return x.mode === 'water' ? p.segments || 1 : x.mode === 'time' ? 1 : p.sets || (x.extra ? 3 : 1)
}

function initialSets(x, log, sug) {
  if (x.mode === 'phases') {
    const ph = log?.detail?.sets?.length ? log.detail.sets.map(f => ({ name: f.phase, sec: f.t })) : (x.plan?.phases || [])
    return ph.map((f, i) => ({ name: f.name, sec: f.sec, r: log?.detail?.sets?.[i]?.r != null ? String(log.detail.sets[i].r) : '', done: !!log }))
  }
  if (log?.detail?.sets?.length) {
    return log.detail.sets.map(s => ({ ...s, w: s.w != null ? String(s.w) : '', r: s.r != null ? String(s.r) : '', t: x.mode === 'water' || x.mode === 'time' ? (s.t != null ? formatDuration(s.t) : '') : s.t, done: true }))
  }
  return Array.from({ length: planSets(x) }, (_, i) => emptySet(x, i, sug))
}

export function ensureDraft(s, x) {
  let d = S.drafts[x.sx]
  if (!d) {
    const log = lastLogFor(x.sx)
    const sug = gymInfo(s, x)?.sug
    d = S.drafts[x.sx] = { id: log?.id || uuid(), sets: initialSets(x, log, sug) }
    if (log?.heart_rate) { d.hr1 = log.heart_rate; d.hr2 = log.recovery_hr; d.locked = true }
    saveDrafts()
  }
  return d
}

// Подсказки зала: прошлые подходы, цель по двойной прогрессии, совет по весу.
function gymInfo(s, x) {
  if (s.kind !== 'gym' || x.mode !== 'weight') return null
  const hist = history(S.plan.logs, x.ex, s.id)
  const cat = catById.get(x.ex)
  const comp = cat?.level === 'comp' || cat?.level === 'heavy'
  const lo = x.plan?.reps || 8, hi = x.plan?.reps || 12
  const sug = suggest(hist, lo, hi, planSets(x), comp)
  const days = new Set(S.plan.logs.filter(l => l.detail?.sets?.some(t => t.w != null)).map(l => l.logged_on)).size
  return { hist, sug, adv: advice(hist, days, lo, hi, comp), cat, lo, hi }
}

export function cardHtml(s, x) {
  const d = ensureDraft(s, x)
  const log = lastLogFor(x.sx)
  const sets = d.sets
  const g = gymInfo(s, x)
  const hr = d.hr1 != null ? { hr1: d.hr1, hr2: d.hr2 } : null
  const saved = !!log?.heart_rate
  const anyDone = sets.some(t => t.done)
  const boat = S.me?.boat || S.plan.boat || S.settings.boat
  const strokeWord = x.count === 'stroke' ? 'Zarba' : 'Marta'
  const head = x.mode === 'phases' ? ['Qism', `${strokeWord} soni`] : x.mode === 'weight' ? ['Kg', 'Marta'] : x.mode === 'timed' ? [strokeWord, 'Vaqt']
    : x.mode === 'water' ? ['Otrezok', 'Vaqt (m:ss)'] : x.mode === 'time' ? ['', isMinutes(s, x) ? 'Daqiqa' : 'Vaqt (m:ss)'] : ['', strokeWord === 'Zarba' ? 'Zarba' : 'Marta']
  const pt = planText(x, s)

  let rows = ''
  sets.forEach((t, i) => {
    const tick = `<button class="tick ${t.done ? 'on' : ''}" data-act="tick" data-sx="${x.sx}" data-i="${i}" aria-label="Tayyor">✓</button>`
    const inp = (f, ph, mode = 'decimal') => `<input class="n" inputmode="${mode}" data-in="${f}" data-sx="${x.sx}" data-i="${i}" placeholder="${esc(ph)}" value="${esc(t[f] ?? '')}">`
    let cells
    if (x.mode === 'weight') cells = inp('w', 'kg') + inp('r', x.plan?.reps ? String(x.plan.reps) : 'marta', 'numeric')
    else if (x.mode === 'reps') cells = '<span></span>' + inp('r', x.plan?.reps ? String(x.plan.reps) : 'marta', 'numeric')
    else if (x.mode === 'timed') cells = inp('r', 'zarba', 'numeric') + `<button class="timerbtn" data-act="tstart" data-sx="${x.sx}" data-i="${i}">▶ ${formatDuration(t.t)}</button>`
    else if (x.mode === 'phases') cells = `<span class="muted small center">${esc(t.name)} · ${formatDuration(t.sec)}</span>` + inp('r', 'zarba', 'numeric')
    else if (isMinutes(s, x)) cells = '<span></span>' + `<input class="n" inputmode="numeric" data-in="t" data-sx="${x.sx}" data-i="${i}" placeholder="${x.plan?.time ? Math.round(x.plan.time / 60) : 'daq'}" value="${esc(t.t ?? '')}">`
    else cells = `<span class="muted small center">${x.mode === 'water' && x.plan?.distance ? x.plan.distance + ' m' : ''}</span>` + inp('t', x.plan?.time ? formatDuration(x.plan.time) : '2:35', 'text')
    rows += `<div class="setrow ${t.done ? 'done' : ''}"><span class="sn">${i + 1}</span>${cells}${tick}</div>`
  })

  const hint = g ? (g.sug.prev
    ? `<div class="muted small">Oxirgi marta: ${g.sug.prev.map(t => `${t.w}×${t.r}`).join(', ')}</div>${g.sug.up ? `<span class="tag good">Vazn qo'shish vaqti: maqsad ${g.sug.w} kg × ${g.lo}+</span>` : `<span class="tag">Maqsad: ${g.sug.w} kg × ${g.sug.r}</span>`}`
    : `<div class="muted small">Oldin qilmagansiz — ${g.lo} marta bajara oladigan vaznni tanlang</div>`)
    : ''
  const adv = g?.adv ? `<div class="advice good">💡 ${g.adv.sessions} ta mashg'ulotingiz bo'yicha <b>${g.adv.w} kg</b> bilan boshlang va ${g.adv.lo}–${g.adv.hi} marta bajaring (1–2 takror zaxirada qoldiring). Hisobiy maksimum — ${g.adv.rm} kg. Hamma urinishda ${g.adv.hi} chiqsa — ${g.adv.step === 2.5 ? '2,5' : '1'} kg qo'shing.</div>` : ''

  const rule = x.count === 'stroke' ? (boat
    ? `<div class="rule">${boat === 'kayak' ? "Baydarka: chap + o'ng = 1 marta" : 'Kanoe: 1 zarba = 1 marta'} <button class="link" data-act="boat" data-b="${boat === 'kayak' ? 'canoe' : 'kayak'}">o'zgartirish</button></div>`
    : `<div class="advice warn"><div>Qaysi qayiqda eshasiz? Hisoblash qoidasi shunga bog'liq.</div><div class="chips"><button class="pill" data-act="boat" data-b="kayak">Baydarka</button><button class="pill" data-act="boat" data-b="canoe">Kanoe</button></div></div>`) : ''

  const ergo = x.mode === 'phases' && x.plan?.phases?.length ? `<button class="btn ghost" data-act="phases" data-sx="${x.sx}">▶ Boshlash (3-2-1, qismlar bo'yicha taymer)</button>` : ''
  const water = x.mode === 'phases' ? `<div class="chips"><span class="muted small" style="align-self:center">Kanalda:</span>${[['yes', 'Suv bor'], ['no', "Suv yo'q"]].map(([k, l]) => `<button class="pill" aria-pressed="${(d.water ?? log?.detail?.water) === k}" data-act="water" data-sx="${x.sx}" data-w="${k}">${l}</button>`).join('')}</div>` : ''
  const addSet = x.mode === 'weight' || x.mode === 'reps' ? `<button class="add" data-act="addset" data-sx="${x.sx}">＋ Urinish</button>` : ''

  let pulse = ''
  if (hr) {
    pulse = `<div class="hrdone">♥ Puls: <b>${hr.hr1}</b>${hr.hr2 != null ? ` → 1 daq: <b>${hr.hr2}</b> (−${hr.hr1 - hr.hr2})` : ''}${d.locked ? '' : ' <button class="link" data-act="repulse" data-sx="' + x.sx + '">qayta o\'lchash</button>'}</div>`
  } else if (anyDone && d.manual) {
    pulse = `<div class="row"><label class="fld" style="flex:1"><span>Puls * (10 soniyadagi urishlar)</span><input class="n" inputmode="numeric" data-in="b1" data-sx="${x.sx}" value="${esc(d.b1 ?? '')}"><span class="conv" id="c1-${x.sx}"></span></label>
      <label class="fld" style="flex:1"><span>1 daq dam olgandan keyin</span><input class="n" inputmode="numeric" data-in="b2" data-sx="${x.sx}" value="${esc(d.b2 ?? '')}"><span class="conv" id="c2-${x.sx}"></span></label></div>`
  } else if (anyDone) {
    pulse = `<button class="btn" data-act="pulse" data-sx="${x.sx}">❤ Pulsni o'lchash (Start, 10 soniya)</button><button class="link" data-act="manual" data-sx="${x.sx}">Pulsni qo'lda kiritish</button>`
  }

  return `<div class="ex ${saved ? 'done' : ''}" data-ex="${x.sx}">
    <div class="between"><span class="title">${esc(exName(catById.get(x.dispEx || x.ex), x.name))}${x.of > 1 ? ` · #${x.set_no}` : ''}<button class="exi" data-act="info" data-sx="${x.sx}" aria-label="Mashq tavsifi">i</button></span>${saved ? '<span class="chip ok">✓ yozildi</span>' : ''}</div>
    <div class="muted small">${esc(x.muscles || '')}${g?.cat?.level ? ` · ${LEVELS[g.cat.level]?.t}` : ''}${x.rest ? ` · dam ≈ ${formatDuration(x.rest)}` : ''}</div>
    ${pt || x.prescription ? `<div class="plan">Reja: ${esc(pt || x.prescription)}${pt && x.prescription && pt !== x.prescription ? ` <span class="muted small">(${esc(x.prescription)})</span>` : ''}</div>` : ''}
    ${hint}${adv}${rule}${ergo}
    <div class="setrow head"><span></span><span>${head[0]}</span><span>${head[1]}</span><span></span></div>
    ${rows}${water}${addSet}${pulse}
    <div class="err neg small" id="err-${x.sx}"></div>
    <button class="btn" data-act="save" data-sx="${x.sx}" ${!anyDone || !hr ? 'disabled' : ''}>${saved ? 'Yangilash' : 'Saqlash'}</button>
  </div>`
}

// ---------- ввод в полях ----------
export function onInput(el) {
  const sx = el.dataset.sx, f = el.dataset.in
  const d = S.drafts[sx]; if (!d) return
  if (f === 'b1' || f === 'b2') {
    el.value = el.value.replace(/\D/g, '')
    const bpm = el.value ? Number(el.value) * 6 : null
    if (f === 'b1') { d.b1 = el.value; d.hr1 = bpm } else { d.b2 = el.value; d.hr2 = bpm }
    const c = document.getElementById(`c${f === 'b1' ? 1 : 2}-${sx}`)
    if (c) c.innerHTML = bpm ? tr(`${el.value} × 6 = <b>${bpm}</b>`) : ''
    saveDrafts(); return
  }
  const i = Number(el.dataset.i)
  const v = f === 'r' ? el.value.replace(/\D/g, '') : el.value
  if (f === 'r' && v !== el.value) el.value = v
  d.sets[i][f] = v
  saveDrafts()
}

// ---------- действия ----------
const findEx = (s, sx) => ({ s, x: null })
export function cardAction(act, el, ctx) {
  const { session: s, exercises } = ctx
  const sx = el.dataset.sx
  const x = exercises.find(e => e.sx === sx)
  const d = x && S.drafts[sx]
  const i = Number(el.dataset.i)
  const err = m => { const e = document.getElementById(`err-${sx}`); if (e) e.textContent = m }

  if (act === 'tick') {
    const t = d.sets[i]
    if (!t.done) {
      const ok = x.mode === 'water' || (x.mode === 'time' && !isMinutes(s, x)) ? parseDuration(t.t) > 0
        : x.mode === 'time' ? num(t.t) > 0
        : x.mode === 'phases' ? t.r !== '' && num(t.r) >= 0
        : x.mode === 'weight' ? num(t.r) > 0 && (t.w === '' || num(t.w) >= 0)
        : num(t.r) > 0
      if (!ok) return err(x.mode === 'water' || x.mode === 'time' ? 'Vaqtni kiriting.' : 'Necha marta qilganingizni kiriting.')
    }
    t.done = !t.done
    saveDrafts()
    if (t.done && s.kind === 'gym' && x.mode === 'weight') restStart(x.rest || 120)   // отдых между подходами, как в Торсо
    return 'render'
  }
  if (act === 'addset') { d.sets.push(emptySet(x, d.sets.length, gymInfo(s, x)?.sug)); saveDrafts(); return 'render' }
  if (act === 'water') { d.water = el.dataset.w; saveDrafts(); return 'render' }
  if (act === 'boat') { S.settings.boat = el.dataset.b; saveSettings(); return 'render' }
  if (act === 'manual') { d.manual = true; saveDrafts(); return 'render' }
  if (act === 'repulse') { d.hr1 = null; d.hr2 = null; d.b1 = ''; d.b2 = ''; d.manual = false; saveDrafts(); return 'render' }
  if (act === 'pulse') {
    pulseFlow({
      age: S.me?.age ?? S.plan.age, baseRest: x.rest,
      onDone: r => {
        d.hr1 = r.hr1; d.hr2 = r.hr2; saveDrafts()
        S.history.push({ level: r.advice.level, p2: r.advice.p2 })
        S.fatigue = fatigueCheck(S.history)
        S.render()
      },
    })
    return
  }
  if (act === 'tstart') {
    timerFlow({ title: x.name, parts: [{ name: `${i + 1}-urinish`, sec: d.sets[i].t }], onDone: () => document.querySelector(`[data-in="r"][data-sx="${sx}"][data-i="${i}"]`)?.focus() })
    return
  }
  if (act === 'phases') { timerFlow({ title: x.name, parts: x.plan.phases }); return }
  if (act === 'info') { infoSheet(x); return }
  if (act === 'save') return save(s, x, d, err)
  findEx(s, sx)
}

function infoSheet(x) {
  const i = exInfo(catById.get(x.dispEx || x.ex), x.info) || {}
  openSheet(`<div class="between"><b>${esc(exName(catById.get(x.dispEx || x.ex), x.name))}</b><button class="link" data-close>✕</button></div>
    ${i.muscles ? `<div class="muted small">Ishlaydigan mushaklar: ${esc(i.muscles)}</div>` : ''}
    ${i.steps?.length ? `<ol class="steps">${i.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    ${i.tip ? `<div class="advice warn"><b>Maslahat:</b> ${esc(i.tip)}</div>` : ''}
    ${!i.steps?.length && !i.tip && !i.muscles ? '<div class="muted">Tavsif yo\'q.</div>' : ''}`)
}

// Итог упражнения для Главного: «лучший подход» (вес), сумма повторов, среднее время отрезка и т.д.
export function buildRow(s, x, d) {
  const done = d.sets.filter(t => t.done)
  const p = x.plan || {}
  let reps = null, weight = null, duration = null, distance = null, detail
  if (x.mode === 'weight') {
    const top = [...done].sort((a, b) => (num(b.w) || 0) - (num(a.w) || 0) || (num(b.r) || 0) - (num(a.r) || 0))[0]
    weight = num(top.w); reps = Math.round(num(top.r))
    detail = done.map(t => ({ w: num(t.w), r: Math.round(num(t.r)) }))
  } else if (x.mode === 'reps') {
    reps = done.reduce((a, t) => a + Math.round(num(t.r)), 0)
    detail = done.map(t => ({ r: Math.round(num(t.r)) }))
  } else if (x.mode === 'timed') {
    reps = done.reduce((a, t) => a + Math.round(num(t.r)), 0)
    duration = done.reduce((a, t) => a + (Number(t.t) || 0), 0) || null
    detail = done.map(t => ({ r: Math.round(num(t.r)), t: Number(t.t) || null }))
  } else if (x.mode === 'phases') {
    reps = done.reduce((a, t) => a + Math.round(num(t.r)), 0)
    duration = done.reduce((a, t) => a + (Number(t.sec) || 0), 0) || null
    detail = done.map(t => ({ phase: t.name, t: Number(t.sec) || null, r: Math.round(num(t.r)) }))
  } else if (x.mode === 'water') {
    const ts = done.map(t => parseDuration(t.t))
    reps = ts.length
    duration = Math.round((ts.reduce((a, b) => a + b, 0) / ts.length) * 100) / 100
    distance = p.distance ? p.distance * ts.length : null
    detail = ts.map(t => ({ t }))
  } else {
    const t = isMinutes(s, x) ? num(done[0].t) * 60 : parseDuration(done[0].t)
    duration = t; detail = [{ t }]
  }
  return {
    id: d.id, session_id: s.id, session_exercise_id: x.sx, exercise_id: x.ex, set_no: x.set_no ?? 1, logged_on: s.session_date,
    reps, weight_kg: weight, duration_seconds: duration, distance_m: distance,
    heart_rate: Math.round(d.hr1), recovery_hr: d.hr2 == null ? null : Math.round(d.hr2),
    note: d.note || null, detail: { sets: detail, ...(x.mode === 'phases' ? { water: d.water ?? null } : {}) },
  }
}

function save(s, x, d, err) {
  err('')
  if (!d.sets.some(t => t.done)) return err('Kamida bitta urinishni ✓ bilan belgilang.')
  if (!validPulse(d.hr1)) return err("Puls majburiy: avval pulsni o'lchang.")
  const row = buildRow(s, x, d)
  // Рекорд (зал): расчётный максимум выше прошлых занятий.
  if (s.kind === 'gym' && x.mode === 'weight') {
    const hist = history(S.plan.logs, x.ex, s.id)
    const best = Math.max(...row.detail.sets.map(t => epley(t.w, t.r)))
    if (hist.length && best > bestRm(hist) + 0.01) toast('🏆 Yangi rekord: ' + x.name)
  }
  queue.addLogs([row])
  S.plan.logs = [...S.plan.logs.filter(l => l.id !== row.id), row]
  store.set('plan', S.plan)
  d.locked = true; saveDrafts()
  S.afterSave?.()
  toast('Saqlandi ✓')
  return 'render'
}

export const addExtra = (s, catId) => {
  const c = catById.get(catId); if (!c) return
  const list = S.extras[s.id] || (S.extras[s.id] = [])
  list.push(makeExtra(c, uuid()))
  store.set('extra', S.extras)
}
export { MUSCLES }
