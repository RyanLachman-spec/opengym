// Plate math for a barbell lift: given a target weight, what to load per side.
//
// Real gym plate sets (25/20/15/10/5/2.5/1.25 kg, 45/35/25/10/5/2.5 lb) are designed so a
// greedy pick from the largest plate down always hits any target the set can reach at all —
// there is no combination that a smaller-first search would find and greedy would miss. The
// only targets that don't land exactly are below the bar itself, or finer than the smallest
// plate in the set, and both are reported as a diff rather than silently rounded.

import { dateLocale } from './i18n.js'

export const DEFAULT_BAR = { kg: 20, lb: 45 }
export const DEFAULT_SET = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] }

// fmtNum() rounds to one decimal for logged weights, which turns a real 1.25kg plate into a
// misleading "1.3" — plate sizes are fixed catalog numbers, not something to round for display.
export const plateLabel = n => n.toLocaleString(dateLocale(), { maximumFractionDigits: 2 })

export const barOf = S => S.plateBar || DEFAULT_BAR[S.unit] || DEFAULT_BAR.kg
export const plateSetOf = S => (S.plateSet && S.plateSet.length ? S.plateSet : DEFAULT_SET[S.unit] || DEFAULT_SET.kg)

/**
 * Plates to load per side to reach `target`, greedy from the largest available plate.
 * Returns { bar, perSide: [{plate, count}], achieved, target, diff } — diff is target minus
 * what these plates can actually achieve (0 when exact, negative when target is below the bar).
 */
export function calcPlates(target, { bar, set } = {}) {
  bar = bar > 0 ? bar : DEFAULT_BAR.kg
  set = (set && set.length) ? set : DEFAULT_SET.kg
  const perSideTarget = Math.max(0, Math.round((target - bar) / 2 * 100) / 100)
  const sorted = [...set].filter(p => p > 0).sort((a, b) => b - a)

  const picked = []
  let remaining = perSideTarget
  for (const p of sorted) {
    let n = 0
    while (remaining - p >= -1e-6) { remaining = Math.round((remaining - p) * 100) / 100; n++ }
    if (n) picked.push({ plate: p, count: n })
  }
  const loadedPerSide = picked.reduce((s, x) => s + x.plate * x.count, 0)
  const achieved = Math.round((bar + loadedPerSide * 2) * 100) / 100
  return { bar, perSide: picked, achieved, target, diff: Math.round((target - achieved) * 100) / 100 }
}
