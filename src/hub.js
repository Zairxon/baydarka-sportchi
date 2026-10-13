import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

// Вызов функции Postgres через REST. Любая ошибка сети/сервера — исключение.
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

export const login = (l, p) => rpc('athlete_login', { p_login: l, p_password: p })
export const loadPlan = (a, from, to) => rpc('athlete_plan', { p_login: a.login, p_password: a.password, p_from: from, p_to: to })
export const submitLogs = (a, rows) => rpc('athlete_submit', { p_login: a.login, p_password: a.password, p_rows: rows })
export const submitFeedback = (a, row) => rpc('athlete_feedback', { p_login: a.login, p_password: a.password, p_row: row })
