import { describe, it, expect } from 'vitest'
import { buildAppleHealthXML } from './export-health.js'
import { parseBodyweight } from './import-csv.js'

describe('buildAppleHealthXML', () => {
  it('round-trips through openGym\'s own Apple Health importer', () => {
    const S = { unit: 'kg', bodyweight: [
      { d: '2026-01-10', w: 82.4, t: Date.UTC(2026, 0, 10, 8, 0, 0) },
      { d: '2026-02-01', w: 81.1, t: Date.UTC(2026, 1, 1, 7, 30, 0) },
    ] }
    const xml = buildAppleHealthXML(S)
    expect(xml).toContain('HKQuantityTypeIdentifierBodyMass')
    const parsed = parseBodyweight(xml, { unit: 'kg' })
    expect(parsed.error).toBeUndefined()
    expect(parsed.bodyweight).toEqual([
      { d: '2026-01-10', w: 82.4, t: expect.any(Number) },
      { d: '2026-02-01', w: 81.1, t: expect.any(Number) },
    ])
  })

  it('carries the lb unit through so a re-import in lb needs no conversion', () => {
    const S = { unit: 'lb', bodyweight: [{ d: '2026-03-01', w: 180.2, t: Date.UTC(2026, 2, 1) }] }
    const xml = buildAppleHealthXML(S)
    expect(xml).toContain('unit="lb"')
    const parsed = parseBodyweight(xml, { unit: 'lb' })
    expect(parsed.converted).toBe(false)
    expect(parsed.bodyweight[0].w).toBe(180.2)
  })

  it('produces a valid, well-formed export even with no weigh-ins logged', () => {
    const xml = buildAppleHealthXML({ unit: 'kg', bodyweight: [] })
    expect(xml).toContain('<HealthData')
    expect(xml).toContain('</HealthData>')
    expect(xml).not.toContain('HKQuantityTypeIdentifierBodyMass')
  })

  it('escapes a weight value so a malformed one cannot break the XML', () => {
    const xml = buildAppleHealthXML({ unit: 'kg', bodyweight: [{ d: '2026-01-01', w: '80"/><evil/>', t: Date.now() }] })
    expect(xml).not.toContain('<evil/>')
  })
})
