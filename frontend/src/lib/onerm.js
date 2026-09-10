// Estimated one-rep max (issue #18).
//
// Deliberately knows nothing about the exercise database: an estimate needs a weight AND a
// rep count, and only reps-mode sets carry both. Cardio sets ({min, speed}) and timed sets
// ({sec, w}) therefore drop out of every scan here on their own — there is no exercise-type
// check to keep in sync.
//
// Formulas are the usual submaximal-load estimators. Epley is the default because it is the
// one most lifters have seen; all of them agree closely at low reps and diverge as reps rise,
// which is exactly why REP_CAP exists.

// Above this many reps an estimate says more about work capacity than about maximal strength,
// and the formulas disagree by double digits. Refusing to guess beats printing a fantasy.
export const REP_CAP = 12

export const FORMULAS = {
  // Epley 1985 — w · (1 + r/30)
  epley: (w, r) => w * (1 + r / 30),
  // Brzycki 1993 — w · 36/(37 − r); undefined at r ≥ 37, but REP_CAP is far below that
  brzycki: (w, r) => w * 36 / (37 - r),
  // Lombardi 1989 — w · r^0.10
  lombardi: (w, r) => w * Math.pow(r, 0.1)
}
export const DEFAULT_FORMULA = 'epley'

// Estimate a 1RM from one set with a single named formula. Returns null for anything it
// cannot honestly answer: missing/zero/negative load, no reps, non-finite input, or more
// reps than REP_CAP. A single rep is not an estimate — it is the measurement — and comes
// back unchanged.
export function estimate1RM(w, r, formula = DEFAULT_FORMULA) {
  const weight = Number(w)
  const reps = Number(r)
  if (!isFinite(weight) || !isFinite(reps)) return null
  if (weight <= 0 || reps < 1) return null
  if (reps > REP_CAP) return null
  const fn = FORMULAS[formula] || FORMULAS[DEFAULT_FORMULA]
  const est = reps === 1 ? weight : fn(weight, Math.round(reps))
  if (!isFinite(est) || est <= 0) return null
  return Math.round(est * 10) / 10
}

// The three formulas agree closely at low reps and diverge as reps rise — Epley trends high,
// Brzycki trends low, at the same rep count off the same set. Averaging them cancels a good
// share of any one formula's own bias rather than betting the whole estimate on Epley's, and
// reporting the spread across them (low…high) says outright how much the formulas actually
// disagree here, instead of a single number pretending to a precision none of them has earned.
export function estimate1RMRange(w, r) {
  const weight = Number(w)
  const reps = Number(r)
  if (!isFinite(weight) || !isFinite(reps)) return null
  if (weight <= 0 || reps < 1) return null
  if (reps > REP_CAP) return null
  if (reps === 1) return { est: weight, low: weight, high: weight }
  const vals = Object.values(FORMULAS)
    .map(fn => fn(weight, Math.round(reps)))
    .filter(v => isFinite(v) && v > 0)
  if (!vals.length) return null
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const r1 = v => Math.round(v * 10) / 10
  return { est: r1(mean), low: r1(Math.min(...vals)), high: r1(Math.max(...vals)) }
}

// Best estimate out of one workout entry's completed sets, by the blended estimate.
// `topW` is ignored on purpose: it records the working weight a user confirmed after the
// exercise, with no rep count attached, so it cannot produce an estimate.
export function bestSetOf(entry) {
  let best = null
  ;(entry?.sets || []).forEach(s => {
    if (!s.done) return
    const range = estimate1RMRange(s.w, s.r)
    if (range && (!best || range.est > best.est)) best = { ...range, w: Number(s.w), r: Math.round(Number(s.r)) }
  })
  return best
}

// One point per workout in which the exercise produced an estimate — feeds the trend chart.
// Chronological, matching the order workouts are appended in.
export function e1rmSeries(S, exId) {
  const pts = []
  ;(S.workouts || []).forEach(w => {
    const entry = w.entries.find(e => e.id === exId)
    if (!entry) return
    const best = bestSetOf(entry)
    if (best) pts.push({ t: w.start, d: w.d, y: best.est, low: best.low, high: best.high, w: best.w, r: best.r })
  })
  return pts
}

// All-time best estimate for an exercise, with the set and date it came from — the source
// matters, because "142.5 kg est. from 100×10" is a very different claim from "from 140×1".
export function best1RM(S, exId) {
  let best = null
  e1rmSeries(S, exId).forEach(p => { if (!best || p.y > best.est) best = { est: p.y, low: p.low, high: p.high, w: p.w, r: p.r, d: p.d, t: p.t } })
  return best
}

// Did this workout beat every estimate that came before it? Used for the finish summary,
// so it compares against history that does not yet contain `w`.
export function is1RMRecord(S, exId, entry) {
  const now = bestSetOf(entry)
  if (!now) return null
  const prev = best1RM(S, exId)
  return !prev || now.est > prev.est ? { ...now, prev: prev ? prev.est : 0 } : null
}
