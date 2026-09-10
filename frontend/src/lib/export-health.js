// The mirror of parseBodyweight() in import-csv.js: body weight OUT, in the same Apple
// Health XML shape openGym's own importer already reads (and that Apple Health, Health
// Connect exporters, and most trackers can take back in). Only body weight — a workout
// record needs a lot more HealthKit-specific metadata (heart rate samples, workout types)
// to be meaningful, and this is about not locking someone's weigh-ins into openGym, not
// reimplementing HealthKit's workout schema.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function hkDate(iso, ms) {
  const d = ms ? new Date(ms) : new Date(iso + 'T12:00:00Z')
  const p2 = n => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} +0000`
}

/** Build an Apple Health-style export XML from a profile's body-weight log. */
export function buildAppleHealthXML(S) {
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const now = hkDate(null, Date.now())
  const records = (S.bodyweight || [])
    .map(b => `  <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="openGym" sourceVersion="1.2.3" unit="${unit}" creationDate="${hkDate(b.d, b.t)}" startDate="${hkDate(b.d, b.t)}" endDate="${hkDate(b.d, b.t)}" value="${esc(b.w)}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<HealthData locale="en_US">\n` +
    ` <ExportDate value="${now}"/>\n` +
    (records ? records + '\n' : '') +
    `</HealthData>\n`
}
