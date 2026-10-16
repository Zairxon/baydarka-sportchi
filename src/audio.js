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

// Голосовые команды тренера. Всегда по-русски («Внимание», «Марш», «Оп», «Темп», «Стоп»):
// мужской голос, если он есть в телефоне, высокий тон и быстрая резкая подача, максимальная громкость.
// Предыдущая фраза обрывается, чтобы команды не копились в очереди.
const FEMALE = /female|женск|svetlana|irina|anna|elena|milena|katya|alena|tatyana|ekaterina|polina|victoria|alina|dariya|daria/i
const MALE = /male|муж|pavel|dmitr|yuri|maxim|ivan|oleg|mikhail|nikolay|aleksandr|alexander|sergey|vladimir/i
function pickVoice() {
  const ru = (window.speechSynthesis?.getVoices() || []).filter(v => /^ru/i.test(v.lang))
  return ru.find(v => MALE.test(v.name) && !FEMALE.test(v.name)) || ru.find(v => !FEMALE.test(v.name)) || ru[0] || null
}
export function say(text) {
  try {
    const ss = window.speechSynthesis
    if (!ss) return
    ss.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'; u.volume = 1; u.rate = 1.3; u.pitch = 1.6
    const v = pickVoice()
    if (v) u.voice = v
    ss.speak(u)
  } catch { /* без голоса остаются сигналы */ }
}

// Не даёт экрану гаснуть во время замера (не везде поддерживается).
let lock = null
export async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock) lock = await navigator.wakeLock.request('screen')
    else if (!on && lock) { await lock.release(); lock = null }
  } catch { /* необязательно */ }
}
