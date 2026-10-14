import { useEffect, useState } from 'react'

// Подсказка по установке на главный экран. Браузер сам предлагает установку только в
// «настоящем» Chrome (Android) и Safari (iPhone); во встроенных браузерах мессенджеров
// и в Chrome на iPhone её нет — тогда говорим, куда перейти.
let deferred = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('bs-install-ready')) })
}

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIos = /iPhone|iPad|iPod/.test(ua)
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const inApp = /Telegram|Instagram|FBAN|FBAV|Line\/|; wv\)|Snapchat|TikTok/i.test(ua)
const iosSafari = isIos && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && !inApp

export default function Install() {
  const [ready, setReady] = useState(!!deferred)
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('bs_install_hide') === '1' } catch { return false } })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const on = () => setReady(true)
    window.addEventListener('bs-install-ready', on)
    return () => window.removeEventListener('bs-install-ready', on)
  }, [])

  if (isStandalone() || hidden) return null
  const hide = () => { try { localStorage.setItem('bs_install_hide', '1') } catch { /* не критично */ } setHidden(true) }

  const install = async () => {
    if (!deferred) return setOpen(true)
    deferred.prompt()
    await deferred.userChoice.catch(() => {})
    deferred = null; setReady(false)
  }

  let steps
  if (inApp) steps = ["Bu ilova ichidagi brauzer — bu yerda o'rnatib bo'lmaydi.", "Yuqoridagi ⋮ (yoki ⋯) menyusini bosing va «Brauzerda ochish» / «Chrome'da ochish» ni tanlang.", "Chrome ochilgach, qayta «O'rnatish» ni bosing."]
  else if (isIos && !iosSafari) steps = ["iPhone'da o'rnatish faqat Safari orqali ishlaydi.", "Havolani nusxalab, Safari'da oching.", "Pastdagi «Ulashish» ▫︎↑ → «Ekranga qo'shish» → «Qo'shish»."]
  else if (isIos) steps = ["Pastdagi «Ulashish» tugmasini (▫︎↑) bosing.", "«Ekranga qo'shish» (Add to Home Screen) ni tanlang.", "«Qo'shish» ni bosing — ilova ekranda paydo bo'ladi."]
  else steps = ["Chrome'ning yuqori o'ng burchagidagi ⋮ menyusini oching.", "«Ilovani o'rnatish» yoki «Bosh ekranga qo'shish» ni tanlang.", "Tasdiqlang — ilova ekranda paydo bo'ladi."]

  return (
    <div className="install">
      <div className="between">
        <b>📲 Ilovani telefonga o'rnating</b>
        <button className="link" onClick={hide} aria-label="Yopish">✕</button>
      </div>
      {ready && !inApp && <button className="btn" onClick={install}>O'rnatish</button>}
      {(!ready || inApp || open) && <ol className="steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {ready && !inApp && !open && <button className="link" onClick={() => setOpen(true)}>Tugma ishlamasa?</button>}
    </div>
  )
}
