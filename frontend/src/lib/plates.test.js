import { describe, it, expect } from 'vitest'
import { calcPlates, DEFAULT_BAR, DEFAULT_SET } from './plates.js'

const kg = (target, over = {}) => calcPlates(target, { bar: DEFAULT_BAR.kg, set: DEFAULT_SET.kg, ...over })

describe('plate calculator', () => {
  it('loads a standard 100kg squat as 25+15 per side on a 20kg bar', () => {
    const r = kg(100)
    expect(r.perSide).toEqual([{ plate: 25, count: 1 }, { plate: 15, count: 1 }])
    expect(r.achieved).toBe(100)
    expect(r.diff).toBe(0)
  })

  it('hits an odd target down to the smallest plate', () => {
    const r = kg(62.5)
    expect(r.perSide).toEqual([{ plate: 20, count: 1 }, { plate: 1.25, count: 1 }])
    expect(r.achieved).toBe(62.5)
  })

  it('is just the bar when the target is the bar weight', () => {
    const r = kg(20)
    expect(r.perSide).toEqual([])
    expect(r.achieved).toBe(20)
  })

  it('reports a negative diff rather than a fake load below the bar', () => {
    const r = kg(15)
    expect(r.perSide).toEqual([])
    expect(r.achieved).toBe(20)
    expect(r.diff).toBe(-5)
  })

  it('reports the closest reachable weight when the target is off the set resolution', () => {
    const r = kg(63)   // 21.5/side isn't reachable with 1.25 increments
    expect(r.achieved).toBe(62.5)
    expect(r.diff).toBe(0.5)
  })

  it('respects a custom bar and plate set (no 1.25s at this gym)', () => {
    const r = calcPlates(75, { bar: 20, set: [25, 20, 15, 10, 5, 2.5] })
    expect(r.achieved).toBe(75)
    expect(r.perSide).toEqual([{ plate: 25, count: 1 }, { plate: 2.5, count: 1 }])
  })

  it('loads a lb bar the same way', () => {
    const r = calcPlates(225, { bar: DEFAULT_BAR.lb, set: DEFAULT_SET.lb })
    expect(r.achieved).toBe(225)
    expect(r.perSide).toEqual([{ plate: 45, count: 2 }])
  })

  it('falls back to a sane default bar when given a zero/missing one', () => {
    const r = calcPlates(100, { bar: 0, set: DEFAULT_SET.kg })
    expect(r.bar).toBe(DEFAULT_BAR.kg)
  })
})
