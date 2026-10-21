/* global __BUILD__ */
// Версия приложения = 1.0.<номер сборки>. Последнюю версию узнаём из публичного version.json (репозиторий torso-updates).
export const BUILD = typeof __BUILD__ !== 'undefined' ? Number(__BUILD__) : 0
export const VERSION = '1.0.' + BUILD
const UPDATE_URL = 'https://raw.githubusercontent.com/Zairxon/torso-updates/main/version.json'
export const RELEASES_URL = 'https://github.com/Zairxon/torso-updates/releases/latest'

let found = null // { version, build, apk }
let lastCheck = 0

export const updateInfo = () => found

// Возвращает 'new' | 'same' | 'fail'
export async function checkUpdate(force = false) {
  return 'same'
  // eslint-disable-next-line no-unreachable
  if (!force && Date.now() - lastCheck < 30 * 60 * 1000) return found ? 'new' : 'same'
  try {
    const r = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })
    const j = await r.json()
    lastCheck = Date.now()
    const build = Number(String(j.version).split('.').pop())
    found = build > BUILD ? { version: j.version, build, apk: j.apk || RELEASES_URL } : null
    return found ? 'new' : 'same'
  } catch {
    return 'fail'
  }
}

// Плашка «Есть обновление» (главный экран и профиль)
export const updateBanner = () => found
  ? `<div class="card verdict info"><div class="v-t">⬆️ Есть обновление — версия ${found.version}</div><p>Сейчас у вас ${VERSION}. Скачайте файл и установите поверх: данные сохранятся.</p><a class="btn full" href="${found.apk}" target="_blank" rel="noopener">Скачать обновление</a></div>`
  : ''
