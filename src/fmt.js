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
  if (sec == null || sec === '') return ''
  const t = Number(sec)
  const m = Math.floor(t / 60)
  const s = Math.round((t - m * 60) * 10) / 10
  return `${m}:${String(s).padStart(2, '0').replace(/^(\d)(\.|$)/, '0$1$2')}`
}

// Пульс обязателен: 30..250 уд/мин.
export function validPulse(v) {
  const n = Number(v)
  return Number.isInteger(n) && n >= 30 && n <= 250
}

export const isoDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba']
export function dayLabel(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${DAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`
}
export const dayShort = iso => DAYS[new Date(iso + 'T12:00:00').getDay()].slice(0, 2)

// Подпись поля результата по единице упражнения (как в приложении тренера).
export function resultKind(unit) {
  const u = String(unit || '').toLowerCase()
  return {
    weight: /kg/.test(u),
    label: /zarba/.test(u) ? 'Zarba soni'
      : /\bsm\b/.test(u) ? 'Necha sm'
      : /km|masofa/.test(u) ? 'Necha km'
      : /doira/.test(u) ? 'Necha doira'
      : /takror|marta|kg/.test(u) ? 'Necha marta'
      : 'Natija',
  }
}
