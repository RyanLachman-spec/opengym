import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { fmtNum, fmtDate, todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { entriesFor, dayTotals, nutritionTargets } from '../lib/food.js'
import { foodSearchSheet, foodProfileSheet, foodTargetsInfoSheet, deleteFoodEntry } from '../sheets.jsx'

const shiftISO = (iso, delta) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}
const pct = (have, want) => (want > 0 ? Math.max(0, Math.min(100, Math.round(have / want * 100))) : 0)

function MacroRow({ label, have, want, color }) {
  return <div className="mrow">
    <span className="nm">{label}</span>
    <span className="bar"><i style={{ width: pct(have, want) + '%', background: color }} /></span>
    <span className="v">{fmtNum(have)}/{fmtNum(want)}g</span>
  </div>
}

export default function Food() {
  const S = useStore(s => s.S)
  const [day, setDay] = useState(todayISO())
  const entries = entriesFor(S, day)
  const totals = dayTotals(entries)
  const targets = nutritionTargets(S)
  const isToday = day === todayISO()

  return <>
    <div className="hdr">
      <div><h1>{t('Food')}</h1><div className="sub">{t('Daily nutrition log')}</div></div>
      <button className="iconbtn" onClick={foodProfileSheet} aria-label={t('Nutrition targets')} title={t('Nutrition targets')}><Icon name="target" /></button>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setDay(d => shiftISO(d, -1))} aria-label={t('Prev')}><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500 }}>{isToday ? t('Today') : fmtDate(day, true)}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15, opacity: isToday ? 0.35 : 1 }} disabled={isToday} onClick={() => setDay(d => shiftISO(d, 1))} aria-label={t('Next')}><Icon name="chevronRight" /></button>
      </div>

      {targets ? <>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
          <div className="big">{fmtNum(totals.kcal)} <span className="muted" style={{ fontSize: '1rem' }}>/ {fmtNum(targets.kcal)} kcal</span></div>
          <button className="iconbtn" onClick={foodTargetsInfoSheet} aria-label={t('About this')}><Icon name="info" /></button>
        </div>
        <MacroRow label={t('Protein')} have={totals.protein} want={targets.protein} color="var(--acc)" />
        <MacroRow label={t('Carbs')} have={totals.carbs} want={targets.carbs} color="var(--blue)" />
        <MacroRow label={t('Fat')} have={totals.fat} want={targets.fat} color="var(--yellow)" />
      </> : <>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
          <div className="big">{fmtNum(totals.kcal)} <span className="muted" style={{ fontSize: '1rem' }}>kcal</span></div>
        </div>
        <div className="muted small" style={{ marginBottom: 10 }}>{t('Add your height, age and activity level to get a calorie & macro target grounded in your body and your weight goal.')}</div>
        <Button size="sm" icon="target" onClick={foodProfileSheet}>{t('Set up targets')}</Button>
      </>}
    </div>

    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Logged')}</h4>
      <Button size="sm" variant="tinted" icon="plus" onClick={() => foodSearchSheet(day)}>{t('Add food')}</Button>
    </div>
    {entries.length ? <div className="list">
      {entries.map(e => <div key={e.id} className="item">
        <div className="grow"><div className="tt">{e.name}</div><div className="ss">{e.brand ? e.brand + ' · ' : ''}{fmtNum(e.grams)}g · {fmtNum(e.kcal)} kcal</div></div>
        <button className="iconbtn" style={{ color: 'var(--red)' }} onClick={() => deleteFoodEntry(e.id)} aria-label={t('Delete')}><Icon name="trash" /></button>
      </div>)}
    </div> : <div className="empty"><div className="ico"><Icon name="apple" /></div>{t('Nothing logged yet.')}<br />{t('Search or scan a barcode to add your first item.')}</div>}
  </>
}
