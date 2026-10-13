import { useCallback, useEffect, useMemo, useState } from 'react'
import { login, loadPlan, submitLogs, submitFeedback } from './hub'
import { addDays, dayLabel, dayShort, formatDuration, isoDate } from './fmt'
import { fatigueCheck } from './advice'
import ExerciseCard from './ExerciseCard'
import Finish from './Finish'

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* память переполнена — работаем без кэша */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* нечего удалять */ } },
}

const SLOT = { morning: 'Ertalabki', evening: 'Kechki' }
const EMPTY_PLAN = { sessions: [], logs: [], feedback: [], age: null }

export default function App() {
  const [auth, setAuth] = useState(() => store.get('bs_auth'))
  const [me, setMe] = useState(() => store.get('bs_me'))

  const out = () => {
    ;['bs_auth', 'bs_me', 'bs_plan', 'bs_queue', 'bs_fbq', 'bs_drafts', 'bs_start'].forEach(store.del)
    setAuth(null); setMe(null)
  }

  if (!auth || !me) return <Login onDone={(c, m) => { store.set('bs_auth', c); store.set('bs_me', m); setAuth(c); setMe(m) }} />
  return <Main auth={auth} me={me} onLogout={out} />
}

function Login({ onDone }) {
  const [l, setL] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async e => {
    e.preventDefault()
    setBusy(true); setErr('')
    const auth = { login: l.trim(), password: p }
    try {
      const me = await login(auth.login, auth.password)
      onDone(auth, me)
    } catch (ex) {
      setErr(ex.status >= 400 && ex.status < 500
        ? "Login yoki parol noto'g'ri. Murabbiydan so'rang."
        : "Internetga ulanib bo'lmadi. Qayta urinib ko'ring.")
    }
    setBusy(false)
  }
  return (
    <div className="screen center">
      <div className="logo">🛶</div>
      <h1>Baydarka</h1>
      <p className="muted">Sportchi kundaligi</p>
      <form onSubmit={go} className="login">
        <input className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" placeholder="Login"
          value={l} onChange={e => setL(e.target.value)} />
        <input className="input" type="password" autoComplete="current-password" placeholder="Parol"
          value={p} onChange={e => setP(e.target.value)} />
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy || !l.trim() || !p}>{busy ? 'Tekshirilmoqda…' : 'Kirish'}</button>
      </form>
    </div>
  )
}

function Main({ auth, me, onLogout }) {
  const today = isoDate()
  const [day, setDay] = useState(today)
  const [plan, setPlan] = useState(() => ({ ...EMPTY_PLAN, ...store.get('bs_plan', {}) }))
  const [pending, setPending] = useState(() => store.get('bs_queue', []).length + store.get('bs_fbq', []).length)
  const [open, setOpen] = useState(null)       // id занятия
  const [online, setOnline] = useState(null)   // null = ещё не знаем
  const [view, setView] = useState('day')      // day | stats

  const range = useMemo(() => ({ from: addDays(today, -30), to: addDays(today, 14) }), [today])

  const sync = useCallback(async () => {
    try {
      const q = store.get('bs_queue', [])
      if (q.length) { await submitLogs(auth, q); store.set('bs_queue', []) }
      const fq = store.get('bs_fbq', [])
      for (const f of fq) { await submitFeedback(auth, f) }
      if (fq.length) store.set('bs_fbq', [])
      setPending(0)
      const p = await loadPlan(auth, range.from, range.to)
      const next = { ...EMPTY_PLAN, ...p }
      store.set('bs_plan', next); setPlan(next); setOnline(true)
    } catch (e) {
      setOnline(false)
      if (e.status === 400 || e.status === 401 || e.status === 403) onLogout()  // логин/пароль сменили
    }
  }, [auth, range, onLogout])

  useEffect(() => {
    sync()
    const on = () => sync()
    window.addEventListener('online', on)
    window.addEventListener('focus', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('focus', on) }
  }, [sync])

  const saveRows = async rows => {
    const q = [...store.get('bs_queue', []).filter(r => !rows.some(n => n.id === r.id)), ...rows]
    store.set('bs_queue', q); setPending(p => p + 1)
    // Локально сразу показываем как сохранённое.
    setPlan(p => {
      const np = { ...p, logs: [...p.logs.filter(l => !rows.some(n => n.id === l.id)), ...rows] }
      store.set('bs_plan', np)
      return np
    })
    const drafts = store.get('bs_drafts', {})
    rows.forEach(r => { delete drafts[r.session_exercise_id] })
    store.set('bs_drafts', drafts)
    await sync()
  }

  const saveFeedback = async (sessionId, fb, dateIso) => {
    const row = { session_id: sessionId, logged_on: dateIso, ...fb }
    store.set('bs_fbq', [...store.get('bs_fbq', []).filter(f => f.session_id !== sessionId), row])
    setPlan(p => {
      const np = { ...p, feedback: [...p.feedback.filter(f => f.session_id !== sessionId), row] }
      store.set('bs_plan', np)
      return np
    })
    await sync()
  }

  const sessionsOfDay = plan.sessions.filter(s => s.session_date === day)
  const opened = open && plan.sessions.find(s => s.id === open)

  if (opened) {
    return <Session s={opened} plan={plan} age={me.age ?? plan.age} onBack={() => setOpen(null)} onSave={saveRows} onFeedback={saveFeedback} />
  }

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="hello">{me.full_name}</div>
          <div className="muted small">{me.group_name || 'Guruh'}</div>
        </div>
        <button className="link" onClick={() => { if (confirm('Chiqishni xohlaysizmi?')) onLogout() }}>Chiqish</button>
      </header>

      {(online === false || pending > 0) && (
        <div className="banner">
          {pending > 0 ? "Yuborilmagan yozuvlar bor. Internet paydo bo'lganda avtomatik yuboriladi." : "Internet yo'q — oxirgi saqlangan reja ko'rsatilmoqda."}
        </div>
      )}

      <nav className="tabs">
        <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Mashg'ulot</button>
        <button className={view === 'stats' ? 'on' : ''} onClick={() => setView('stats')}>Natijalarim</button>
      </nav>

      {view === 'day' ? (
        <>
          <DayStrip day={day} setDay={setDay} today={today} sessions={plan.sessions} />
          <h2>{dayLabel(day)}</h2>
          {sessionsOfDay.length === 0 && <div className="empty">Bu kunga mashg'ulot rejalashtirilmagan.</div>}
          {sessionsOfDay.map(s => {
            const total = s.exercises.length
            const done = s.exercises.filter(x => plan.logs.some(l => l.session_exercise_id === x.sx && l.heart_rate)).length
            const fin = plan.feedback.some(f => f.session_id === s.id)
            return (
              <button key={s.id} className="card session" onClick={() => setOpen(s.id)}>
                <div className="between">
                  <b>{SLOT[s.slot] || "Mashg'ulot"}{s.planned_minutes ? ` · ${s.planned_minutes} daq` : ''}</b>
                  <span className={`pill ${fin || (total && done === total) ? 'ok' : ''}`}>{fin ? '✓ yakunlandi' : `${done}/${total}`}</span>
                </div>
                <div className="topic">{s.topic || '—'}</div>
                {s.zone && <div className="muted small">Zona: {s.zone}</div>}
              </button>
            )
          })}
        </>
      ) : (
        <Stats plan={plan} />
      )}
    </div>
  )
}

function DayStrip({ day, setDay, today, sessions }) {
  const days = []
  for (let i = -6; i <= 7; i++) days.push(addDays(today, i))
  useEffect(() => {
    document.getElementById('d-' + day)?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [day])
  return (
    <div className="strip">
      {days.map(d => {
        const has = sessions.some(s => s.session_date === d)
        return (
          <button id={'d-' + d} key={d} className={`dchip ${d === day ? 'on' : ''}`} onClick={() => setDay(d)}>
            <span className="muted small">{dayShort(d)}</span>
            <b>{Number(d.slice(8))}</b>
            <i className={has ? 'dot' : 'dot off'} />
          </button>
        )
      })}
    </div>
  )
}

function Session({ s, plan, age, onBack, onSave, onFeedback }) {
  const [drafts, setDrafts] = useState(() => store.get('bs_drafts', {}))
  const [savedId, setSavedId] = useState('')
  const [finish, setFinish] = useState(false)
  const [warn, setWarn] = useState(null)
  const [history, setHistory] = useState([])   // оценки восстановления по упражнениям этого занятия

  // Время начала занятия: первое действие в нём. Нужно для минут в оценке нагрузки.
  useEffect(() => {
    const st = store.get('bs_start', {})
    if (!st[s.id]) { st[s.id] = Date.now(); store.set('bs_start', st) }
  }, [s.id])

  const setDraft = (sx, patch) => setDrafts(d => {
    const nd = { ...d, [sx]: { ...(d[sx] || {}), ...patch } }
    store.set('bs_drafts', nd)
    return nd
  })

  const sorted = [...s.exercises].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  const myLogs = plan.logs.filter(l => l.session_id === s.id)
  const fb = plan.feedback.find(f => f.session_id === s.id)
  const doneCount = sorted.filter(x => myLogs.some(l => l.session_exercise_id === x.sx && l.heart_rate)).length
  const minutesDefault = (() => {
    const t = store.get('bs_start', {})[s.id]
    const m = t ? Math.round((Date.now() - t) / 60000) : null
    return m && m > 0 && m < 300 ? m : s.planned_minutes
  })()

  const onFlowResult = (x, advice) => {
    if (!advice) return
    const h = [...history, { level: advice.level, p2: advice.p2 }]
    setHistory(h)
    setWarn(fatigueCheck(h))
  }

  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={onBack}>← Orqaga</button>
        <div className="muted small">{dayLabel(s.session_date)} · {SLOT[s.slot] || ''}</div>
      </header>
      <div className="topic big">{s.topic || '—'}</div>
      <div className="muted small">{s.zone ? `Zona: ${s.zone} · ` : ''}{doneCount}/{sorted.length} mashq bajarildi{s.planned_minutes ? ` · ${s.planned_minutes} daq` : ''}</div>
      {warn && <div className={`advice ${warn.stop ? 'bad' : 'warn'}`}><p>{warn.text}</p></div>}
      {sorted.length === 0 && <div className="empty">Murabbiy hali mashqlarni kiritmagan.</div>}
      {sorted.map(x => (
        <ExerciseCard key={x.sx} s={s} x={x} age={age}
          log={myLogs.find(l => l.session_exercise_id === x.sx)}
          draft={drafts[x.sx]} setDraft={p => setDraft(x.sx, p)}
          onFlowResult={onFlowResult}
          onSave={async row => { await onSave([row]); setSavedId(x.sx); setTimeout(() => setSavedId(''), 2000) }}
          justSaved={savedId === x.sx} />
      ))}
      {sorted.length > 0 && (
        <button className={`btn ${fb ? 'ghost' : ''}`} onClick={() => setFinish(true)}>
          {fb ? "Baholashni o'zgartirish" : "Mashg'ulotni yakunlash va baholash"}
        </button>
      )}
      {finish && (
        <Finish minutesDefault={minutesDefault} logs={myLogs} age={age} existing={fb}
          onSubmit={f => onFeedback(s.id, f, s.session_date)} onClose={() => setFinish(false)} />
      )}
    </div>
  )
}

function Stats({ plan }) {
  const rows = useMemo(() => {
    const byDay = new Map()
    for (const l of plan.logs) {
      if (!l.logged_on) continue
      const r = byDay.get(l.logged_on) || { day: l.logged_on, n: 0, hr: [] }
      r.n++
      if (l.heart_rate) r.hr.push(l.heart_rate)
      byDay.set(l.logged_on, r)
    }
    return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day))
  }, [plan.logs])

  const allHr = rows.flatMap(r => r.hr)
  const avg = allHr.length ? Math.round(allHr.reduce((a, b) => a + b, 0) / allHr.length) : null
  return (
    <>
      <div className="kpis">
        <div className="card kpi"><b>{rows.length}</b><span className="muted small">mashg'ulot kuni</span></div>
        <div className="card kpi"><b>{plan.logs.length}</b><span className="muted small">yozilgan mashq</span></div>
        <div className="card kpi"><b>{avg ?? '—'}</b><span className="muted small">o'rtacha puls</span></div>
      </div>
      {rows.length === 0 && <div className="empty">Hali natija kiritilmagan.</div>}
      {rows.map(r => {
        const fb = plan.feedback.find(f => f.logged_on === r.day)
        return (
          <div key={r.day} className="card between">
            <div><b>{dayLabel(r.day)}</b><div className="muted small">{r.n} ta mashq{fb ? ` · og'irlik ${fb.rpe}/10` : ''}</div></div>
            <div className="right"><div>♥ {r.hr.length ? Math.round(r.hr.reduce((a, b) => a + b, 0) / r.hr.length) : '—'}</div></div>
          </div>
        )
      })}
    </>
  )
}
