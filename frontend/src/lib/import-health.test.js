import { describe, it, expect } from 'vitest'
import { parseSamsungHealth, parseGoogleFit, parseImport, parseWorkoutCSV } from './import-csv.js'

const SAMSUNG = [
  'com.samsung.health.weight.202601010000000000',
  'create_time,update_time,com.samsung.health.weight.start_time,com.samsung.health.weight.weight,com.samsung.health.weight.height,pkg_name',
  '2026-01-10 08:00:00.000,2026-01-10 08:00:00.000,2026-01-10 08:00:00.000,82.4,178.0,com.sec.android.app.shealth',
  '2026-01-11 08:05:00.000,2026-01-11 08:05:00.000,2026-01-11 08:05:00.000,82.1,178.0,com.sec.android.app.shealth',
].join('\n')

const GOOGLE_FIT = [
  'Date,Step count,Distance (m),Calories (kcal),Average weight (kg),Average heart rate (bpm)',
  '2026-01-10,8500,6200,2100,82.4,68',
  '2026-01-11,7200,5100,1980,,65',
  '2026-01-12,9000,6400,2150,81.9,70',
].join('\n')

const FITNOTES = ['Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment',
  '2026-01-12,Bench Press,Chest,60,kg,10,,,,'].join('\n')

describe('Samsung Health import', () => {
  it('reads weigh-ins out of a per-metric export', () => {
    const p = parseSamsungHealth(SAMSUNG, { unit: 'kg' })
    expect(p.error).toBeUndefined()
    expect(p.source).toBe('Samsung Health')
    expect(p.bodyweight).toEqual([
      { d: '2026-01-10', w: 82.4, t: expect.any(Number) },
      { d: '2026-01-11', w: 82.1, t: expect.any(Number) },
    ])
  })

  it('converts to lb when the profile is in lb', () => {
    const p = parseSamsungHealth(SAMSUNG, { unit: 'lb' })
    expect(p.converted).toBe(true)
    expect(p.bodyweight[0].w).toBeCloseTo(181.7, 1)
  })

  it('rejects a file that is not a Samsung Health export', () => {
    expect(parseSamsungHealth(FITNOTES, { unit: 'kg' }).error).toBe('unrecognised')
  })

  it('is picked up by the generic sniffer', () => {
    const p = parseImport(SAMSUNG, { unit: 'kg' })
    expect(p.kind).toBe('bodyweight')
    expect(p.source).toBe('Samsung Health')
  })
})

describe('Google Fit import', () => {
  it('reads the daily weight column, skipping days with none', () => {
    const p = parseGoogleFit(GOOGLE_FIT, { unit: 'kg' })
    expect(p.error).toBeUndefined()
    expect(p.source).toBe('Google Fit')
    expect(p.bodyweight.map(b => b.d)).toEqual(['2026-01-10', '2026-01-12'])
    expect(p.bodyweight[0].w).toBe(82.4)
  })

  it('rejects a training-history CSV that merely has Date and Weight columns', () => {
    expect(parseGoogleFit(FITNOTES, { unit: 'kg' }).error).toBe('unrecognised')
  })

  it('is picked up by the generic sniffer without swallowing a real workout CSV', () => {
    const gf = parseImport(GOOGLE_FIT, { unit: 'kg' })
    expect(gf.kind).toBe('bodyweight')
    expect(gf.source).toBe('Google Fit')

    const fn = parseImport(FITNOTES, { unit: 'kg' })
    expect(fn.kind).toBe('workouts')          // workout shape, not bodyweight
    expect(fn.workouts.length).toBe(1)
  })
})

describe('sniffing does not cross-contaminate the existing importers', () => {
  it('FitNotes/Strong/Hevy CSVs still import as workouts, not as Google Fit', () => {
    const p = parseWorkoutCSV(FITNOTES, { unit: 'kg' })
    expect(p.error).toBeUndefined()
    expect(p.sets).toBe(1)
  })
})
