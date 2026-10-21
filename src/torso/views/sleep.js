import { state, save, today, addDays, uid, fmt } from '../store.js'
import { acts, ctx, esc, dateLabel, toast, openSheet, closeSheet, ask, dd, ddVal, barChart } from '../ui.js'
import { syncReminders, ensurePermission, canNotify, toMin } from '../notify.js'

// ---------- время и подсчёт ----------
const pad = n => String(n).padStart(2, '0')
const nowStr = () => { const d = new Date(); return `${fmt(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const parse = s => { const [d, t] = s.split('T'); const [y, m, dd2] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd2, h, mi) }
const mins = e => Math.round((parse(e.e) - parse(e.s)) / 60000)
export const hm = m => `${Math.floor(m / 60)} ч ${pad(Math.round(m % 60))} мин`

// Дневной сон сегодня уже был (или идёт сейчас) — напоминать не нужно
export const napDone = () => state.sleep.some(e => e.nap && e.s.slice(0, 10) === today()) || !!state.sleepNow?.nap

export function totalFor(date) {
  let night = 0
  let nap = 0
  for (const e of state.sleep) {
    if (e.e.slice(0, 10) !== date) continue
    if (e.nap) nap += mins(e); else night += mins(e)
  }
  return { night, nap, total: night + nap }
}

const needMin = () => state.sleepCfg.need * 60

function week() {
  const out = []
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today(), -i)
    const [y, m, dd2] = d.split('-').map(Number)
    out.push({ d, ...totalFor(d), dow: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(y, m - 1, dd2).getDay()] })
  }
  return out
}

// ---------- выбор времени: два тёмных списка (часы и минуты) ----------
const HOURS = Array.from({ length: 24 }, (_, i) => [pad(i), pad(i)])
const MINUTES = Array.from({ length: 12 }, (_, i) => [pad(i * 5), pad(i * 5)])
export const timeSel = (id, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `<div class="time">${dd(id + '-h', HOURS, pad(h))}<b>:</b>${dd(id + '-m', MINUTES, pad(Math.floor(m / 5) * 5))}</div>`
}
const getTime = id => `${ddVal(id + '-h')}:${ddVal(id + '-m')}`

// ---------- карточка и подсказки на главном экране ----------
// Событие с виджета: лёг спать / проснулся в момент нажатия (дневной сон — если лёг с 11 до 18 часов)
export function applySleepEvent(kind, ts) {
  const d = new Date(ts)
  const str = `${fmt(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (kind === 'start') {
    if (!state.sleepNow) state.sleepNow = { s: str, nap: d.getHours() >= 11 && d.getHours() < 18 }
  } else if (state.sleepNow) {
    const e = { id: uid(), s: state.sleepNow.s, e: str, nap: state.sleepNow.nap }
    state.sleepNow = null
    const m = mins(e)
    if (m >= 5 && m <= 16 * 60) state.sleep.push(e)
    syncReminders()
  }
}

export function sleepCard(date) {
  const c = state.sleepCfg
  const t = totalFor(date)
  const now = state.sleepNow
  const pct = Math.min(100, (t.total / needMin()) * 100)
  return `<div class="card">
    <div class="card-h"><span class="em">🌙</span><b>Сон</b><button class="link r" data-a="openSleep">подробнее</button></div>
    <div class="water-top"><div class="big">${hm(t.total)}</div><div class="goal">Цель: ${c.need} ч</div></div>
    <div class="bar-track"><div class="bar-fill s" style="width:${pct.toFixed(0)}%"></div></div>
    ${now
    ? `<div class="sub note">${now.nap ? 'Дневной сон' : 'Сон'} с ${now.s.slice(11)} · идёт ${hm(Math.max(0, Math.round((Date.now() - parse(now.s)) / 60000)))}</div><button class="btn full" data-a="sleepStop">☀️ Проснулся</button>`
    : `<div class="row2 mt"><button class="btn ghost" data-a="sleepStart" data-nap="0">😴 Лёг спать</button><button class="btn ghost" data-a="sleepStart" data-nap="1">💤 Дневной сон</button></div>`}
  </div>`
}

// Компактный блок сна для объединённой карточки «Шаги и сон»
export function sleepMini(date) {
  const c = state.sleepCfg
  const t = totalFor(date)
  const now = state.sleepNow
  const pct = Math.min(100, (t.total / needMin()) * 100)
  const big = `${Math.floor(t.total / 60)}:${pad(Math.round(t.total % 60))}`
  return `<div class="act-col">
    <div class="act-h"><span class="em">🌙</span><b>Сон</b><button class="link r" data-a="openSleep">подробнее</button></div>
    <div class="act-big">${big}</div>
    <div class="sub">часов из ${String(c.need).replace('.', ',')}</div>
    <div class="bar-track thin"><div class="bar-fill s" style="width:${pct.toFixed(0)}%"></div></div>
    ${now
    ? `<div class="act-s">${now.nap ? 'Дневной сон' : 'Сон'} с ${now.s.slice(11)} · ${hm(Math.max(0, Math.round((Date.now() - parse(now.s)) / 60000)))}</div><button class="btn sm full" data-a="sleepStop">☀️ Проснулся</button>`
    : `<div class="act-b"><button class="btn ghost sm" data-a="sleepStart" data-nap="0">😴 Лёг</button><button class="btn ghost sm" data-a="sleepStart" data-nap="1">💤 Днём</button></div>`}
  </div>`
}

// Предупреждение о времени сна (и дневного сна)
export function sleepBanner(date) {
  if (date !== today() || state.sleepNow) return ''
  const c = state.sleepCfg
  const d = new Date()
  const cur = d.getHours() * 60 + d.getMinutes()
  const since = (cur - toMin(c.bed) + 1440) % 1440 // минут после времени отбоя (0..1439)
  const why = state.profile.goal === 'cut'
    ? 'При похудении недосып отнимает мышцы: в исследовании при одинаковом дефиците калорий 5,5 ч сна против 8,5 ч дали на 60% больше потери мышечной массы.'
    : 'Мышцы растут во время восстановления: после одной бессонной ночи синтез мышечного белка падает примерно на 18%.'
  if (since >= 1380) return `<div class="card verdict info"><div class="v-t">🌙 Скоро время сна — ${c.bed}</div><p>Отложите экран и ложитесь вовремя: цель ${c.need} ч. ${why}</p></div>`
  if (since <= 90) return `<div class="card verdict warn"><div class="v-t">😴 Пора спать (отбой был в ${c.bed})</div><p>${why}</p><button class="btn full" data-a="sleepStart" data-nap="0">😴 Лёг спать</button></div>`
  if (c.nap && !napDone()) {
    const sn = (cur - toMin(c.napTime) + 1440) % 1440
    if (sn >= 1425 || sn <= 30) return `<div class="card verdict info"><div class="v-t">💤 Время дневного сна — ${c.napTime}</div><p>Лучше 20–30 минут: так бодрость и скорость реакции выше, а риск проснуться «разбитым» меньше. Сон дольше 60 минут чаще даёт сонную инерцию.</p></div>`
  }
  return ''
}

// ---------- страница «Сон» ----------
const ENTRY_LABEL = e => `${e.nap ? '💤 Дневной' : '🌙 Ночной'} · ${e.s.slice(11)}–${e.e.slice(11)} · ${hm(mins(e))}`

export function renderSleep() {
  const c = state.sleepCfg
  const wk = week()
  const withData = wk.filter(x => x.total > 0)
  const avg = withData.length ? withData.reduce((a, x) => a + x.total, 0) / withData.length : 0
  const debt = withData.reduce((a, x) => a + Math.max(0, needMin() - x.total), 0)
  const bars = wk.map(x => ({ v: Math.round((x.total / 60) * 10) / 10, l: x.dow, cls: x.total && x.total < needMin() * 0.85 ? 'over' : '' }))
  const recent = [...state.sleep].sort((a, b) => (a.e < b.e ? 1 : -1)).slice(0, 12)
  const t = totalFor(today())
  const advice = []
  if (withData.length >= 3 && avg < 7 * 60) advice.push(`В среднем вы спите ${hm(avg)} — меньше 7 часов, которые консенсус AASM и SRS считает минимумом для здоровья взрослых. Сдвиньте отбой раньше.`)
  else if (withData.length >= 3 && avg < needMin() - 20) advice.push(`Вы спите в среднем ${hm(avg)} при цели ${c.need} ч. Попробуйте ложиться на 30 минут раньше.`)
  else if (withData.length >= 3) advice.push(`Среднее за неделю ${hm(avg)} — в пределах рекомендаций. Так держать.`)
  if (debt > 120) advice.push(`Недосып за неделю — ${hm(debt)}. Дневной сон 20–30 минут поможет частично компенсировать, но не заменяет нормальную ночь.`)
  return `
  <div class="datebar"><button class="icon" data-a="sleepBack">‹</button><h1 class="title">Сон</h1><button class="icon" data-a="sleepCfg" aria-label="Настройки">⚙</button></div>
  ${sleepCard(today())}
  <div class="card">
    <div class="row-h"><b>Последние 7 дней</b><span class="sub">цель ${c.need} ч</span></div>
    ${barChart(bars, { target: c.need })}
    <div class="stats3"><div><b>${withData.length ? hm(avg).replace(' мин', '') : '—'}</b><span>в среднем</span></div><div><b>${hm(t.total).replace(' мин', '')}</b><span>сегодня</span></div><div><b>${debt ? hm(debt).replace(' мин', '') : '0 ч'}</b><span>недосып за неделю</span></div></div>
    ${advice.map(a => `<p class="sub">${esc(a)}</p>`).join('')}
  </div>
  <button class="btn ghost full" data-a="sleepAdd">＋ Добавить сон вручную</button>
  ${recent.length ? `<h3>Записи</h3>${recent.map(e => `<div class="card hist"><div><b>${ENTRY_LABEL(e)}</b><div class="sub">проснулись ${dateLabel(e.e.slice(0, 10))}</div></div><button class="x" data-a="sleepDel" data-id="${e.id}" aria-label="Удалить">✕</button></div>`).join('')}` : ''}
  <h3>Что говорят исследования</h3>
  ${EVIDENCE.map(x => `<details class="card art"><summary>${esc(x.t)}</summary><div class="art-b"><p>${x.b}</p><p class="sub">Источник: ${esc(x.s)}</p></div></details>`).join('')}`
}

const EVIDENCE = [
  { t: 'Сколько спать взрослому', b: 'Консенсус Американской академии медицины сна (AASM) и Общества исследования сна (SRS): взрослым 18–60 лет нужно 7 и более часов сна в сутки на регулярной основе. Меньше 7 часов связано с набором веса, ожирением, диабетом, повышенным давлением, болезнями сердца и депрессией. У спортсменов обычно 7–9 часов, но индивидуальная потребность может быть выше.', s: 'Watson N. F. et al., консенсус AASM/SRS, 2015; Walsh N. P. et al., Br J Sports Med, 2021' },
  { t: 'Сон и рост мышц', b: 'В эксперименте одна ночь полного недосыпа снизила скорость синтеза мышечного белка примерно на 18% и повысила уровень кортизола. Хронический недосып ухудшает восстановление и силовые показатели.', s: 'Lamon S. et al., Physiol Rep, 2021' },
  { t: 'Сон при похудении', b: 'В 14-дневном исследовании люди ели одинаково, но спали 8,5 или 5,5 часа. При коротком сне доля жира в потерянном весе снизилась на 55%, а потеря мышечной (безжировой) массы выросла на 60%; голод усилился. Выборка маленькая (10 человек), но результат согласуется с другими работами.', s: 'Nedeltcheva A. V. et al., Ann Intern Med, 2010' },
  { t: 'Дневной сон', b: 'Короткий сон 20–30 минут улучшает бодрость и реакцию и у спортсменов повышает результаты в спринте и прыжке. Сон дольше 60 минут помогает восстановлению, но повышает риск «сонной инерции» — разбитости и снижения координации сразу после пробуждения. Поздний дневной сон может мешать засыпанию ночью.', s: 'Walsh N. P. et al., Br J Sports Med, 2021 (консенсус по сну спортсменов)' },
]

acts.openSleep = () => { ctx.tsub = 'sleep'; ctx.render(); window.scrollTo(0, 0) }
acts.sleepBack = () => { ctx.tsub = null; ctx.render() }

acts.sleepStart = ({ nap }) => {
  state.sleepNow = { s: nowStr(), nap: nap === '1' }
  if (nap === '1') syncReminders()
  save()
  toast(nap === '1' ? 'Приятного дневного сна' : 'Спокойной ночи')
  ctx.render()
}

acts.sleepStop = () => {
  const n = state.sleepNow
  if (!n) return
  const e = { id: uid(), s: n.s, e: nowStr(), nap: n.nap }
  state.sleepNow = null
  if (mins(e) < 5) { save(); toast('Слишком коротко — запись не создана'); ctx.render(); return }
  state.sleep.push(e)
  save()
  syncReminders()
  toast(`Записано: ${hm(mins(e))}`)
  ctx.render()
}

acts.sleepDel = async ({ id }) => {
  if (!(await ask('Удалить запись о сне?', 'Удалить', true))) return
  state.sleep = state.sleep.filter(e => e.id !== id)
  save()
  ctx.render()
}

// ---------- ручное добавление ----------
let draft = null
acts.sleepAdd = () => {
  draft = { nap: false, back: 0 }
  renderAddSheet('23:00', '07:00')
}
function renderAddSheet(a, b) {
  const c = state.sleepCfg
  openSheet(`
    <div class="sh-h"><b>Добавить сон</b><button class="icon" data-a="closeSheet">✕</button></div>
    <div class="sel-row"><button class="pill ${draft.nap ? '' : 'on'}" data-a="sleepType" data-nap="0">🌙 Ночной</button><button class="pill ${draft.nap ? 'on' : ''}" data-a="sleepType" data-nap="1">💤 Дневной</button></div>
    <div class="sel-row"><button class="pill ${draft.back === 0 ? 'on' : ''}" data-a="sleepDay" data-back="0">Проснулся сегодня</button><button class="pill ${draft.back === 1 ? 'on' : ''}" data-a="sleepDay" data-back="1">Вчера</button></div>
    <label>Лёг</label>${timeSel('sa-s', a || (draft.nap ? '14:00' : c.bed))}
    <label>Встал</label>${timeSel('sa-e', b || (draft.nap ? '14:30' : c.wake))}
    <button class="btn full" data-a="sleepSave">Сохранить</button>`)
}
const keepTimes = () => [getTime('sa-s'), getTime('sa-e')]
acts.sleepType = ({ nap }) => { draft.nap = nap === '1'; renderAddSheet(draft.nap ? '14:00' : state.sleepCfg.bed, draft.nap ? '14:30' : state.sleepCfg.wake) }
acts.sleepDay = ({ back }) => { const [a, b] = keepTimes(); draft.back = Number(back); renderAddSheet(a, b) }
acts.sleepSave = () => {
  const [a, b] = keepTimes()
  const wakeDate = addDays(today(), -draft.back)
  const startDate = toMin(a) < toMin(b) ? wakeDate : addDays(wakeDate, -1)
  const e = { id: uid(), s: `${startDate}T${a}`, e: `${wakeDate}T${b}`, nap: draft.nap }
  const m = mins(e)
  if (!(m >= 5 && m <= 16 * 60)) return toast('Проверьте время: сон должен быть от 5 минут до 16 часов')
  state.sleep.push(e)
  save()
  syncReminders()
  closeSheet()
  toast(`Записано: ${hm(m)}`)
  ctx.render()
}

// ---------- режим сна и напоминания ----------
let cfg = null
const NEEDS = [7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => [v, `${String(v).replace('.', ',')} ч`])
const LEADS = [15, 30, 45, 60].map(v => [v, `за ${v} мин`])

acts.sleepCfg = () => {
  cfg = { ...state.sleepCfg }
  openSheet(`
    <div class="sh-h"><b>Режим сна</b><button class="icon" data-a="closeSheet">✕</button></div>
    <label>Отбой (когда ложитесь)</label>${timeSel('sc-b', cfg.bed)}
    <label>Подъём</label>${timeSel('sc-w', cfg.wake)}
    <label>Сколько часов сна нужно</label>${dd('sc-n', NEEDS, cfg.need)}
    <div class="sub">Рекомендация для взрослых — не меньше 7 часов; тем, кто тренируется, обычно подходит 8–9.</div>
    <button class="chk ${cfg.remind ? 'on' : ''}" data-a="cfgTog" data-k="remind"><i>${cfg.remind ? '✓' : ''}</i>Напоминать о сне</button>
    <label>Предупредить</label>${dd('sc-l', LEADS, cfg.lead)}
    <button class="chk ${cfg.nap ? 'on' : ''}" data-a="cfgTog" data-k="nap"><i>${cfg.nap ? '✓' : ''}</i>Дневной сон: напоминать</button>
    <label>Время дневного сна</label>${timeSel('sc-d', cfg.napTime)}
    ${canNotify() ? '' : '<div class="sub note">Уведомления работают в приложении на телефоне.</div>'}
    <button class="btn full" data-a="cfgSave">Сохранить</button>`)
}
acts.cfgTog = ({ k }, el) => {
  cfg[k] = !cfg[k]
  el.classList.toggle('on', cfg[k])
  el.querySelector('i').textContent = cfg[k] ? '✓' : ''
}
acts.cfgSave = async () => {
  const c = { ...cfg, bed: getTime('sc-b'), wake: getTime('sc-w'), need: Number(ddVal('sc-n')), lead: Number(ddVal('sc-l')), napTime: getTime('sc-d') }
  state.sleepCfg = c
  save()
  closeSheet()
  if (c.remind || c.nap || state.waterCfg.every) {
    if (canNotify() && !(await ensurePermission())) toast('Разрешите уведомления в настройках телефона, чтобы получать напоминания')
    else toast('Настройки сохранены')
    await syncReminders()
  } else toast('Настройки сохранены')
  ctx.render()
}
