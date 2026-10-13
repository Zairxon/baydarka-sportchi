import { useEffect, useRef, useState } from 'react'
import { unlockAudio, tickBeep, goBeep, stopBeep, keepAwake } from './audio'
import { bpmFrom10, validBeats10, pulseAdvice } from './advice'
import { formatDuration } from './fmt'

// Замер пульса после упражнения (как просил тренер):
//  Старт → 3-2-1 со звуком → сигнал, 10 секунд считаем удары → сигнал, вводим число →
//  отдых 1 минута (кольцо) → 3-2-1 → сигнал, снова 10 секунд → сигнал, вводим число →
//  совет: сколько ещё отдыхать. Пульс = удары за 10 с × 6.
//
// Время считается по часам (Date.now), а не по числу тиков: если экран на секунду
// «замёрз», отсчёт не уезжает.
const COUNT_MS = 10000
const REST_MS = 60000

export default function PulseFlow({ age, baseRest, onDone }) {
  const [phase, setPhase] = useState('idle')   // idle pre1 count1 enter1 rest pre2 count2 enter2 result extra
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [beats, setBeats] = useState('')
  const [hr1, setHr1] = useState(null)
  const [hr2, setHr2] = useState(null)
  const [advice, setAdvice] = useState(null)
  const [extraTotal, setExtraTotal] = useState(0)
  const lastSec = useRef(-1)

  const go = (p, ms) => { lastSec.current = -1; setPhase(p); setUntil(Date.now() + ms); setNow(Date.now()) }
  const running = ['pre1', 'count1', 'rest', 'pre2', 'count2', 'extra'].includes(phase)

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(Date.now()), 150)
    return () => clearInterval(id)
  }, [running])

  const left = Math.max(0, until - now)
  const sec = Math.ceil(left / 1000)

  // Звуки по секундам и переходы между фазами.
  useEffect(() => {
    if (!running) return
    if (['pre1', 'pre2'].includes(phase) && sec !== lastSec.current && sec > 0) { lastSec.current = sec; tickBeep() }
    if (left > 0) return
    if (phase === 'pre1') { goBeep(); go('count1', COUNT_MS) }
    else if (phase === 'count1') { stopBeep(); setPhase('enter1') }
    else if (phase === 'rest') { go('pre2', 3000) }
    else if (phase === 'pre2') { goBeep(); go('count2', COUNT_MS) }
    else if (phase === 'count2') { stopBeep(); setPhase('enter2') }
    else if (phase === 'extra') { goBeep(); setPhase('result') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase])

  useEffect(() => { keepAwake(running || phase.startsWith('enter')); return () => { keepAwake(false) } }, [running, phase])

  const start = () => { unlockAudio(); setBeats(''); go('pre1', 3000) }

  const confirm1 = () => {
    if (!validBeats10(beats)) return
    setHr1(bpmFrom10(beats)); setBeats(''); go('rest', REST_MS)
  }
  const confirm2 = () => {
    if (!validBeats10(beats)) return
    const h2 = bpmFrom10(beats)
    setHr2(h2); setBeats('')
    const a = pulseAdvice({ hr1, hr2: h2, age, baseRest })
    setAdvice(a); setExtraTotal(a.extra); setPhase('result')
  }
  const extra = () => { unlockAudio(); go('extra', advice.extra * 1000) }
  const finish = () => onDone({ hr1, hr2, advice })

  if (phase === 'idle') {
    return (
      <div className="pulse">
        <div className="muted small">Mashq tugadi. Pulsni o'lchang: Start → 3-2-1 → 10 soniya davomida urishlarni sanang.</div>
        <button className="btn" onClick={start}>▶ Start — pulsni o'lchash</button>
      </div>
    )
  }

  if (phase === 'pre1' || phase === 'pre2') {
    return (
      <div className="pulse center">
        <div className="muted">{phase === 'pre1' ? 'Tayyorlaning. Bilakdagi yoki bo\'yindagi pulsni toping' : 'Ikkinchi o\'lchov. Pulsni toping'}</div>
        <div className="bignum">{Math.max(sec, 1)}</div>
      </div>
    )
  }

  if (phase === 'count1' || phase === 'count2') {
    return (
      <div className="pulse center go">
        <div className="goText">SANANG! Urishlarni sanang</div>
        <div className="bignum">{sec}</div>
        <Ring left={left} total={COUNT_MS} />
      </div>
    )
  }

  if (phase === 'enter1' || phase === 'enter2') {
    const first = phase === 'enter1'
    return (
      <div className="pulse">
        <b>{first ? '1-o\'lchov' : '2-o\'lchov (1 daqiqa dam olgandan keyin)'}: 10 soniyada nechta urish?</b>
        <input className="input big" inputMode="numeric" autoFocus value={beats} onChange={e => setBeats(e.target.value.replace(/\D/g, ''))} placeholder="masalan, 25" />
        {beats && validBeats10(beats) && <div className="conv">{beats} × 6 = <b>{bpmFrom10(beats)}</b> <span className="muted small">urish/daq</span></div>}
        {beats && !validBeats10(beats) && <div className="err">10 soniyada 5 dan 40 gacha urish bo'ladi.</div>}
        <button className="btn" disabled={!validBeats10(beats)} onClick={first ? confirm1 : confirm2}>Tasdiqlash</button>
      </div>
    )
  }

  if (phase === 'rest') {
    return (
      <div className="pulse center">
        <div className="muted">1 daqiqa dam oling · 1-puls: <b>{hr1}</b></div>
        <div className="bignum">{formatDuration(Math.ceil(left / 1000))}</div>
        <Ring left={left} total={REST_MS} />
        <div className="muted small">Bir daqiqadan so'ng signal va 3-2-1 bo'ladi, so'ng yana 10 soniya pulsni sanaysiz.</div>
        <button className="link" onClick={() => go('pre2', 3000)}>Dam olishni o'tkazib yuborish</button>
      </div>
    )
  }

  if (phase === 'extra') {
    return (
      <div className="pulse center">
        <div className="muted">Qo'shimcha dam</div>
        <div className="bignum">{formatDuration(Math.ceil(left / 1000))}</div>
        <Ring left={left} total={extraTotal * 1000} />
        <button className="link" onClick={() => setPhase('result')}>Tayyorman, o'tkazib yuborish</button>
      </div>
    )
  }

  // result
  const a = advice
  const tone = a.level === 'stop' ? 'bad' : a.level === 'rest' ? 'warn' : 'good'
  return (
    <div className="pulse">
      <div className="pulses">
        <div><span className="muted small">Mashqdan keyin</span><b>{hr1}</b><span className="muted small">{Math.round(a.p1 * 100)}% max</span></div>
        <div><span className="muted small">1 daqiqadan keyin</span><b>{hr2}</b><span className="muted small">{Math.round(a.p2 * 100)}% max</span></div>
        <div><span className="muted small">Tushish</span><b>−{a.drop}</b><span className="muted small">max ≈ {a.mx}</span></div>
      </div>
      <div className={`advice ${tone}`}>{a.msgs.map((m, i) => <p key={i}>{m}</p>)}</div>
      {a.extra > 0 && (
        <button className="btn ghost" onClick={extra}>⏱ Qo'shimcha dam: {formatDuration(a.extra)}</button>
      )}
      <button className="btn" onClick={finish}>Puls yozildi — davom etish</button>
    </div>
  )
}

// Кольцо обратного отсчёта (как таймер отдыха в Торсо).
function Ring({ left, total }) {
  const r = 52, c = 2 * Math.PI * r
  const frac = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0
  return (
    <svg className="ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--elev)" strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 60 60)" />
    </svg>
  )
}
