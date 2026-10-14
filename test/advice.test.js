import { describe, it, expect } from 'vitest'
import { maxHr, bpmFrom10, validBeats10, pulseAdvice, fatigueCheck, finishAdvice } from '../src/advice.js'

describe('advice', () => {
  it('макс. пульс по Tanaka', () => { expect(maxHr(15)).toBe(198); expect(maxHr(null)).toBe(197) })
  it('пульс за 10 с', () => {
    expect(bpmFrom10(25)).toBe(150)
    expect(validBeats10('25')).toBe(true)
    expect(validBeats10('3')).toBe(false)
    expect(validBeats10('90')).toBe(false)
  })
  it('хорошее восстановление', () => {
    const a = pulseAdvice({ hr1: 168, hr2: 120, age: 15, baseRest: 60 })
    expect(a.level).toBe('ok')
    expect(a.extra).toBe(0)
    expect(a.drop).toBe(48)
  })
  it('плохое восстановление просит больше отдыха', () => {
    const a = pulseAdvice({ hr1: 195, hr2: 175, age: 15, baseRest: 120 })
    expect(a.level).toBe('stop')
    expect(a.extra).toBe(180)
  })
  it('норма отдыха упражнения вычитает уже прошедшую минуту', () => {
    expect(pulseAdvice({ hr1: 150, hr2: 110, age: 15, baseRest: 150 }).extra).toBe(90)
  })
  it('малое падение пульса — сигнал усталости', () => {
    const a = pulseAdvice({ hr1: 150, hr2: 142, age: 15, baseRest: 60 })
    expect(a.level).not.toBe('ok')
    expect(a.msgs.join(' ')).toMatch(/12 dan kam/)
  })
  it('усталость копится', () => {
    const bad = { level: 'rest', p2: 0.8 }
    expect(fatigueCheck([bad])).toBeNull()
    expect(fatigueCheck([bad, bad]).stop).toBe(false)
    expect(fatigueCheck([{ level: 'stop', p2: 0.9 }, { level: 'stop', p2: 0.9 }]).stop).toBe(true)
  })
  it('итоговые советы и sRPE', () => {
    const r = finishAdvice({ rpe: 9, mood: 4, fatigue: 2, soreness: 5, minutes: 80 })
    expect(r.srpe).toBe(720)
    expect(r.lines[0]).toMatch(/yuklama katta/)
    expect(finishAdvice({ rpe: 3, mood: 5, fatigue: 5, soreness: 5, minutes: 60 }).lines[0]).toMatch(/Yengil/)
  })
})
