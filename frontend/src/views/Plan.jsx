import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet, muscleBalanceInfoSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { weeklyPlanLoad, MUSCLES, MUSCLE_NAME, SETS_GUIDELINE, FREQUENCY_GUIDELINE } from '../lib/muscles.js'

// A live read of the science-backed guidelines (see muscleBalanceInfoSheet) against the
// *planned* week — before a single session happens, not after.
function MuscleBalance({ S }) {
  const { byMuscle, plannedDays } = weeklyPlanLoad(S)
  const trained = MUSCLES.filter(m => byMuscle[m])
  if (!trained.length) return null
  return <>
    <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Muscle balance')}</h4>
      <button className="iconbtn" aria-label={t('About this')} onClick={muscleBalanceInfoSheet}><Icon name="info" /></button>
    </div>
    <div className="list" style={{ gap: 0 }}>
      {trained.map(m => {
        const { sets, days } = byMuscle[m]
        const low = sets < SETS_GUIDELINE.low
        const freqFlag = days < FREQUENCY_GUIDELINE && plannedDays >= FREQUENCY_GUIDELINE
        return <div key={m} className="row between" style={{ padding: '7px 2px', borderBottom: '1px solid var(--sep)' }}>
          <span className="small">{t(MUSCLE_NAME[m])}</span>
          <span className="row" style={{ gap: 10 }}>
            <span className="small" style={{ color: low ? 'var(--yellow)' : 'var(--label-2)' }}>{t('{0} sets/wk', fmtNum(sets))}</span>
            <span className="small" style={{ color: freqFlag ? 'var(--yellow)' : 'var(--label-2)' }}>{t('{0}x/wk', days)}</span>
          </span>
        </div>
      })}
    </div>
  </>
}

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      {coachOn && <button className="iconbtn" onClick={() => nav('/coach')} aria-label={t('Coach')} title={t('Coach')}><Icon name="sparkles" /></button>}
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      </>}
    </div></div>
    <MuscleBalance S={S} />
  </>
}
