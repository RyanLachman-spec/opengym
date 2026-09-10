import { describe, it, expect } from 'vitest'
import { weeklyPlanLoad } from './muscles.js'

// 0025 barbell bench press: tg pectorals -> chest 1.0, sm triceps+shoulders -> triceps 0.4, deltoids 0.4
// 0001 3/4 sit-up: tg abs -> abs 1.0, sm hip flexors+lower back -> hip-flexors 0.4, lower-back 0.4
const S = {
  routines: [
    { id: 'r1', name: 'Push', ex: [{ id: '0025', sets: 3 }] },
    { id: 'r2', name: 'Core', ex: [{ id: '0001', sets: 2 }] },
  ],
  week: { 1: 'r1', 3: 'r1', 5: 'r2' },
}

describe('weeklyPlanLoad', () => {
  it('sums sets and counts distinct days per muscle across the planned week', () => {
    const { byMuscle, plannedDays } = weeklyPlanLoad(S)
    expect(plannedDays).toBe(3)
    expect(byMuscle.chest).toEqual({ sets: 6, days: 2 })       // days 1 and 3, 3 sets each
    expect(byMuscle.abs).toEqual({ sets: 2, days: 1 })         // day 5 only
    expect(byMuscle.triceps.sets).toBeCloseTo(2.4, 5)          // 0.4 * 3 sets * 2 occurrences
    expect(byMuscle.triceps.days).toBe(2)
  })

  it('ignores a day pointing at a routine that no longer exists', () => {
    const { byMuscle, plannedDays } = weeklyPlanLoad({ ...S, week: { ...S.week, 6: 'deleted-routine' } })
    expect(plannedDays).toBe(3)
    expect(byMuscle.chest.days).toBe(2)
  })

  it('rest days and an empty week produce no load at all', () => {
    expect(weeklyPlanLoad({ routines: S.routines, week: {} })).toEqual({ byMuscle: {}, plannedDays: 0 })
  })

  it('a muscle worth zero for this routine (rounding to nothing) is not counted at all', () => {
    // a routine with no exercises contributes nothing, not a zero-sets entry
    const empty = { routines: [{ id: 'r3', name: 'Empty', ex: [] }], week: { 1: 'r3' } }
    expect(weeklyPlanLoad(empty).byMuscle).toEqual({})
  })
})
