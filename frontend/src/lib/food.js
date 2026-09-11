// Food & nutrition tracking (issue: feature request — "food metric like MyFitnessPal").
//
// Two independent halves live here:
//   - a thin client for Open Food Facts (openfoodfacts.org), a free, open, community-run
//     food database with no API key and no per-call cost — search by name or look up a
//     barcode, both localized to the profile's app language;
//   - evidence-based daily calorie/macro targets, derived from body profile + the existing
//     weight goal (targetW), not hand-picked. See nutritionTargets() for the citations.
//
// Every fetch here leaves the device directly from the browser to Open Food Facts — this
// app has no food-search backend and adds none. Nothing about the query or the response is
// stored server-side; only what the person chooses to log is saved, into their own state.

const OFF_BASE = 'https://world.openfoodfacts.org'
const FIELDS = 'code,product_name,product_name_{lang},brands,nutriments,quantity'

const round1 = v => Math.round(v * 10) / 10
const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0

/** OFF's raw product shape, reduced to what a food diary actually uses. Returns null for a
 * product with no usable calorie figure — showing "0 kcal" would be worse than omitting it. */
function normalizeProduct(p, lang) {
  const name = (p['product_name_' + lang] || p.product_name || '').trim()
  if (!name) return null
  const n = p.nutriments || {}
  // Some products only carry energy in kJ; 1 kcal = 4.184 kJ.
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null)
  if (kcal == null || !isFinite(kcal)) return null
  return {
    barcode: p.code || null,
    name,
    brand: (p.brands || '').split(',')[0].trim() || null,
    quantity: p.quantity || null,
    per100: { kcal: round1(kcal), protein: round1(num(n.proteins_100g)), carbs: round1(num(n.carbohydrates_100g)), fat: round1(num(n.fat_100g)) }
  }
}

/** Free-text search against Open Food Facts, localized to `lang`. Products with no usable
 * calorie data are dropped rather than shown as zero. */
export async function searchFood(query, lang = 'en', opts = {}) {
  const q = String(query || '').trim()
  if (!q) return []
  const fields = FIELDS.replaceAll('{lang}', lang)
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&lc=${encodeURIComponent(lang)}&fields=${fields}`
  const res = await fetch(url, { signal: opts.signal })
  if (!res.ok) throw new Error('Open Food Facts search failed (HTTP ' + res.status + ')')
  const data = await res.json()
  return (data.products || []).map(p => normalizeProduct(p, lang)).filter(Boolean)
}

/** Barcode lookup, localized to `lang`. Returns null for an unknown barcode or a product
 * with no usable calorie data — never throws for "not found". */
export async function lookupBarcode(barcode, lang = 'en', opts = {}) {
  const code = String(barcode || '').trim()
  if (!code) return null
  const fields = FIELDS.replaceAll('{lang}', lang)
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?lc=${encodeURIComponent(lang)}&fields=${fields}`
  const res = await fetch(url, { signal: opts.signal })
  if (!res.ok) throw new Error('Open Food Facts lookup failed (HTTP ' + res.status + ')')
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  return normalizeProduct(data.product, lang)
}

/** A logged diary entry from a normalized product and the quantity actually eaten. Stores
 * both the per-100g reference (so the entry still makes sense on its own later, e.g. if the
 * upstream product listing changes) and the computed totals for the logged grams. */
export function makeEntry(product, grams, d, id) {
  const g = Math.max(0, Number(grams) || 0)
  const f = g / 100
  return {
    id, d, t: Date.now(),
    barcode: product.barcode || null,
    name: product.name,
    brand: product.brand || null,
    grams: g,
    per100: product.per100,
    kcal: round1(product.per100.kcal * f),
    protein: round1(product.per100.protein * f),
    carbs: round1(product.per100.carbs * f),
    fat: round1(product.per100.fat * f)
  }
}

/** Entries logged on one day. */
export const entriesFor = (S, d) => (S.foodLog || []).filter(e => e.d === d)

/** Summed kcal/protein/carbs/fat for a set of entries — the day's running total. */
export function dayTotals(entries) {
  const t = entries.reduce((t, e) => ({
    kcal: t.kcal + (e.kcal || 0), protein: t.protein + (e.protein || 0),
    carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  return { kcal: round1(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) }
}

/* ---------- evidence-based targets ----------
 * Resting energy: Mifflin-St Jeor — of the standard predictive equations, the one found
 * unbiased and with the narrowest error margin against measured RMR (Frankenfield et al.
 * 2005, J Am Diet Assoc, comparing four equations in non-obese and obese adults).
 * Activity multipliers are the standard PAL categories used alongside it.
 * Rate of change: 0.7% of bodyweight per week is the rate that, head-to-head against a
 * faster 1.4%/week in trained athletes, preserved and even grew lean mass while the faster
 * rate did not (Garthe et al. 2011, Int J Sport Nutr Exerc Metab). Gaining uses a slower,
 * more conservative rate on the same "don't outrun what the body can build" logic — evidence
 * for an equivalent gain-side trial is thinner, so this errs cautious rather than symmetric.
 * Protein: ISSN's 2017 position stand on protein and exercise — 1.4-2.0 g/kg/day covers
 * general resistance training, rising to 2.3-3.1 g/kg/day in a hypocaloric period to protect
 * lean mass. Targets below sit inside those ranges rather than at either edge.
 * Fat: never let a deficit or the protein/carb split crowd fat below what hormonal health
 * needs — floored at 0.6 g/kg bodyweight regardless of the calorie target. */
export const ACTIVITY = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9
}
const LB_TO_KG = 0.45359237
const KCAL_PER_KG_FAT = 7700
const RATE = { cut: 0.007, bulk: 0.0035 }

function bmr(kg, cm, age, sex) {
  const base = 10 * kg + 6.25 * cm - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

/** null when there isn't enough profile data (height/age) or weight history to compute
 * from — the UI asks for what's missing rather than guessing. */
export function nutritionTargets(S) {
  const p = S.foodProfile
  const w = S.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1].w : null
  if (!p || !p.heightCm || !p.age || !w) return null
  const kgW = S.unit === 'lb' ? w * LB_TO_KG : w
  const sex = S.body === 'female' ? 'female' : 'male'
  const rmr = bmr(kgW, p.heightCm, p.age, sex)
  const tdee = rmr * (ACTIVITY[p.activity] || ACTIVITY.moderate)

  const targetKgW = S.targetW == null ? kgW : (S.unit === 'lb' ? S.targetW * LB_TO_KG : S.targetW)
  const goal = Math.abs(targetKgW - kgW) < 0.5 ? 'maintain' : (targetKgW < kgW ? 'cut' : 'bulk')

  let kcal = tdee
  if (goal === 'cut') kcal = tdee - (kgW * RATE.cut * KCAL_PER_KG_FAT) / 7
  else if (goal === 'bulk') kcal = tdee + (kgW * RATE.bulk * KCAL_PER_KG_FAT) / 7
  kcal = Math.max(kcal, rmr) // never prescribe under what the body burns at rest

  const proteinPerKg = goal === 'cut' ? 2.4 : 1.8
  const protein = proteinPerKg * kgW
  const fat = Math.max(0.6 * kgW, 0.25 * kcal / 9)
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4)

  return {
    goal, rmr: round1(rmr), tdee: round1(tdee),
    kcal: Math.round(kcal), protein: Math.round(protein), fat: Math.round(fat), carbs: Math.round(carbs)
  }
}
