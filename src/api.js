import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { store } from './store.js'
import { addDays, isoDate } from './util.js'

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const err = new Error(t || res.statusText)
    err.status = res.status
    throw err
  }
  const txt = await res.text()
  return txt ? JSON.parse(txt) : null
}

export const apiLogin = (l, p) => rpc('athlete_login', { p_login: l, p_password: p })
const apiPlan = (a, from, to) => rpc('athlete_plan', { p_login: a.login, p_password: a.password, p_from: from, p_to: to })
const apiSubmit = (a, rows) => rpc('athlete_submit', { p_login: a.login, p_password: a.password, p_rows: rows })
const apiFeedback = (a, row) => rpc('athlete_feedback', { p_login: a.login, p_password: a.password, p_row: row })

export const EMPTY_PLAN = { sessions: [], logs: [], feedback: [], age: null, boat: null }

// Очередь записей: сначала локально, потом на сервер; без сети остаётся в очереди.
export const queue = {
  logs: () => store.get('q', []),
  fb: () => store.get('fq', []),
  count: () => queue.logs().length + queue.fb().length,
  addLogs(rows) { store.set('q', [...queue.logs().filter(r => !rows.some(n => n.id === r.id)), ...rows]) },
  addFb(row) { store.set('fq', [...queue.fb().filter(f => f.session_id !== row.session_id), row]) },
}

// Полная синхронизация: отправить очередь, затем забрать план за -60…+14 дней.
export async function sync(auth) {
  const q = queue.logs()
  if (q.length) { await apiSubmit(auth, q); store.set('q', []) }
  const fq = queue.fb()
  for (const f of fq) await apiFeedback(auth, f)
  if (fq.length) store.set('fq', [])
  const today = isoDate()
  const p = await apiPlan(auth, addDays(today, -60), addDays(today, 14))
  const plan = { ...EMPTY_PLAN, ...p }
  store.set('plan', plan)
  return plan
}
