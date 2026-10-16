import { unlockAudio, tickBeep, goBeep, stopBeep, keepAwake } from './audio.js'
import { bpmFrom10, validBeats10, pulseAdvice } from './advice.js'
import { formatDuration, esc } from './util.js'
import { tr } from './i18n.js'

// Полноэкранные сценарии со звуком: замер пульса, отсчёт времени, части тренажёра, таймер отдыха в зале.
// Время считается по часам (Date.now), поэтому «замёрзший» экран не сбивает отсчёт.
const host = () => document.getElementById('flow')
let timer = null

export function closeFlow() {
  clearInterval(timer); timer = null
  const h = host(); if (h) h.innerHTML = ''
  keepAwake(false)
}

const shell = html => tr(`<div class="fl"><div class="fl-in">${html}</div></div>`)
const ring = (left, total) => {
  const r = 52, c = 2 * Math.PI * r, f = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0
  return `<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--soft)" stroke-width="9"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 60 60)"/></svg>`
}

// ---------- замер пульса ----------
// Старт → 3-2-1 со звуком → сигнал, 10 секунд счёта → сигнал, ввод → отдых 1 минута → 3-2-1 →
// сигнал, 10 секунд → сигнал, ввод → совет. Пульс = удары за 10 с × 6.
const COUNT_MS = 10000, REST_MS = 60000

export function pulseFlow({ age, baseRest, onDone }) {
  closeFlow()
  let phase = 'intro', until = 0, now = Date.now(), last = -1, hr1 = null, hr2 = null, adv = null, extraTotal = 0

  const left = () => Math.max(0, until - now)
  const sec = () => Math.ceil(left() / 1000)
  const go = (p, ms) => { phase = p; until = Date.now() + ms; now = Date.now(); last = -1; paint() }
  const startTimer = () => { clearInterval(timer); timer = setInterval(tick, 150) }

  function tick() {
    now = Date.now()
    const s = sec()
    if ((phase === 'pre1' || phase === 'pre2') && s !== last && s > 0) { last = s; tickBeep() }
    if (left() <= 0) {
      if (phase === 'pre1') { goBeep(); go('count1', COUNT_MS) }
      else if (phase === 'count1') { stopBeep(); phase = 'enter1'; paint() }
      else if (phase === 'rest') go('pre2', 3000)
      else if (phase === 'pre2') { goBeep(); go('count2', COUNT_MS) }
      else if (phase === 'count2') { stopBeep(); phase = 'enter2'; paint() }
      else if (phase === 'extra') { goBeep(); phase = 'result'; paint() }
      return
    }
    paintTime()
  }

  function paintTime() {
    const el = document.getElementById('fl-time'); if (!el) return
    el.textContent = phase === 'rest' || phase === 'extra' ? formatDuration(sec()) : String(Math.max(sec(), 1))
    const rg = document.getElementById('fl-ring'); if (rg) rg.innerHTML = ring(left(), phase === 'count1' || phase === 'count2' ? COUNT_MS : phase === 'rest' ? REST_MS : extraTotal * 1000)
  }

  function paint() {
    let body = ''
    if (phase === 'intro') {
      body = `<h2>Puls o'lchash</h2><p class="muted">Pulsni bilakdan (bosh barmoq tomonida) yoki bo'ynidan toping. Start bosilgach 3-2-1 sanaladi, so'ng 10 soniya davomida urishlarni sanaysiz. Signal — to'xtang va sonni yozing.</p><button class="btn" data-fl="start">▶ Start</button>`
    } else if (phase === 'pre1' || phase === 'pre2') {
      body = `<p class="muted">${phase === 'pre1' ? 'Tayyorlaning. Pulsni toping' : '2-o\'lchov. Pulsni toping'}</p><div class="bignum" id="fl-time">${Math.max(sec(), 1)}</div>`
    } else if (phase === 'count1' || phase === 'count2') {
      body = `<div class="go">SANANG!</div><p class="muted">Urishlarni sanang</p><div class="bignum" id="fl-time">${sec()}</div><div id="fl-ring">${ring(left(), COUNT_MS)}</div>`
    } else if (phase === 'enter1' || phase === 'enter2') {
      body = `<h2>${phase === 'enter1' ? '1-o\'lchov' : '2-o\'lchov (1 daqiqa dam olgandan keyin)'}</h2><p>10 soniyada nechta urish?</p>
        <input class="big" id="fl-beats" inputmode="numeric" autocomplete="off" placeholder="masalan, 25"><div id="fl-conv" class="conv"></div>
        <button class="btn" id="fl-ok" data-fl="ok" disabled>Tasdiqlash</button>`
    } else if (phase === 'rest') {
      body = `<p class="muted">1 daqiqa dam oling · 1-puls: <b>${hr1}</b></p><div class="bignum" id="fl-time">${formatDuration(sec())}</div><div id="fl-ring">${ring(left(), REST_MS)}</div><p class="muted small">Bir daqiqadan so'ng signal va 3-2-1 bo'ladi, so'ng yana 10 soniya pulsni sanaysiz.</p><button class="link" data-fl="skip">Dam olishni o'tkazib yuborish</button>`
    } else if (phase === 'extra') {
      body = `<p class="muted">Qo'shimcha dam</p><div class="bignum" id="fl-time">${formatDuration(sec())}</div><div id="fl-ring">${ring(left(), extraTotal * 1000)}</div><button class="link" data-fl="ready">Tayyorman — o'tkazib yuborish</button>`
    } else if (phase === 'result') {
      const a = adv, tone = a.level === 'stop' ? 'bad' : a.level === 'rest' ? 'warn' : 'good'
      body = `<h2>Natija</h2><div class="pulses"><div><span class="muted small">Mashqdan keyin</span><b>${hr1}</b><span class="muted small">${Math.round(a.p1 * 100)}% max</span></div>
        <div><span class="muted small">1 daqiqadan keyin</span><b>${hr2}</b><span class="muted small">${Math.round(a.p2 * 100)}% max</span></div>
        <div><span class="muted small">Tushish</span><b>−${a.drop}</b><span class="muted small">max ≈ ${a.mx}</span></div></div>
        <div class="advice ${tone}">${a.msgs.map(m => `<p>${esc(m)}</p>`).join('')}</div>
        ${a.extra > 0 ? `<button class="btn ghost" data-fl="extra">⏱ Qo'shimcha dam: ${formatDuration(a.extra)}</button>` : ''}
        <button class="btn" data-fl="done">Puls yozildi — davom etish</button>`
    }
    const cancel = phase === 'result' ? '' : '<button class="fl-x" data-fl="cancel" aria-label="Yopish">✕</button>'
    host().innerHTML = shell(cancel + body)
    const inp = document.getElementById('fl-beats')
    if (inp) {
      inp.focus()
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '')
        const ok = validBeats10(inp.value)
        document.getElementById('fl-ok').disabled = !ok
        document.getElementById('fl-conv').innerHTML = tr(inp.value
          ? (ok ? `${inp.value} × 6 = <b>${bpmFrom10(inp.value)}</b> <span class="muted small">urish/daq</span>` : `<span class="neg small">10 soniyada 5 dan 40 gacha urish bo'ladi</span>`) : '')
      })
    }
  }

  host().onclick = e => {
    const b = e.target.closest('[data-fl]'); if (!b) return
    const a = b.dataset.fl
    if (a === 'start') { unlockAudio(); keepAwake(true); startTimer(); go('pre1', 3000) }
    else if (a === 'cancel') closeFlow()
    else if (a === 'ok') {
      const beats = document.getElementById('fl-beats').value
      if (!validBeats10(beats)) return
      if (phase === 'enter1') { hr1 = bpmFrom10(beats); go('rest', REST_MS) }
      else { hr2 = bpmFrom10(beats); adv = pulseAdvice({ hr1, hr2, age, baseRest }); extraTotal = adv.extra; clearInterval(timer); phase = 'result'; paint() }
    }
    else if (a === 'skip') go('pre2', 3000)
    else if (a === 'extra') { unlockAudio(); startTimer(); go('extra', adv.extra * 1000) }
    else if (a === 'ready') { phase = 'result'; paint() }
    else if (a === 'done') { const r = { hr1, hr2, advice: adv }; closeFlow(); onDone(r) }
  }
  paint()
}

// ---------- отсчёт заданного тренером времени (имитация, часть тренажёра) ----------
// parts: [{ name, sec }]. 3-2-1, затем каждая часть; звук на границах, последние 3 секунды — отсчёт.
export function timerFlow({ title, parts: all, onDone }) {
  closeFlow()
  const parts = all.filter(p => p.sec > 0)
  if (!parts.length) return
  let i = -1, until = 0, now = Date.now(), last = -1, finished = false
  const sec = () => Math.ceil(Math.max(0, until - now) / 1000)

  function step() {
    now = Date.now()
    const s = sec()
    if ((i === -1 || s <= 3) && s > 0 && s !== last && !finished) { last = s; tickBeep() }
    if (until - now > 0) return paintTime()
    last = -1
    if (i === -1) { goBeep(); i = 0; until = Date.now() + parts[0].sec * 1000 }
    else if (i + 1 < parts.length) { goBeep(); i++; until = Date.now() + parts[i].sec * 1000 }
    else { stopBeep(); finished = true; clearInterval(timer); keepAwake(false) }
    now = Date.now(); paint()
  }
  const paintTime = () => { const el = document.getElementById('fl-time'); if (el) el.textContent = i === -1 ? String(Math.max(sec(), 1)) : formatDuration(sec()) }

  function paint() {
    let body
    if (finished) body = `<div class="go">Tugadi! 🎉</div><p>Endi natijani (zarba sonini) yozing.</p><button class="btn" data-fl="done">Davom etish</button>`
    else if (i === -2) body = `<h2>${esc(title)}</h2><p class="muted">${parts.map(p => `${esc(p.name)} ${formatDuration(p.sec)}`).join(' + ')}</p><button class="btn" data-fl="start">▶ Boshlash (3-2-1)</button>`
    else if (i === -1) body = `<p class="muted">Tayyorlaning</p><div class="bignum" id="fl-time">${Math.max(sec(), 1)}</div>`
    else body = `<div class="go">${esc(parts[i].name)}</div><div class="bignum" id="fl-time">${formatDuration(sec())}</div><p class="muted small">${parts[i + 1] ? `Keyingi: ${esc(parts[i + 1].name)} ${formatDuration(parts[i + 1].sec)}` : 'Oxirgi qism'}</p>`
    host().innerHTML = shell(`${finished ? '' : '<button class="fl-x" data-fl="cancel" aria-label="Yopish">✕</button>'}${body}`)
  }

  i = -2
  host().onclick = e => {
    const b = e.target.closest('[data-fl]'); if (!b) return
    if (b.dataset.fl === 'start') { unlockAudio(); keepAwake(true); i = -1; until = Date.now() + 3000; last = -1; clearInterval(timer); timer = setInterval(step, 150); paint() }
    else if (b.dataset.fl === 'cancel') closeFlow()
    else if (b.dataset.fl === 'done') { closeFlow(); onDone?.() }
  }
  paint()
}

// ---------- таймер отдыха между подходами (зал) ----------
let restEnd = 0, restTimer = null, restLast = -1
const bar = () => document.getElementById('restbar')

export function restStart(seconds) {
  unlockAudio()
  restEnd = Date.now() + seconds * 1000; restLast = -1
  clearInterval(restTimer); restTimer = setInterval(restTick, 200)
  restTick()
}
export function restStop() { clearInterval(restTimer); restTimer = null; const b = bar(); if (b) { b.hidden = true; b.innerHTML = '' } }
export function restAdjust(d) { restEnd += d * 1000; restTick() }

function restTick() {
  const b = bar(); if (!b) return
  const left = Math.ceil((restEnd - Date.now()) / 1000)
  if (left <= -3) return restStop()
  if (left > 0 && left <= 3 && left !== restLast) { restLast = left; tickBeep() }
  if (left === 0 && restLast !== 0) { restLast = 0; goBeep() }
  b.hidden = false
  b.innerHTML = tr(left > 0
    ? `<span>⏱ Dam: <b class="num">${formatDuration(left)}</b></span><span><button data-rest="-15">−15</button><button data-rest="15">+15</button><button data-rest="stop">✕</button></span>`
    : '<span><b>Tayyor! Keyingi urinish 💪</b></span><span><button data-rest="stop">✕</button></span>')
}

export function bindRestBar() {
  bar().addEventListener('click', e => {
    const b = e.target.closest('[data-rest]'); if (!b) return
    if (b.dataset.rest === 'stop') restStop(); else restAdjust(Number(b.dataset.rest))
  })
}
