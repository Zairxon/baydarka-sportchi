// Сигналы для отсчёта. Браузер разрешает звук только после нажатия пользователя,
// поэтому unlockAudio() вызывается из обработчика кнопки «Старт».
let ctx = null

export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* без звука — остаётся вибрация и цифры на экране */ }
}

export function beep(freq = 880, ms = 150, vol = 0.5) {
  try {
    if (ctx) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(vol, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
      o.connect(g); g.connect(ctx.destination)
      o.start(); o.stop(ctx.currentTime + ms / 1000 + 0.02)
    }
    navigator.vibrate?.(Math.min(ms, 200))
  } catch { /* звук необязателен */ }
}

export const tickBeep = () => beep(880, 120)      // 3, 2, 1
export const goBeep = () => beep(1320, 450)       // старт отсчёта пульса
export const stopBeep = () => { beep(660, 180); setTimeout(() => beep(660, 180), 240); setTimeout(() => beep(990, 350), 480) } // конец 10 секунд

// Не даёт экрану гаснуть во время замера (не везде поддерживается).
let lock = null
export async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) lock = await navigator.wakeLock.request('screen')
    else if (!on && lock) { await lock.release(); lock = null }
  } catch { /* необязательно */ }
}
