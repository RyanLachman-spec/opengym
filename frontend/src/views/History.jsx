import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [gym, setGym] = useState('')
  // Only worth a filter row once there is more than one gym to tell apart — most profiles
  // train at one place and never tagged a workout at all.
  const gyms = [...new Set(S.workouts.map(w => w.gym).filter(Boolean))]
  const f = gym ? S.workouts.filter(w => w.gym === gym) : S.workouts
  return <>
    <div className="hdr"><button className="iconbtn" onClick={() => nav('/stats')} aria-label={t('Stats')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 12 }}><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
    {gyms.length > 1 && <div className="chips" style={{ marginBottom: 12 }}>
      <button className={'chip nocap' + (!gym ? ' on' : '')} onClick={() => setGym('')}>{t('All gyms')}</button>
      {gyms.map(g => <button key={g} className={'chip nocap' + (gym === g ? ' on' : '')} onClick={() => setGym(g)}>{g}</button>)}
    </div>}
    {f.length ? <div className="list">{[...f].reverse().map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} />)}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t(S.workouts.length ? 'No workouts at {0}.' : 'No workouts yet.', gym)}</div>}
  </>
}
