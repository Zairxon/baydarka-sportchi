import { describe, it, expect } from 'vitest'
import { epley, setKcal, suggest, advice, bestRm, muscleLoad, history } from '../src/gym.js'

const log = (day, sets, ex = 'e', sid = day) => ({ exercise_id: ex, session_id: sid, logged_on: day, detail: { sets } })

describe('gym', () => {
  it('Epley и расход', () => {
    expect(epley(100, 10)).toBeCloseTo(133.3, 1)
    expect(epley(0, 10)).toBe(0)
    expect(setKcal('comp', 70)).toBeCloseTo(((5 - 1) * 70 * 160) / 3600, 5)
  })
  it('история без текущего занятия, новые сверху', () => {
    const h = history([log('2026-10-01', [{ w: 40, r: 10 }]), log('2026-10-08', [{ w: 42, r: 8 }]), log('2026-10-13', [{ w: 50, r: 5 }], 'e', 'cur')], 'e', 'cur')
    expect(h.map(l => l.logged_on)).toEqual(['2026-10-08', '2026-10-01'])
  })
  it('двойная прогрессия: все подходы на верху → +вес', () => {
    const h = [log('2026-10-08', [{ w: 40, r: 12 }, { w: 40, r: 12 }, { w: 40, r: 12 }])]
    expect(suggest(h, 8, 12, 3, true)).toMatchObject({ w: 42.5, r: 8, up: true })
    expect(suggest(h, 8, 12, 3, false).w).toBe(42)
  })
  it('без верха — тот же вес, +1 повтор', () => {
    const h = [log('2026-10-08', [{ w: 40, r: 9 }, { w: 40, r: 8 }])]
    expect(suggest(h, 8, 12, 3, true)).toMatchObject({ w: 40, r: 10, up: false })
  })
  it('нет истории', () => { expect(suggest([], 8, 12, 3, true)).toMatchObject({ w: '', prev: null, up: false }) })
  it('совет по весу: нужно 2 занятия и 3 дня', () => {
    const h = [log('2026-10-08', [{ w: 40, r: 10 }]), log('2026-10-01', [{ w: 40, r: 9 }])]
    expect(advice(h, 2, 8, 12, true)).toBeNull()
    expect(advice(h.slice(0, 1), 5, 8, 12, true)).toBeNull()
    const a = advice(h, 5, 8, 12, true)
    expect(a.w).toBeGreaterThan(30)
    expect(a.sessions).toBe(2)
  })
  it('рекорд и нагрузка по мышцам', () => {
    expect(bestRm([log('2026-10-01', [{ w: 40, r: 10 }, { w: 50, r: 5 }])])).toBeCloseTo(58.3, 1)
    const groups = { a: 'chest', b: 'legs', c: 'warm' }
    const l = muscleLoad([log('2026-10-12', [{}, {}, {}], 'a'), log('2026-10-12', [{}], 'b'), log('2026-10-12', [{}], 'c'), log('2026-09-01', [{}], 'a')], id => groups[id], '2026-10-07')
    expect(l).toEqual({ chest: 3, legs: 1 })
  })
})
