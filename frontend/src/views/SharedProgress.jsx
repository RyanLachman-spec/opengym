import { useEffect, useState } from 'react'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'

// A read-only summary at the far end of a share link (see Settings → Share progress). No
// session, no store, no app shell — whoever opens this link may have no openGym account at
// all. Only what the backend's /api/share/view already reduced the profile to: counts and a
// weekly volume trend, never the workout log itself.
function VolumeBars({ weeks, unit }) {
  const max = Math.max(1, ...weeks.map(w => w.vol))
  return <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90 }}>
    {weeks.map(w => (
      <div key={w.week} title={fmtNum(w.vol) + ' ' + unit} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: Math.max(3, Math.round(w.vol / max * 100)) + '%', background: 'var(--acc)', borderRadius: 3 }} />
      </div>
    ))}
  </div>
}

export default function SharedProgress({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/share/view?token=' + encodeURIComponent(token))
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!cancelled) (ok ? setData(d) : setError(d.error || 'not found')) })
      .catch(() => { if (!cancelled) setError('failed') })
    return () => { cancelled = true }
  }, [token])

  if (error) return <div className="narrow" style={{ paddingTop: '32vh', textAlign: 'center' }}>
    <div style={{ fontSize: 40, marginBottom: 14, color: 'var(--label-3)' }}><Icon name="lock" /></div>
    <h2 style={{ marginBottom: 6 }}>{t('This link is no longer valid')}</h2>
    <div className="muted small">{t('It may have expired or been revoked.')}</div>
  </div>

  if (!data) return <div className="narrow" style={{ paddingTop: '38vh', textAlign: 'center', color: 'var(--label-3)', fontSize: 34 }}><Icon name="dumbbell" /></div>

  const bw = data.bodyweight

  return <div className="narrow" style={{ paddingTop: 28, paddingBottom: 40 }}>
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <div style={{ fontSize: 32, marginBottom: 8, color: 'var(--acc)' }}><Icon name="dumbbell" /></div>
      <h1 style={{ marginBottom: 2 }}>{t('{0}’s progress', data.name)}</h1>
      <div className="muted small">{t('Shared from openGym — a read-only summary')}</div>
    </div>

    <div className="tiles" style={{ marginBottom: 18 }}>
      <div className="tile"><div className="l">{t('Week streak')}</div><div className="v">{data.streakWeeks}</div></div>
      <div className="tile"><div className="l">{t('Workouts')}</div><div className="v">{data.totalWorkouts}</div></div>
      <div className="tile"><div className="l">{t('Last 30 days')}</div><div className="v">{data.workoutsLast30}</div></div>
      <div className="tile"><div className="l">{t('Total PRs')}</div><div className="v">{data.totalPRs}</div></div>
    </div>

    <h4 className="sec">{t('Weekly volume')}</h4>
    <div className="card" style={{ marginBottom: 18 }}><VolumeBars weeks={data.volumeByWeek} unit={data.unit} /></div>

    {bw && <>
      <h4 className="sec">{t('Body weight')}</h4>
      <div className="card row between" style={{ marginBottom: 18 }}>
        <div><div className="muted small">{t('First logged')}</div><b>{fmtNum(bw.first.w)} {data.unit}</b></div>
        <Icon name="chevronRight" className="dim" />
        <div style={{ textAlign: 'right' }}><div className="muted small">{t('Latest')}</div><b>{fmtNum(bw.latest.w)} {data.unit}</b></div>
      </div>
    </>}

    <div className="dim small" style={{ textAlign: 'center', marginTop: 8 }}>
      openGym · <a href="https://github.com/DuarteSantos8/openGym" target="_blank" rel="noopener">{t('self-hosted, open source')}</a>
    </div>
  </div>
}
