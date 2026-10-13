// Советы по пульсу и самочувствию. Это практические правила тренеров, а не
// диагноз: пороги ниже — ориентиры, их можно менять в одном месте.
//
// Опора на исследования:
//  • Максимальный пульс — формула Tanaka (208 − 0,7 × возраст). У подростков она
//    ошибается в среднем на 2–3 уд/мин, «220 − возраст» завышает на 6 и более;
//    у детей и подростков любые формулы только приблизительны.
//  • Падение пульса за 1 минуту отдыха (HRR1): значение ≤ 12 уд/мин — клинический
//    маркер риска (Cole et al., NEJM 1999) после предельной нагрузки у взрослых. Для
//    юных спортсменов это не диагноз, поэтому используем только как сигнал «отдохни
//    дольше и скажи тренеру».
//  • Возобновлять работу принято, когда пульс снизился примерно до 60–70 % от
//    максимума (около 120–135 уд/мин). Строгого исследования с одной цифрой нет — это
//    рабочее правило интервальных тренировок.
//  • Отдых между подходами в силовой работе: 1–2 мин для лёгких, 2–3 мин для базовых
//    (Schoenfeld et al., 2016; Willardson, 2006). Эти времена заданы для каждого
//    упражнения отдельно.
//  • Пульс за 10 секунд × 6 — быстрый способ, но он грубее минутного счёта, а чем
//    позже начали считать, тем ниже результат: поэтому счёт идёт сразу после сигнала.

export const maxHr = age => Math.round(208 - 0.7 * (Number(age) > 5 ? Number(age) : 16))

export const bpmFrom10 = beats => Math.round(Number(beats) * 6)

// Правдоподобие: за 10 секунд — от 5 до 40 ударов.
export const validBeats10 = v => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 5 && n <= 40
}

// hr1 — пульс сразу после упражнения, hr2 — после минуты отдыха, baseRest — норма отдыха упражнения, секунд.
export function pulseAdvice({ hr1, hr2, age, baseRest = 90 }) {
  const mx = maxHr(age)
  const p1 = hr1 / mx
  const p2 = hr2 == null ? null : hr2 / mx
  const drop = hr2 == null ? null : hr1 - hr2
  const msgs = []
  let level = 'ok'      // ok | rest | stop
  let extra = Math.max(0, baseRest - 60)   // одна минута уже прошла

  if (p1 >= 0.97) msgs.push('Puls maksimumga juda yaqin edi. Keyingi mashqda tezlik yoki og\'irlikni biroz kamaytiring.')
  if (p2 != null) {
    if (p2 > 0.85) { level = 'stop'; extra = Math.max(extra, 180); msgs.push('Bir daqiqadan keyin ham puls juda yuqori. Yana 3 daqiqa dam oling. Yaxshilanmasa, mashg\'ulotni to\'xtating va murabbiyga ayting.') }
    else if (p2 > 0.75) { level = 'rest'; extra = Math.max(extra, 120); msgs.push('Puls hali baland. Yana 2 daqiqa dam oling, so\'ng davom eting.') }
    else if (p2 > 0.65) { level = 'rest'; extra = Math.max(extra, 60); msgs.push('Puls deyarli tushdi. Yana 1 daqiqa dam olsangiz yaxshi.') }
    else msgs.push('Puls yaxshi tiklandi. Keyingi mashqqa tayyorsiz.')
    if (drop < 12 && p1 >= 0.7) {
      if (level === 'ok') level = 'rest'
      extra = Math.max(extra, 60)
      msgs.push('Puls bir daqiqada 12 dan kam tushdi — tiklanish sekin. Bu charchoq belgisi bo\'lishi mumkin: ko\'proq dam oling.')
    }
  }
  return { mx, p1, p2, drop, level, extra, msgs }
}

// Накопление усталости по занятию: два упражнения подряд без восстановления.
export function fatigueCheck(history) {
  const last = history.slice(-2)
  const bad = h => h.level === 'stop' || (h.p2 != null && h.p2 > 0.75)
  if (history.length && history[history.length - 1].level === 'stop' && last.length === 2 && last.every(bad)) {
    return { stop: true, text: 'Ketma-ket ikki mashqdan keyin puls tiklanmadi. Bugungi yuklama yetarli bo\'lishi mumkin — mashg\'ulotni tugating yoki murabbiyga ayting.' }
  }
  if (last.length === 2 && last.every(bad)) {
    return { stop: false, text: 'Puls ketma-ket ikki marta sekin tushdi. Dam vaqtini uzaytiring va yuklamani biroz kamaytiring.' }
  }
  return null
}

export const RPE_LABELS = ['', 'Juda yengil', 'Yengil', 'Oson', 'Biroz og\'ir', 'O\'rtacha', 'Og\'irroq', 'Og\'ir', 'Juda og\'ir', 'Deyarli maksimum', 'Maksimum']

// Итоговые советы по занятию: RPE (1–10) и самочувствие (1–5, где 5 — хорошо).
export function finishAdvice({ rpe, mood, fatigue, soreness, minutes, avgPct }) {
  const out = []
  if (rpe >= 9 || fatigue <= 2) out.push('Bugun yuklama katta bo\'ldi. Kechqurun yaxshi ovqatlaning, ko\'proq suv iching va kamida 8–9 soat uxlang. Ertangi mashg\'ulotni yengilroq boshlang.')
  if (soreness <= 2) out.push('Mushaklaringiz qattiq og\'riyapti. Cho\'zilish va yengil yurish yordam beradi. Og\'riq o\'tmasa yoki o\'tkir bo\'lsa, murabbiyga ayting va mashq qilmang.')
  if (mood <= 2) out.push('Kayfiyatingiz past. Murabbiy bilan gaplashing — ba\'zan yuklamani yoki rejani o\'zgartirish kerak bo\'ladi.')
  if (avgPct != null && avgPct > 0.9) out.push('O\'rtacha puls maksimumga yaqin bo\'ldi. Murabbiy bilan keyingi yuklamani muhokama qiling.')
  if (!out.length) out.push(rpe <= 4 ? 'Yengil mashg\'ulot bo\'ldi. Davom eting!' : 'Yaxshi ish! Tiklanish uchun ovqat, suv va uyquni unutmang.')
  const srpe = rpe && minutes ? rpe * minutes : null
  return { lines: out, srpe }
}
