import { describe, it, expect } from 'vitest'
import { sortPhotos } from './photos.js'

describe('sortPhotos', () => {
  it('orders most recent date first', () => {
    const r = sortPhotos([
      { id: 'a', d: '2026-01-01', createdAt: 1 },
      { id: 'b', d: '2026-03-01', createdAt: 1 },
      { id: 'c', d: '2026-02-01', createdAt: 1 },
    ])
    expect(r.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks a same-day tie by which was added last', () => {
    const r = sortPhotos([
      { id: 'a', d: '2026-01-01', createdAt: 100 },
      { id: 'b', d: '2026-01-01', createdAt: 200 },
    ])
    expect(r.map(p => p.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [{ id: 'a', d: '2026-01-01', createdAt: 1 }, { id: 'b', d: '2026-02-01', createdAt: 1 }]
    const copy = [...input]
    sortPhotos(input)
    expect(input).toEqual(copy)
  })
})
