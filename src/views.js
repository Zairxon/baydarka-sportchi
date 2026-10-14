import { S, KINDS, CAT, catById, groupOf, sessionExercises, pendingCount } from './state.js'
import { cardHtml } from './cards.js'
import { esc, dayLabel, dayShort, addDays, isoDate, formatDuration } from './util.js'
import { muscleLoad, MUSCLES, epley, setKcal, LEVELS } from './gym.js'
import { RPE_LABELS, finishAdvice, maxHr } from './advice.js'
import { openSheet } from './ui.js'
import { LANGS, getLang, exName } from './i18n.js'

export const kindOfSession = s => {
  if (s.kind && KINDS[s.kind]) return s.kind
  const m = (s.exercises || []).map(x => x.mode)
  if (m.length && m.every(t => t === 'water')) return 'water'
  if (m.filter(t => t === 'weight').length * 2 >= m.length && m.length) return 'gym'
  if (m.some(t => t === 'timed' || t === 'phases')) return 'land'
  return 'ofp'
}
const withKind = s => ({ ...s, kind: kindOfSession(s) })

export function heroHtml() {
  const st = !S.auth ? '' : pendingCount() > 0 ? '<span class="hero-status warn">yuborilmagan yozuvlar bor</span>' : S.online === false ? '<span class="hero-status warn">internet yo\'q</span>' : S.online ? '<span class="hero-status ok">sinxronlangan</span>' : ''
  return `<img class="logo" src="./pwa-192x192.png" alt="">
    <div class="hero-t"><div class="hero-title">Baydarka · Sportchi</div><div class="hero-sub">${S.me ? esc(S.me.full_name) + (S.me.group_name ? ' · ' + esc(S.me.group_name) : '') : 'Sportchi kundaligi'}</div>${st}</div>
    <div class="hbtns"><button class="hbtn" data-act="lang" aria-label="Til">🌐</button><button class="hbtn" data-act="theme" aria-label="Mavzu">◐</button>${S.auth ? '<button class="hbtn" data-act="profile" aria-label="Profil">☰</button>' : ''}</div>`
}

export function loginHtml(err = '', busy = false) {
  return `<section class="login"><div class="panel">
    <h2>Kirish</h2>
    <label class="fld"><span>Login</span><input id="lg-l" autocapitalize="none" autocorrect="off" autocomplete="username"></label>
    <label class="fld"><span>Parol</span><input id="lg-p" type="password" autocomplete="current-password"></label>
    ${err ? `<div class="neg small">${esc(err)}</div>` : ''}
    <button class="btn" data-act="login" ${busy ? 'disabled' : ''}>${busy ? 'Tekshirilmoqda…' : 'Kirish'}</button>
    <p class="muted small">Login va parolni murabbiyingiz beradi.</p></div>${installHtml()}</section>`
}

// Подсказка по установке на главный экран.
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const IOS = /iPhone|iPad|iPod/.test(UA)
const INAPP = /Telegram|Instagram|FBAN|FBAV|Line\/|; wv\)|Snapchat|TikTok/i.test(UA)
export const installHtml = () => {
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return ''
  let steps
  if (INAPP) steps = ["Bu ilova ichidagi brauzer — bu yerda o'rnatib bo'lmaydi.", "Yuqoridagi ⋮ menyusidan «Brauzerda ochish» / «Chrome'da ochish» ni tanlang.", "Chrome ochilgach, «O'rnatish» ni bosing."]
  else if (IOS) steps = ["Safari'da pastdagi «Ulashish» ▫︎↑ tugmasini bosing.", "«Ekranga qo'shish» → «Qo'shish».", "(Chrome'da iPhone'ga o'rnatib bo'lmaydi — Safari kerak.)"]
  else steps = ["Chrome'da ⋮ menyusini oching.", "«Ilovani o'rnatish» yoki «Bosh ekranga qo'shish» ni tanlang.", "Tasdiqlang."]
  return `<div class="panel install"><b>📲 Telefonga o'rnating</b>${S.canInstall ? '<button class="btn" data-act="install">O\'rnatish</button>' : ''}<ol class="steps small">${steps.map(t => `<li>${t}</li>`).join('')}</ol></div>`
}

export function tabsHtml() {
  const tabs = [['today', '📅', 'Bugun'], ['water', KINDS.water.icon, KINDS.water.short], ['gym', KINDS.gym.icon, KINDS.gym.short], ['land', KINDS.land.icon, KINDS.land.short], ['ofp', KINDS.ofp.icon, KINDS.ofp.short], ['game', KINDS.game.icon, KINDS.game.short], ['stats', '📊', 'Natijalar']]
  return `<div class="tabs"><div class="tabs-in">${tabs.map(([k, i, n]) => `<button class="tab" aria-selected="${S.tab === k}" data-act="tab" data-tab="${k}"><i>${i}</i>${n}</button>`).join('')}</div></div>`
}

// ---------- строки списка занятий ----------
const SLOT = { morning: 'Ertalabki', evening: 'Kechki' }
function sessionItem(s0) {
  const s = withKind(s0)
  const exs = sessionExercises(s)
  const done = exs.filter(x => S.plan.logs.some(l => l.session_exercise_id === x.sx && l.heart_rate)).length
  const fin = S.plan.feedback.some(f => f.session_id === s.id)
  const k = KINDS[s.kind]
  return `<button class="item" data-act="open" data-id="${s.id}"><span class="ic">${k.icon}</span><span class="main"><b>${esc(s.topic || k.name)}</b>
    <span class="muted small">${k.name} · ${SLOT[s.slot] || ''}${s.planned_minutes ? ` · ${s.planned_minutes} daq` : ''}</span></span>
    <span class="chip ${fin || (exs.length && done === exs.length) ? 'ok' : ''}">${fin ? '✓' : `${done}/${exs.length}`}</span></button>`
}

// ---------- Bugun ----------
export function todayHtml() {
  const today = isoDate()
  const day = S.day || today
  const list = S.plan.sessions.filter(s => s.session_date === day)
  const next = S.plan.sessions.filter(s => s.session_date > day).slice(0, 4)
  const week = S.plan.logs.filter(l => l.logged_on >= addDays(today, -6))
  const hr = week.map(l => l.heart_rate).filter(Boolean)
  return `<section>
    <div class="kpis"><div class="kpi"><span>7 kunda mashg'ulot</span><b>${new Set(week.map(l => l.logged_on)).size}</b></div>
      <div class="kpi"><span>Bajarilgan mashq</span><b>${week.length}</b></div>
      <div class="kpi"><span>O'rtacha puls</span><b>${hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : '—'}</b></div></div>
    <div class="mnav"><button class="sq" data-act="day" data-d="-1">‹</button><b>${dayLabel(day)}${day === today ? ' · bugun' : ''}</b><button class="sq" data-act="day" data-d="1">›</button></div>
    <div class="panel">${list.length ? `<div class="list">${list.map(sessionItem).join('')}</div>` : "<div class=\"empty\">Bu kunga mashg'ulot rejalashtirilmagan.</div>"}</div>
    ${next.length ? `<h2>Keyingi mashg'ulotlar</h2><div class="panel"><div class="list">${next.map(s => `<div class="dayhead">${dayLabel(s.session_date)}</div>${sessionItem(s)}`).join('')}</div></div>` : ''}
    <h2>Bo'limlar</h2>
    <div class="panel"><div class="list">${Object.entries(KINDS).map(([k, v]) => `<button class="item" data-act="tab" data-tab="${k}"><span class="ic">${v.icon}</span><span class="main"><b>${v.name}</b><span class="muted small">${v.text}</span></span><span class="muted">›</span></button>`).join('')}</div></div>
  </section>`
}

// ---------- отдел ----------
export function deptHtml(kind) {
  const k = KINDS[kind]
  const today = isoDate()
  const all = S.plan.sessions.map(withKind).filter(s => s.kind === kind)
  const upcoming = all.filter(s => s.session_date >= today)
  const past = all.filter(s => s.session_date < today).sort((a, b) => b.session_date.localeCompare(a.session_date))
  const group = list => { let d = ''; return list.map(s => { const h = s.session_date !== d ? `<div class="dayhead">${dayLabel(s.session_date)}</div>` : ''; d = s.session_date; return h + sessionItem(s) }).join('') }
  return `<section><div class="panel"><div class="between"><h1>${k.icon} ${k.name}</h1></div><p class="muted small">${k.text}</p></div>
    <h2>Reja</h2><div class="panel">${upcoming.length ? `<div class="list">${group(upcoming)}</div>` : '<div class="empty">Rejalashtirilgan mashg\'ulot yo\'q.</div>'}</div>
    ${past.length ? `<h2>Oldingi mashg'ulotlar</h2><div class="panel"><div class="list">${group(past.slice(0, 20))}</div></div>` : ''}</section>`
}

// ---------- занятие ----------
export function sessionHtml() {
  const s = withKind(S.plan.sessions.find(x => x.id === S.open))
  const exs = sessionExercises(s)
  const k = KINDS[s.kind]
  const fb = S.plan.feedback.find(f => f.session_id === s.id)
  const done = exs.filter(x => S.plan.logs.some(l => l.session_exercise_id === x.sx && l.heart_rate)).length
  const start = S.starts?.[s.id]
  const kcal = s.kind === 'gym' && Number(S.settings.weight) > 0 ? gymKcal(s, exs) : null
  return `<section>
    <div class="between"><button class="link" data-act="back">← Orqaga</button><span class="muted small">${dayLabel(s.session_date)} · ${SLOT[s.slot] || ''}</span></div>
    <div class="panel"><div class="between"><h1>${k.icon} ${esc(s.topic || k.name)}</h1></div>
      <div class="muted small">${k.name}${s.zone ? ` · zona ${esc(s.zone)}` : ''} · ${done}/${exs.length} mashq${s.planned_minutes ? ` · reja ${s.planned_minutes} daq` : ''}</div>
      ${s.kind === 'gym' ? `<div class="muted small">⏱ <span id="wk-time">${start ? formatDuration(Math.floor((Date.now() - start) / 1000)) : '0:00'}</span>${kcal != null ? ` · ≈ <b id="wk-kcal">${Math.round(kcal)}</b> kkal` : ' · vazningizni Profilda yozing — kkal hisoblanadi'}</div>${muscleChips(exs)}` : ''}</div>
    ${S.fatigue ? `<div class="advice ${S.fatigue.stop ? 'bad' : 'warn'}"><p>${esc(S.fatigue.text)}</p></div>` : ''}
    ${exs.length ? exs.map(x => cardHtml(s, x)).join('') : '<div class="empty">Murabbiy hali mashqlarni kiritmagan.</div>'}
    ${s.kind === 'gym' || s.kind === 'ofp' ? '<button class="btn ghost" data-act="picker">＋ Mashq qo\'shish (katalog)</button>' : ''}
    <button class="btn ${fb ? 'ghost' : ''}" data-act="finish">${fb ? "Baholashni o'zgartirish" : "Mashg'ulotni yakunlash va baholash"}</button>
  </section>`
}

function muscleChips(exs) {
  const g = [...new Set(exs.map(x => groupOf(x.ex)).filter(Boolean))].filter(x => x !== 'warm')
  return g.length ? `<div class="mchips">${g.map(x => `<span class="chip">${MUSCLES[x] || x}</span>`).join('')}</div>` : ''
}

export function gymKcal(s, exs) {
  const w = Number(S.settings.weight)
  let sum = 0
  for (const l of S.plan.logs.filter(l => l.session_id === s.id)) {
    const c = catById.get(l.exercise_id)
    sum += (l.detail?.sets?.length || 1) * setKcal(c?.level, w)
  }
  return sum
}

// ---------- каталог упражнений (зал, ОФП) ----------
export function pickerSheet(kind) {
  const q = S.pickQ.trim().toLowerCase()
  const pool = CAT.filter(c => c.kinds?.includes(kind))
  const groups = [...new Set(pool.map(c => c.group))]
  const list = pool.filter(c => (!S.pickG || c.group === S.pickG) && (!q || c.name.toLowerCase().includes(q)))
  openSheet(`<div class="between"><h2>Mashq qo'shish</h2><button class="link" data-close>✕</button></div>
    <input id="pk-q" placeholder="Qidirish…" value="${esc(S.pickQ)}">
    <div class="chips"><button class="pill" aria-pressed="${!S.pickG}" data-act="pkg" data-g="">Hammasi</button>${groups.map(g => `<button class="pill" aria-pressed="${S.pickG === g}" data-act="pkg" data-g="${g}">${MUSCLES[g] || g}</button>`).join('')}</div>
    <div class="list">${list.slice(0, 60).map(c => `<button class="item" data-act="pickadd" data-id="${c.id}"><span class="main"><b>${esc(exName(c, c.name))}</b><span class="muted small">${MUSCLES[c.group] || c.cat}${c.level ? ' · ' + LEVELS[c.level].t : ''}</span></span><span class="chip">＋</span></button>`).join('') || '<div class="empty">Topilmadi</div>'}</div>`)
  const inp = document.getElementById('pk-q'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length) }
}

// ---------- оценка занятия ----------
const SCALES = [['mood', 'Kayfiyat', ['😞', '😕', '😐', '🙂', '😄']], ['fatigue', 'Charchoq (5 — tetik)', ['😵', '😩', '😐', '🙂', '💪']], ['soreness', "Mushak og'rig'i (5 — og'riq yo'q)", ['🔥', '😣', '😐', '🙂', '👍']]]
export function finishSheet(s, v) {
  const faces = SCALES.map(([key, label, f]) => `<div class="muted small">${label}</div><div class="faces">${f.map((e, i) => `<button class="face" aria-pressed="${v[key] === i + 1}" data-act="fv" data-k="${key}" data-v="${i + 1}">${e}<small>${i + 1}</small></button>`).join('')}</div>`).join('')
  openSheet(`<div class="between"><h2>Mashg'ulotni baholash</h2><button class="link" data-close>✕</button></div>
    <div class="muted small">Mashg'ulot sizga qanchalik og'ir bo'ldi? (1–10)</div>
    <div class="chips">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<button class="pill" aria-pressed="${v.rpe === n}" data-act="fv" data-k="rpe" data-v="${n}">${n}</button>`).join('')}</div>
    ${v.rpe ? `<div class="muted small">${v.rpe} — ${RPE_LABELS[v.rpe]}</div>` : ''}
    <label class="fld"><span>Davomiyligi (daqiqa)</span><input id="fv-min" inputmode="numeric" value="${esc(v.minutes ?? '')}"></label>
    ${faces}
    <label class="fld"><span>Izoh (ixtiyoriy)</span><input id="fv-note" value="${esc(v.note ?? '')}" placeholder="Og'riq, kasallik, boshqa…"></label>
    <div class="neg small" id="fv-err"></div>
    <button class="btn" data-act="fsend">Yuborish</button>`)
}
export function finishDone(v, logs) {
  const hrs = logs.map(l => l.heart_rate).filter(Boolean)
  const avgPct = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length / maxHr(S.me?.age ?? S.plan.age) : null
  const r = finishAdvice({ ...v, avgPct })
  openSheet(`<h2>Mashg'ulot yakunlandi 💪</h2>${r.srpe ? `<div class="muted small">Yuklama (RPE × daqiqa): <b>${r.srpe}</b></div>` : ''}
    <div class="advice good">${r.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div><button class="btn" data-close>Yopish</button>`)
}

// ---------- Natijalar ----------
export function statsHtml() {
  const logs = S.plan.logs
  const days = new Map()
  for (const l of logs) {
    const r = days.get(l.logged_on) || { day: l.logged_on, n: 0, hr: [] }
    r.n++; if (l.heart_rate) r.hr.push(l.heart_rate); days.set(l.logged_on, r)
  }
  const rows = [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
  const all = rows.flatMap(r => r.hr)
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null
  const load = muscleLoad(logs, groupOf, addDays(isoDate(), -6))
  const maxLoad = Math.max(1, ...Object.values(load))
  // Лучшие подъёмы (расчётный максимум на 1 повторение).
  const best = new Map()
  for (const l of logs) for (const t of l.detail?.sets || []) { const e = epley(t.w, t.r); if (e > (best.get(l.exercise_id)?.v || 0)) best.set(l.exercise_id, { v: e, t, d: l.logged_on }) }
  const top = [...best.entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 6)
  // Лучшие времена на воде: лучший отрезок на 500 м.
  const waterBest = []
  for (const l of logs) { const c = catById.get(l.exercise_id); if (c?.mode === 'water') for (const t of l.detail?.sets || []) if (t.t) waterBest.push({ n: exName(c, c.name), t: t.t, d: l.logged_on }) }
  waterBest.sort((a, b) => a.t - b.t)
  return `<section>
    <div class="kpis"><div class="kpi"><span>Mashg'ulot kuni</span><b>${rows.length}</b></div><div class="kpi"><span>Yozilgan mashq</span><b>${logs.length}</b></div><div class="kpi"><span>O'rtacha puls</span><b>${avg ?? '—'}</b></div></div>
    <h2>Mushaklar yuklamasi (7 kun)</h2>
    <div class="panel">${Object.keys(load).length ? Object.entries(load).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<div class="barrow"><span>${MUSCLES[g] || g}</span><div><div class="bar" style="width:${Math.round((n / maxLoad) * 100)}%"></div></div><span class="num">${n}</span></div>`).join('') + '<div class="note">Raqam — oxirgi 7 kundagi urinishlar soni.</div>' : '<div class="empty">Hali zal natijalari yo\'q.</div>'}</div>
    ${top.length ? `<h2>Eng yaxshi natijalar (zal)</h2><div class="panel"><div class="list">${top.map(([id, b]) => `<div class="item" style="cursor:default"><span class="main"><b>${esc(exName(catById.get(id), catById.get(id)?.name) || '—')}</b><span class="muted small">${b.t.w ? `${b.t.w} kg × ${b.t.r}` : `${b.t.r} marta`} · ${dayLabel(b.d)}</span></span><span class="chip">1PM ≈ ${Math.round(b.v)}</span></div>`).join('')}</div></div>` : ''}
    ${waterBest.length ? `<h2>Suvdagi eng tez otrezoklar</h2><div class="panel"><div class="list">${waterBest.slice(0, 5).map(w => `<div class="item" style="cursor:default"><span class="main"><b>${esc(w.n)}</b><span class="muted small">${dayLabel(w.d)}</span></span><span class="chip num">${formatDuration(w.t)}</span></div>`).join('')}</div></div>` : ''}
    <h2>Kunlar</h2>
    <div class="panel">${rows.length ? `<div class="list">${rows.slice(0, 30).map(r => { const fb = S.plan.feedback.find(f => f.logged_on === r.day); return `<div class="item" style="cursor:default"><span class="main"><b>${dayLabel(r.day)}</b><span class="muted small">${r.n} ta mashq${fb ? ` · og'irlik ${fb.rpe}/10` : ''}</span></span><span class="chip num">♥ ${r.hr.length ? Math.round(r.hr.reduce((a, b) => a + b, 0) / r.hr.length) : '—'}</span></div>` }).join('')}</div>` : '<div class="empty">Hali natija kiritilmagan.</div>'}</div>
  </section>`
}

// ---------- профиль ----------
export function profileSheet() {
  openSheet(`<div class="between"><h2>Profil</h2><button class="link" data-close>✕</button></div>
    <div class="muted small">${esc(S.me.full_name)}${S.me.age ? ` · ${S.me.age} yosh · maksimal puls ≈ ${maxHr(S.me.age)}` : ''}</div>
    <label class="fld"><span>Vazningiz, kg (zalda kkal hisoblash uchun)</span><input id="pf-w" inputmode="decimal" value="${esc(S.settings.weight)}"></label>
    <div class="fld"><span>Qayiq turi (zarba sanash qoidasi)</span><div class="seg"><button aria-pressed="${!S.settings.boat}" data-act="pfboat" data-b="">Avto</button><button aria-pressed="${S.settings.boat === 'kayak'}" data-act="pfboat" data-b="kayak">Baydarka</button><button aria-pressed="${S.settings.boat === 'canoe'}" data-act="pfboat" data-b="canoe">Kanoe</button></div></div>
    ${installHtml()}
    <button class="btn ghost" data-act="logout">Chiqish</button>`)
}

// ---------- выбор языка ----------
export function langSheet() {
  openSheet(`<div class="between"><h2>Til</h2><button class="link" data-close>✕</button></div>
    <div class="list">${LANGS.map(([k, n]) => `<button class="item" data-act="setlang" data-l="${k}"><span class="main"><b>${n}</b></span><span class="chip ${getLang() === k ? 'ok' : ''}">${getLang() === k ? '✓' : ''}</span></button>`).join('')}</div>`)
}
