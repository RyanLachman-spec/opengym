import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchFood, lookupBarcode, makeEntry, entriesFor, dayTotals, nutritionTargets, ACTIVITY } from './food.js'

afterEach(() => { vi.unstubAllGlobals() })

function stubFetch(body, ok = true, status = 200) {
  const fn = vi.fn(async () => ({ ok, status, json: async () => body }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('searchFood', () => {
  it('calls Open Food Facts with the query and language, and normalizes the results', async () => {
    const fn = stubFetch({
      products: [
        { code: '123', product_name: 'Chicken breast', product_name_es: 'Pechuga de pollo', brands: 'BrandA, Extra', quantity: '500g',
          nutriments: { 'energy-kcal_100g': 165, proteins_100g: 31, carbohydrates_100g: 0, fat_100g: 3.6 } }
      ]
    })
    const out = await searchFood('chicken', 'es')
    const url = fn.mock.calls[0][0]
    expect(url).toContain('search_terms=chicken')
    expect(url).toContain('lc=es')
    expect(out).toEqual([{
      barcode: '123', name: 'Pechuga de pollo', brand: 'BrandA', quantity: '500g',
      per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
    }])
  })

  it('prefers the localized name but falls back to the generic one', async () => {
    stubFetch({ products: [{ code: '1', product_name: 'Oats', nutriments: { 'energy-kcal_100g': 389 } }] })
    const out = await searchFood('oats', 'nl')
    expect(out[0].name).toBe('Oats')
  })

  it('derives kcal from kJ when energy-kcal_100g is missing', async () => {
    stubFetch({ products: [{ code: '2', product_name: 'Bar', nutriments: { energy_100g: 1673.6 } }] })
    const out = await searchFood('bar', 'en')
    expect(out[0].per100.kcal).toBe(400)
  })

  it('drops products with no usable calorie figure rather than showing zero', async () => {
    stubFetch({ products: [{ code: '3', product_name: 'Mystery item', nutriments: {} }] })
    expect(await searchFood('mystery', 'en')).toEqual([])
  })

  it('drops products with no name at all', async () => {
    stubFetch({ products: [{ code: '4', nutriments: { 'energy-kcal_100g': 100 } }] })
    expect(await searchFood('nameless', 'en')).toEqual([])
  })

  it('returns nothing for a blank query, without calling out', async () => {
    const fn = stubFetch({ products: [] })
    expect(await searchFood('   ', 'en')).toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  it('throws on a failed request', async () => {
    stubFetch({}, false, 503)
    await expect(searchFood('x', 'en')).rejects.toThrow(/503/)
  })
})

describe('lookupBarcode', () => {
  it('normalizes a found product', async () => {
    stubFetch({ status: 1, product: { code: '737628064502', product_name_es: 'Crema de cacahuete', brands: 'BrandB',
      nutriments: { 'energy-kcal_100g': 588, proteins_100g: 25, carbohydrates_100g: 20, fat_100g: 50 } } })
    const p = await lookupBarcode('737628064502', 'es')
    expect(p.name).toBe('Crema de cacahuete')
    expect(p.per100.kcal).toBe(588)
  })

  it('returns null for an unknown barcode rather than throwing', async () => {
    stubFetch({ status: 0 })
    expect(await lookupBarcode('000000000000', 'en')).toBeNull()
  })

  it('returns null for a blank barcode without calling out', async () => {
    const fn = stubFetch({ status: 0 })
    expect(await lookupBarcode('', 'en')).toBeNull()
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('makeEntry / entriesFor / dayTotals', () => {
  const product = { barcode: '1', name: 'Rice', brand: null, per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }

  it('scales per-100g figures to the logged grams', () => {
    const e = makeEntry(product, 150, '2026-09-10', 'e1')
    expect(e).toMatchObject({ id: 'e1', d: '2026-09-10', grams: 150, kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 })
  })

  it('treats a negative or missing quantity as zero rather than throwing', () => {
    expect(makeEntry(product, -5, '2026-09-10', 'e2').grams).toBe(0)
    expect(makeEntry(product, undefined, '2026-09-10', 'e3').kcal).toBe(0)
  })

  it('filters and sums entries by day', () => {
    const S = { foodLog: [
      makeEntry(product, 100, '2026-09-10', 'a'),
      makeEntry(product, 200, '2026-09-10', 'b'),
      makeEntry(product, 100, '2026-09-09', 'c')
    ] }
    const today = entriesFor(S, '2026-09-10')
    expect(today).toHaveLength(2)
    expect(dayTotals(today)).toEqual({ kcal: 390, protein: 8.1, carbs: 84, fat: 0.9 })
  })

  it('sums to zero for an empty day', () => {
    expect(dayTotals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
})

describe('nutritionTargets', () => {
  const withProfile = (over = {}) => ({
    unit: 'kg', body: 'male', targetW: 75,
    bodyweight: [{ d: '2026-09-01', w: 80 }],
    foodProfile: { heightCm: 180, age: 30, activity: 'moderate' },
    ...over
  })

  it('is null without a food profile or without any weigh-in', () => {
    expect(nutritionTargets({ unit: 'kg', bodyweight: [{ d: '1', w: 80 }] })).toBeNull()
    expect(nutritionTargets(withProfile({ bodyweight: [] }))).toBeNull()
  })

  it('computes a cut (goal below current weight) from Mifflin-St Jeor, matched by hand', () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; TDEE = 1780*1.55 = 2759
    // deficit = 80*0.007*7700/7 = 616; kcal = 2759-616 = 2143
    const t = nutritionTargets(withProfile())
    expect(t).toEqual({ goal: 'cut', rmr: 1780, tdee: 2759, kcal: 2143, protein: 192, fat: 60, carbs: 210 })
  })

  it('computes maintenance when the goal is within half a kilo of current weight', () => {
    const t = nutritionTargets(withProfile({ targetW: 60, body: 'female',
      foodProfile: { heightCm: 165, age: 28, activity: 'light' }, bodyweight: [{ d: '1', w: 60 }] }))
    expect(t).toEqual({ goal: 'maintain', rmr: 1330.3, tdee: 1829.1, kcal: 1829, protein: 108, fat: 51, carbs: 235 })
  })

  it('computes a bulk (goal above current weight) with a smaller, more conservative surplus', () => {
    const t = nutritionTargets(withProfile({ targetW: 78, foodProfile: { heightCm: 175, age: 25, activity: 'active' },
      bodyweight: [{ d: '1', w: 70 }] }))
    expect(t).toEqual({ goal: 'bulk', rmr: 1673.8, tdee: 2887.2, kcal: 3157, protein: 126, fat: 88, carbs: 466 })
  })

  it('never prescribes below resting energy expenditure even for a steep gap to the goal', () => {
    const t = nutritionTargets(withProfile({ targetW: 40, foodProfile: { heightCm: 180, age: 60, activity: 'sedentary' } }))
    expect(t.kcal).toBeGreaterThanOrEqual(t.rmr)
  })

  it('converts pounds to kilograms before computing anything', () => {
    const kg = nutritionTargets(withProfile())
    const lb = nutritionTargets(withProfile({ unit: 'lb', targetW: 165.3, bodyweight: [{ d: '1', w: 176.4 }] }))
    expect(lb.kcal).toBeCloseTo(kg.kcal, -1)
  })

  it('every activity level maps to a real multiplier, all distinct', () => {
    const levels = Object.keys(ACTIVITY)
    const vals = new Set(levels.map(l => ACTIVITY[l]))
    expect(vals.size).toBe(levels.length)
  })
})
