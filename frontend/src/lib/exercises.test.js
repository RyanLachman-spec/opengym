import { describe, it, expect } from 'vitest'
import { EXDB, COMMON_EQUIPMENT, equipmentOf } from './exercises.js'

describe('COMMON_EQUIPMENT', () => {
  it('is capped at 14 and ordered most-used first, matching equipmentOf over the whole catalogue', () => {
    const all = equipmentOf(EXDB)
    expect(COMMON_EQUIPMENT.length).toBe(Math.min(14, all.length))
    expect(COMMON_EQUIPMENT).toEqual(all.slice(0, 14))
  })

  it('every entry actually has exercises behind it', () => {
    for (const eq of COMMON_EQUIPMENT) {
      expect(EXDB.some(e => e.eq === eq)).toBe(true)
    }
  })
})
