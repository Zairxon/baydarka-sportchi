import { useState } from 'react'
import { RPE_LABELS, finishAdvice, maxHr } from './advice'

// Конец занятия: насколько тяжело (RPE 1–10), сколько минут и самочувствие
// (1–5, где 5 — хорошо). RPE × минуты — нагрузка занятия (sRPE), её считает приложение тренера.
const SCALES = [
  ['mood', 'Kayfiyat', ['😞', '😕', '😐', '🙂', '😄']],
  ['fatigue', 'Charchoq (5 — tetik)', ['😵', '😩', '😐', '🙂', '💪']],
  ['soreness', "Mushak og'rig'i (5 — og'riq yo'q)", ['🔥', '😣', '😐', '🙂', '👍']],
]

export default function Finish({ minutesDefault, logs, age, existing, onSubmit, onClose }) {
  const [v, setV] = useState({
    rpe: existing?.rpe ?? null, minutes: String(existing?.minutes ?? minutesDefault ?? ''),
    mood: existing?.mood ?? null, fatigue: existing?.fatigue ?? null, soreness: existing?.soreness ?? null, note: existing?.note || '',
  })
  const [done, setDone] = useState(null)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!v.rpe || !v.mood || !v.fatigue || !v.soreness) return setErr('Barcha savollarga javob bering.')
    const minutes = Math.round(Number(v.minutes)) || null
    setErr('')
    await onSubmit({ rpe: v.rpe, minutes, mood: v.mood, fatigue: v.fatigue, soreness: v.soreness, note: v.note || null })
    const hrs = logs.map(l => l.heart_rate).filter(Boolean)
    const avgPct = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length / maxHr(age) : null
    setDone(finishAdvice({ ...v, minutes, avgPct }))
  }

  if (done) {
    return (
      <div className="sheet" onClick={onClose}>
        <div className="sheet-in" onClick={e => e.stopPropagation()}>
          <h2>Mashg'ulot yakunlandi 💪</h2>
          {done.srpe && <div className="muted small">Yuklama (RPE × daqiqa): <b>{done.srpe}</b></div>}
          <div className="advice good">{done.lines.map((l, i) => <p key={i}>{l}</p>)}</div>
          <button className="btn" onClick={onClose}>Yopish</button>
        </div>
      </div>
    )
  }

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-in" onClick={e => e.stopPropagation()}>
        <div className="between"><h2>Mashg'ulotni baholash</h2><button className="link" onClick={onClose}>✕</button></div>
        <div className="muted small">Mashg'ulot sizga qanchalik og'ir bo'ldi?</div>
        <div className="chips">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} className={`chip ${v.rpe === n ? 'on' : ''}`} onClick={() => setV({ ...v, rpe: n })}>{n}</button>
          ))}
        </div>
        {v.rpe && <div className="muted small">{v.rpe} — {RPE_LABELS[v.rpe]}</div>}
        <label className="field">Mashg'ulot davomiyligi (daqiqa)
          <input className="input" inputMode="numeric" value={v.minutes} onChange={e => setV({ ...v, minutes: e.target.value.replace(/\D/g, '') })} />
        </label>
        {SCALES.map(([key, label, faces]) => (
          <div key={key}>
            <div className="muted small mt">{label}</div>
            <div className="chips">
              {faces.map((f, i) => (
                <button key={i} className={`chip wide ${v[key] === i + 1 ? 'on' : ''}`} onClick={() => setV({ ...v, [key]: i + 1 })}>{f}<small>{i + 1}</small></button>
              ))}
            </div>
          </div>
        ))}
        <label className="field">Izoh (ixtiyoriy)
          <input className="input" value={v.note} onChange={e => setV({ ...v, note: e.target.value })} placeholder="Og'riq, kasallik, boshqa…" />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={submit}>Yuborish</button>
      </div>
    </div>
  )
}
