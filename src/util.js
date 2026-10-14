// Время вводится как «2:35», «2.35,5» или просто секунды «155».
export function parseDuration(text) {
  const s = String(text ?? '').trim().replace(',', '.')
  if (!s) return null
  if (s.includes(':')) {
    const [m, sec] = s.split(':')
    const mm = Number(m), ss = Number(sec)
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0 || ss >= 60) return NaN
    return Math.round((mm * 60 + ss) * 100) / 100
  }
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export function formatDuration(sec) {
  if (sec == null || sec === '' || Number.isNaN(Number(sec))) return ''
  const t = Number(sec)
  const m = Math.floor(t / 60)
  const s = Math.round((t - m * 60) * 10) / 10
  const ss = s < 10 ? '0' + s : String(s)
  return `${m}:${ss}`
}

// Пульс обязателен: 30..250 уд/мин.
export const validPulse = v => { const n = Number(v); return Number.isInteger(n) && n >= 30 && n <= 250 }

export const num = v => (v === '' || v == null ? null : Number(String(v).replace(',', '.')))

export const isoDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d) }

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
export const dayLabel = iso => { const d = new Date(iso + 'T12:00:00'); return `${DAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}` }
export const dayShort = iso => DAYS[new Date(iso + 'T12:00:00').getDay()].slice(0, 2)

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
