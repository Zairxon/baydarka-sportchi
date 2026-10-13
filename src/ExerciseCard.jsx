import { useEffect, useState } from 'react'
import PulseFlow from './PulseFlow'
import { unlockAudio, tickBeep, goBeep, stopBeep } from './audio'
import { formatDuration, parseDuration, validPulse } from './fmt'

// Карточка упражнения в стиле Торсо: название, кнопка «i» с техникой, план тренера,
// строки подходов с галочкой, затем замер пульса и «Сохранить».
//  weight — вес и повторы;  reps — повторы;  timed — повторы за время тренера;
//  water — время каждого отрезка;  time — время.
const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))
const uuid = () => {
  if (crypto?.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function planText(x) {
  const p = x.plan || {}
  const t = s => formatDuration(s)
  if (x.mode === 'weight') return [p.sets && p.reps ? `${p.sets} × ${p.reps}` : p.reps ? `${p.reps} marta` : '', p.weight ? `${p.weight} kg` : ''].filter(Boolean).join(' · ')
  if (x.mode === 'reps') return p.reps ? `${p.sets || 1} × ${p.reps}` : ''
  if (x.mode === 'timed') return [p.sets > 1 ? `${p.sets} marta` : '', p.time ? `har biri ${t(p.time)}` : ''].filter(Boolean).join(' · ')
  if (x.mode === 'water') return [p.segments ? `${p.segments} otrezok` : '', p.distance ? `${p.distance} m` : ''].filter(Boolean).join(' × ')
  if (x.mode === 'time') return p.time ? t(p.time) : ''
  return ''
}

const emptySet = (x, i) => {
  const p = x.plan || {}
  if (x.mode === 'weight') return { w: p.weight != null ? String(p.weight) : '', r: '', done: false }
  if (x.mode === 'timed') return { r: '', t: p.time || 0, done: false }
  if (x.mode === 'water' || x.mode === 'time') return { t: '', done: false, n: i + 1 }
  return { r: '', done: false }
}

function initialSets(x, log) {
  if (log?.detail?.sets?.length) return log.detail.sets.map(s => ({ ...s, w: s.w != null ? String(s.w) : '', r: s.r != null ? String(s.r) : '', t: x.mode === 'water' || x.mode === 'time' ? (s.t != null ? formatDuration(s.t) : '') : s.t, done: true }))
  const p = x.plan || {}
  const n = x.mode === 'water' ? p.segments || 1 : x.mode === 'time' ? 1 : p.sets || 1
  return Array.from({ length: n }, (_, i) => emptySet(x, i))
}

export default function ExerciseCard({ s, x, log, draft, setDraft, age, onSave, justSaved, onFlowResult }) {
  const [info, setInfo] = useState(false)
  const [err, setErr] = useState('')
  const sets = draft?.sets || initialSets(x, log)
  const hr = draft?.hr1 != null ? { hr1: draft.hr1, hr2: draft.hr2 } : (log?.heart_rate ? { hr1: log.heart_rate, hr2: log.recovery_hr } : null)
  const done = !!(log && log.heart_rate)
  const allDone = sets.some(st => st.done)
  const [manual, setManual] = useState(false)
  const id = draft?.id || log?.id

  const patchSet = (i, patch) => {
    const next = sets.map((st, j) => (j === i ? { ...st, ...patch } : st))
    setDraft({ sets: next, id: id || uuid() })
  }
  const addSet = () => setDraft({ sets: [...sets, emptySet(x, sets.length)], id: id || uuid() })

  const tick = i => {
    const st = sets[i]
    if (!st.done) {
      const ok = x.mode === 'water' || x.mode === 'time' ? parseDuration(st.t) > 0
        : x.mode === 'weight' ? num(st.r) > 0 && (st.w === '' || num(st.w) >= 0)
        : num(st.r) > 0
      if (!ok) return setErr(x.mode === 'water' || x.mode === 'time' ? 'Vaqtni kiriting (2:35 yoki sekund).' : 'Necha marta qilganingizni kiriting.')
    }
    setErr('')
    patchSet(i, { done: !st.done })
  }

  const save = async () => {
    setErr('')
    const doneSets = sets.filter(st => st.done)
    if (!doneSets.length) return setErr('Kamida bitta urinishni ✓ bilan belgilang.')
    if (!hr || !validPulse(hr.hr1)) return setErr('Puls majburiy: avval pulsni o\'lchang.')
    const p = x.plan || {}
    let reps = null, weight = null, duration = null, distance = null, detail
    if (x.mode === 'weight') {
      const top = [...doneSets].sort((a, b) => (num(b.w) || 0) - (num(a.w) || 0) || (num(b.r) || 0) - (num(a.r) || 0))[0]
      weight = num(top.w); reps = Math.round(num(top.r))
      detail = doneSets.map(st => ({ w: num(st.w), r: Math.round(num(st.r)) }))
    } else if (x.mode === 'reps') {
      reps = doneSets.reduce((a, st) => a + Math.round(num(st.r)), 0)
      detail = doneSets.map(st => ({ r: Math.round(num(st.r)) }))
    } else if (x.mode === 'timed') {
      reps = doneSets.reduce((a, st) => a + Math.round(num(st.r)), 0)
      duration = doneSets.reduce((a, st) => a + (Number(st.t) || 0), 0) || null
      detail = doneSets.map(st => ({ r: Math.round(num(st.r)), t: Number(st.t) || null }))
    } else if (x.mode === 'water') {
      const ts = doneSets.map(st => parseDuration(st.t))
      reps = ts.length
      duration = Math.round((ts.reduce((a, b) => a + b, 0) / ts.length) * 100) / 100
      distance = p.distance ? p.distance * ts.length : null
      detail = ts.map(t => ({ t }))
    } else {
      duration = parseDuration(doneSets[0].t)
      detail = [{ t: duration }]
    }
    await onSave({
      id: id || uuid(), session_id: s.id, session_exercise_id: x.sx, exercise_id: x.ex, set_no: x.set_no ?? 1,
      logged_on: s.session_date, reps, weight_kg: weight, duration_seconds: duration, distance_m: distance,
      heart_rate: Math.round(hr.hr1), recovery_hr: hr.hr2 == null ? null : Math.round(hr.hr2),
      note: draft?.note || null, detail: { sets: detail },
    })
  }

  const setHeader = x.mode === 'weight' ? ['Kg', 'Marta'] : x.mode === 'timed' ? ['Marta', 'Vaqt'] : x.mode === 'water' ? ['Otrezok', 'Vaqt (m:ss)'] : x.mode === 'time' ? ['', 'Vaqt (m:ss)'] : ['', 'Marta']

  return (
    <div className={`card ex ${done ? 'done' : ''}`}>
      <div className="between">
        <b>{x.name}{x.of > 1 ? ` · #${x.set_no}` : ''} <span className="exi" role="button" tabIndex={0} onClick={() => setInfo(true)} aria-label="Mashq tavsifi">i</span></b>
        {done && <span className="pill ok">✓ yozildi</span>}
      </div>
      <div className="muted small">{x.muscles}{x.rest ? ` · dam ≈ ${formatDuration(x.rest)}` : ''}</div>
      {(planText(x) || x.prescription) && (
        <div className="task">Reja: <b>{planText(x) || x.prescription}</b>{planText(x) && x.prescription && planText(x) !== x.prescription ? <span className="muted small"> ({x.prescription})</span> : null}</div>
      )}

      <div className="setrow head"><span /><span>{setHeader[0]}</span><span>{setHeader[1]}</span><span /></div>
      {sets.map((st, i) => (
        <div key={i} className={`setrow ${st.done ? 'done' : ''}`}>
          <span className="sn">{i + 1}</span>
          {x.mode === 'weight' && <>
            <input className="input" inputMode="decimal" placeholder="kg" value={st.w ?? ''} onChange={e => patchSet(i, { w: e.target.value })} />
            <input className="input" inputMode="numeric" placeholder={x.plan?.reps ? String(x.plan.reps) : 'marta'} value={st.r ?? ''} onChange={e => patchSet(i, { r: e.target.value })} />
          </>}
          {x.mode === 'reps' && <>
            <span />
            <input className="input" inputMode="numeric" placeholder={x.plan?.reps ? String(x.plan.reps) : 'marta'} value={st.r ?? ''} onChange={e => patchSet(i, { r: e.target.value })} />
          </>}
          {x.mode === 'timed' && <>
            <input className="input" inputMode="numeric" placeholder="marta" value={st.r ?? ''} onChange={e => patchSet(i, { r: e.target.value })} />
            <Countdown seconds={st.t} />
          </>}
          {(x.mode === 'water' || x.mode === 'time') && <>
            <span className="muted small center">{x.mode === 'water' ? `${x.plan?.distance ? x.plan.distance + ' m' : ''}` : ''}</span>
            <input className="input" inputMode="text" placeholder={x.plan?.time ? formatDuration(x.plan.time) : '2:35'} value={st.t ?? ''} onChange={e => patchSet(i, { t: e.target.value })} />
          </>}
          <button className={`tick ${st.done ? 'on' : ''}`} onClick={() => tick(i)} aria-label="Tayyor">✓</button>
        </div>
      ))}
      {(x.mode === 'weight' || x.mode === 'reps') && <button className="add" onClick={addSet}>＋ Urinish</button>}

      {allDone && !hr && !manual && <PulseFlow age={age} baseRest={x.rest} onDone={r => { setDraft({ hr1: r.hr1, hr2: r.hr2, adv: r.advice?.level }); onFlowResult?.(x, r.advice) }} />}
      {!hr && !manual && allDone && <button className="link" onClick={() => setManual(true)}>Pulsni qo'lda kiritish</button>}
      {!hr && manual && (
        <div className="grid">
          <label className="req">Puls * (urish/daq)
            <input className="input" inputMode="numeric" onChange={e => setDraft({ hr1: num(e.target.value) })} />
          </label>
          <label>1 daq dam olgandan keyin
            <input className="input" inputMode="numeric" onChange={e => setDraft({ hr2: num(e.target.value) })} />
          </label>
        </div>
      )}
      {hr && (
        <div className="hrdone">♥ Puls: <b>{hr.hr1}</b>{hr.hr2 != null ? <> → 1 daq: <b>{hr.hr2}</b> (−{hr.hr1 - hr.hr2})</> : null}
          {!done && <button className="link" onClick={() => setDraft({ hr1: null, hr2: null })}> qayta o'lchash</button>}</div>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn" onClick={save} disabled={!allDone || !hr}>{justSaved ? 'Saqlandi ✓' : done ? 'Yangilash' : 'Saqlash'}</button>

      {info && <InfoSheet x={x} onClose={() => setInfo(false)} />}
    </div>
  )
}

// Обратный отсчёт заданного тренером времени (имитация с веслом): 3-2-1 на последних секундах.
function Countdown({ seconds }) {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const running = until > now
  useEffect(() => {
    if (!until) return undefined
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [until])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  useEffect(() => {
    if (!until) return
    if (left > 0 && left <= 3) tickBeep()
    if (left === 0) { stopBeep(); setUntil(0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])
  if (!seconds) return <span className="muted small center">—</span>
  return (
    <button className={`timer ${running ? 'run' : ''}`} onClick={() => { unlockAudio(); if (running) setUntil(0); else { goBeep(); const t = Date.now() + seconds * 1000; setNow(Date.now()); setUntil(t) } }}>
      {running ? formatDuration(left) : `▶ ${formatDuration(seconds)}`}
    </button>
  )
}

function InfoSheet({ x, onClose }) {
  const i = x.info || {}
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-in" onClick={e => e.stopPropagation()}>
        <div className="between"><b>{x.name}</b><button className="link" onClick={onClose}>✕</button></div>
        {i.muscles && <div className="muted small">Ishlaydigan mushaklar: {i.muscles}</div>}
        {i.steps?.length > 0 && <ol className="steps">{i.steps.map((st, k) => <li key={k}>{st}</li>)}</ol>}
        {i.tip && <div className="advice warn"><b>Maslahat:</b> {i.tip}</div>}
        {!i.steps?.length && !i.tip && !i.muscles && <div className="muted">Tavsif yo'q.</div>}
      </div>
    </div>
  )
}
