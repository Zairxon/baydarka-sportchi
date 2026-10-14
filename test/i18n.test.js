import { describe, it, expect } from 'vitest'
import { tr, setLang, tt } from '../src/i18n.js'
import { PHRASES } from '../src/dict.js'

describe('i18n', () => {
  it('в словаре нет пропусков и дублей', () => {
    const seen = new Set()
    for (const [u, ru, en] of PHRASES) {
      expect(ru, u).toBeTruthy()
      expect(en, u).toBeTruthy()
      expect(seen.has(u), 'дубль: ' + u).toBe(false)
      seen.add(u)
      expect((u.match(/#/g) || []).length, 'число # в ru: ' + u).toBe((ru.match(/#/g) || []).length)
      expect((u.match(/#/g) || []).length, 'число # в en: ' + u).toBe((en.match(/#/g) || []).length)
    }
  })
  it('русский и английский: фразы с числами', () => {
    setLang('ru')
    expect(tr('<b>75 daq</b>')).toBe('<b>75 мин</b>')
    expect(tr('<span>Reja: 3 × 10 · 40 kg</span>')).toContain('План:')
    expect(tr('<p>Puls hali baland. Yana 2 daqiqa dam oling, so&#39;ng davom eting.</p>')).toContain('Пульс ещё высокий')
    expect(tr('<p>7 kunda mashg\'ulot</p>')).toContain('Тренировок за 7 дней')
    expect(tr('<p>Seshanba, 14-oktabr</p>')).toBe('<p>Вторник, 14 октября</p>')
    setLang('en')
    expect(tr('<p>Seshanba, 14-oktabr</p>')).toBe('<p>Tuesday, October 14</p>')
    expect(tr('<input placeholder="Qidirish…">')).toBe('<input placeholder="Search…">')
    expect(tt('Chiqishni xohlaysizmi?')).toBe('Sign out?')
  })
  it('кириллица и латиница', () => {
    setLang('uz')
    expect(tr('<b>Bugun</b>')).toBe('<b>Бугун</b>')
    expect(tr('<b>Mashg\'ulot</b>')).toBe('<b>Машғулот</b>')
    expect(tr('<b>Chiqish</b>')).toBe('<b>Чиқиш</b>')
    expect(tr('<b>Safari</b>')).toBe('<b>Safari</b>')
    setLang('uzl')
    expect(tr('<b>Bugun</b>')).toBe('<b>Bugun</b>')
  })
})
