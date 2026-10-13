import { useCallback, useEffect, useMemo, useState } from 'react'
import { login, loadPlan, submitLogs } from './hub'
import { addDays, dayLabel, dayShort, formatDuration, isoDate, parseDuration, resultKind, validPulse } from './fmt'

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* память переполнена — работаем без кэша */ } },
  del(k) { try { localStorage.removeItem(k) } catch { /* нечего удалять */ } },
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const SLOT = { morning: 'Ertalabki', evening: 'Kechki' }

export default function App() {
  const [auth, setAuth] = useState(() => store.get('bs_auth'))
  const [me, setMe] = useState(() => store.get('bs_me'))

  const out = () => { store.del('bs_auth'); store.del('bs_me'); store.del('bs_plan'); store.del('bs_queue'); store.del('bs_drafts'); setAuth(null); setMe(null) }

  if (!auth || !me) return <Login onDone={(c, m) => { store.set('bs_auth', c); store.set('bs_me', m); setAuth(c); setMe(m) }} />
  return <Main code={auth} me={me} onLogout={out} />
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

function Main({ code, me, onLogout }) {
  const today = isoDate()
  const [day, setDay] = useState(today)
  const [plan, setPlan] = useState(() => store.get('bs_plan', { sessions: [], logs: [] }))
  const [queue, setQueue] = useState(() => store.get('bs_queue', []))
  const [open, setOpen] = useState(null)       // id занятия
  const [online, setOnline] = useState(null)   // null = ещё не знаем
  const [view, setView] = useState('day')      // day | stats

  const range = useMemo(() => ({ from: addDays(today, -30), to: addDays(today, 14) }), [today])

  const sync = useCallback(async () => {
    try {
      let q = store.get('bs_queue', [])
      if (q.length) {
        await submitLogs(code, q)
        q = []
        store.set('bs_queue', q); setQueue(q)
      }
      const p = await loadPlan(code, range.from, range.to)
      store.set('bs_plan', p); setPlan(p); setOnline(true)
    } catch (e) {
      setOnline(false)
      if (e.status === 400 || e.status === 401 || e.status === 403) onLogout()  // код отозван
    }
  }, [code, range, onLogout])

  useEffect(() => {
    sync()
    const on = () => sync()
    window.addEventListener('online', on)
    window.addEventListener('focus', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('focus', on) }
  }, [sync])

  const saveRows = async rows => {
    const q = [...store.get('bs_queue', []).filter(r => !rows.some(n => n.id === r.id)), ...rows]
    store.set('bs_queue', q); setQueue(q)
    // локально сразу показываем как сохранённое
    setPlan(p => {
      const logs = [...p.logs.filter(l => !rows.some(n => n.id === l.id)), ...rows]
      const np = { ...p, logs }
      store.set('bs_plan', np)
      return np
    })
    await sync()
  }

  const sessionsOfDay = plan.sessions.filter(s => s.session_date === day)
  const opened = open && plan.sessions.find(s => s.id === open)

  if (opened) {
    return <Session s={opened} logs={plan.logs} onBack={() => setOpen(null)} onSave={saveRows} />
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

      {(online === false || queue.length > 0) && (
        <div className="banner">
          {queue.length > 0 ? `Yuborilmagan yozuvlar: ${queue.length}. Internet paydo bo'lganda avtomatik yuboriladi.` : "Internet yo'q — oxirgi saqlangan reja ko'rsatilmoqda."}
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
            return (
              <button key={s.id} className="card session" onClick={() => setOpen(s.id)}>
                <div className="between">
                  <b>{SLOT[s.slot] || 'Mashg\'ulot'}{s.planned_minutes ? ` · ${s.planned_minutes} daq` : ''}</b>
                  <span className={`pill ${total && done === total ? 'ok' : ''}`}>{done}/{total}</span>
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

function Session({ s, logs, onBack, onSave }) {
  const [drafts, setDrafts] = useState(() => store.get('bs_drafts', {}))
  const [savedMsg, setSavedMsg] = useState('')

  const setDraft = (sx, patch) => setDrafts(d => {
    const nd = { ...d, [sx]: { ...(d[sx] || {}), ...patch } }
    store.set('bs_drafts', nd)
    return nd
  })

  const sorted = [...s.exercises].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  return (
    <div className="screen">
      <header className="top">
        <button className="link" onClick={onBack}>← Orqaga</button>
        <div className="muted small">{dayLabel(s.session_date)} · {SLOT[s.slot] || ''}</div>
      </header>
      <div className="topic big">{s.topic || '—'}</div>
      {s.zone && <div className="muted small">Zona: {s.zone}</div>}
      {sorted.length === 0 && <div className="empty">Murabbiy hali mashqlarni kiritmagan.</div>}
      {sorted.map(x => (
        <ExerciseCard key={x.sx} s={s} x={x}
          log={logs.find(l => l.session_exercise_id === x.sx)}
          draft={drafts[x.sx]} setDraft={p => setDraft(x.sx, p)}
          onSave={async row => { await onSave([row]); setSavedMsg(x.sx); setTimeout(() => setSavedMsg(''), 2000) }}
          justSaved={savedMsg === x.sx} />
      ))}
    </div>
  )
}

function ExerciseCard({ s, x, log, draft, setDraft, onSave, justSaved }) {
  const kind = resultKind(x.unit)
  // Значения: черновик > сохранённая запись.
  const val = {
    reps: draft?.reps ?? (log?.reps != null ? String(log.reps) : ''),
    time: draft?.time ?? (log?.duration_seconds != null ? formatDuration(log.duration_seconds) : ''),
    weight: draft?.weight ?? (log?.weight_kg != null ? String(log.weight_kg) : ''),
    pulse: draft?.pulse ?? (log?.heart_rate != null ? String(log.heart_rate) : ''),
    rec: draft?.rec ?? (log?.recovery_hr != null ? String(log.recovery_hr) : ''),
    note: draft?.note ?? (log?.note || ''),
  }
  const [err, setErr] = useState('')
  const done = !!(log && log.heart_rate)

  const save = async () => {
    setErr('')
    if (!validPulse(val.pulse)) return setErr('Puls majburiy (30–250 urish/daq).')
    const dur = parseDuration(val.time)
    if (Number.isNaN(dur)) return setErr('Vaqtni 2:35 yoki sekundlarda yozing.')
    const num = v => (v === '' ? null : Number(String(v).replace(',', '.')))
    const reps = num(val.reps), weight = num(val.weight), rec = num(val.rec)
    if ([reps, weight, rec].some(n => n != null && !Number.isFinite(n))) return setErr("Raqamlarni to'g'ri yozing.")
    await onSave({
      id: log?.id || draft?.id || uuid(),
      session_id: s.id, session_exercise_id: x.sx, exercise_id: x.ex, set_no: x.set_no ?? 1,
      logged_on: s.session_date,
      reps: reps == null ? null : Math.round(reps),
      weight_kg: weight, duration_seconds: dur, distance_m: null,
      heart_rate: Math.round(Number(val.pulse)),
      recovery_hr: rec == null ? null : Math.round(rec),
      note: val.note || null,
    })
    setDraft({ id: undefined })
  }

  return (
    <div className={`card ex ${done ? 'done' : ''}`}>
      <div className="between">
        <b>{x.name}{x.of > 1 ? ` · #${x.set_no}` : ''}</b>
        {done && <span className="pill ok">✓ yozildi</span>}
      </div>
      {x.prescription && <div className="task">Vazifa: <b>{x.prescription}</b></div>}
      <div className="grid">
        <label>{kind.label}
          <input className="input" inputMode="decimal" value={val.reps} onChange={e => setDraft({ reps: e.target.value, id: draft?.id || log?.id || uuid() })} />
        </label>
        <label>Vaqt (daq:sek)
          <input className="input" inputMode="text" placeholder="2:35" value={val.time} onChange={e => setDraft({ time: e.target.value, id: draft?.id || log?.id || uuid() })} />
        </label>
        {kind.weight && (
          <label>Vazn (kg)
            <input className="input" inputMode="decimal" value={val.weight} onChange={e => setDraft({ weight: e.target.value, id: draft?.id || log?.id || uuid() })} />
          </label>
        )}
        <label className="req">Puls * (urish/daq)
          <input className="input" inputMode="numeric" value={val.pulse} onChange={e => setDraft({ pulse: e.target.value, id: draft?.id || log?.id || uuid() })} />
        </label>
        <label>Dam olgandan keyingi puls
          <input className="input" inputMode="numeric" value={val.rec} onChange={e => setDraft({ rec: e.target.value, id: draft?.id || log?.id || uuid() })} />
        </label>
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn" onClick={save}>{justSaved ? 'Saqlandi ✓' : done ? 'Yangilash' : 'Saqlash'}</button>
    </div>
  )
}

function Stats({ plan }) {
  const rows = useMemo(() => {
    const byDay = new Map()
    for (const l of plan.logs) {
      if (!l.logged_on) continue
      const r = byDay.get(l.logged_on) || { day: l.logged_on, n: 0, hr: [], sec: 0 }
      r.n++
      if (l.heart_rate) r.hr.push(l.heart_rate)
      if (l.duration_seconds) r.sec += Number(l.duration_seconds)
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
      {rows.map(r => (
        <div key={r.day} className="card between">
          <div><b>{dayLabel(r.day)}</b><div className="muted small">{r.n} ta mashq</div></div>
          <div className="right">
            <div>♥ {r.hr.length ? Math.round(r.hr.reduce((a, b) => a + b, 0) / r.hr.length) : '—'}</div>
            {r.sec > 0 && <div className="muted small">{formatDuration(r.sec)}</div>}
          </div>
        </div>
      ))}
    </>
  )
}
