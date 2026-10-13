import { describe, it, expect } from 'vitest'
import { parseDuration, validPulse, formatDuration, addDays } from './fmt'

describe('fmt', () => {
  it('время', () => {
    expect(parseDuration('2:35')).toBe(155)
    expect(parseDuration('155')).toBe(155)
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('1:75')).toBeNaN()
    expect(parseDuration('abc')).toBeNaN()
  })
  it('формат времени', () => {
    expect(formatDuration(155)).toBe('2:35')
    expect(formatDuration(65)).toBe('1:05')
  })
  it('пульс', () => {
    expect(validPulse('150')).toBe(true)
    expect(validPulse('')).toBe(false)
    expect(validPulse('20')).toBe(false)
    expect(validPulse('300')).toBe(false)
  })
  it('дни', () => { expect(addDays('2026-10-31', 1)).toBe('2026-11-01') })
})
