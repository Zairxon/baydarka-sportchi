import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'
import { S } from './state.js'

// Передача местоположения центру во время, пока приложение открыто.
// Включено для всех вошедших спортсменов — центр (интернат) отвечает за безопасность
// несовершеннолетних и видит, где находится ученик в учебное время. В приложении
// об этом сказано честной строкой в профиле; управлять этим ученик не может.
// Браузер не следит в фоне, поэтому точка обновляется, только пока приложение открыто.
let watchId = null
let lastSent = { t: 0, lat: 0, lng: 0 }
const MIN_GAP_MS = 20000
const MIN_MOVE_M = 25

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
}

const metres = (a, b) => {
  const R = 6371000, rad = x => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function push(pos) {
  if (!S.auth) return
  const { latitude: lat, longitude: lng, accuracy } = pos.coords
  const now = Date.now()
  const moved = lastSent.t ? metres(lastSent, { lat, lng }) : Infinity
  // Не чаще раза в 20 секунд; стоит на месте — раз в две минуты, чтобы точка была «свежей».
  if (now - lastSent.t < MIN_GAP_MS || (moved < MIN_MOVE_M && now - lastSent.t < 120000)) return
  lastSent = { t: now, lat, lng }
  try {
    await rpc('athlete_set_location', { p_login: S.auth.login, p_password: S.auth.password, p_lat: lat, p_lng: lng, p_acc: accuracy ?? null })
    S.locState = 'on'
  } catch { S.locState = 'error' }
}

function watch() {
  if (watchId != null || !('geolocation' in navigator)) return
  watchId = navigator.geolocation.watchPosition(push, err => {
    S.locState = err.code === 1 ? 'denied' : 'error'
  }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 })
}

// После входа/запуска: сразу начинаем передавать местоположение.
export function initLocation() {
  if (!S.auth) return
  if (!('geolocation' in navigator)) { S.locState = 'unsupported'; return }
  lastSent = { t: 0, lat: 0, lng: 0 }
  S.locState = S.locState === 'denied' ? 'denied' : 'wait'
  watch()
}
