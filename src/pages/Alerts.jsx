import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { ALERT_LABELS, frDate } from '../lib/format'

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }
const key = (a) => `${a.report_date}|${a.type}`

export default function AlertsPage() {
  const { session } = useAuth()
  const { stationId } = useStation()
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [type, setType] = useState('all')
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [showDismissed, setShowDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!stationId) return
    setLoading(true)
    const { data } = await supabase.from('v_alerts').select('*').eq('station_id', stationId).order('report_date', { ascending: false })
    setAlerts(data || [])
    const { data: d } = await supabase.from('alert_dismissals').select('report_date,type').eq('station_id', stationId)
    setDismissed(new Set((d || []).map(x => `${x.report_date}|${x.type}`)))
    setLoading(false)
  }
  useEffect(() => { load() }, [stationId])

  async function dismiss(a) {
    await supabase.from('alert_dismissals').upsert(
      { station_id: stationId, report_date: a.report_date, type: a.type, dismissed_by: session.user.id },
      { onConflict: 'station_id,report_date,type' })
    setDismissed(p => new Set(p).add(key(a)))
  }
  async function restore(a) {
    await supabase.from('alert_dismissals').delete().eq('station_id', stationId).eq('report_date', a.report_date).eq('type', a.type)
    setDismissed(p => { const n = new Set(p); n.delete(key(a)); return n })
  }

  const years = useMemo(() => [...new Set(alerts.map(a => a.report_date.slice(0, 4)))].sort(), [alerts])
  const types = useMemo(() => [...new Set(alerts.map(a => a.type))], [alerts])
  const [inited, setInited] = useState(false)
  useEffect(() => {
    if (!inited && alerts.length) {
      const d = alerts.map(a => a.report_date).sort().at(-1)
      setYear(d.slice(0, 4)); setMonth(d.slice(5, 7)); setInited(true)
    }
  }, [alerts, inited])
  if (loading) return <div className="center">Chargement…</div>

  const shown = alerts.filter(a =>
    (type === 'all' || a.type === type) &&
    (year === 'all' || a.report_date.slice(0, 4) === year) &&
    (month === 'all' || a.report_date.slice(5, 7) === month) &&
    (showDismissed ? dismissed.has(key(a)) : !dismissed.has(key(a))))
  const nbActive = alerts.filter(a => !dismissed.has(key(a))).length

  return (
    <div>
      <div className="card">
        <h2>Alertes — {nbActive} active(s) · {dismissed.size} traitée(s)</h2>
        <div className="toolbar">
          <select value={year} onChange={e => setYear(e.target.value)}><option value="all">Toutes années</option>{years.map(y => <option key={y}>{y}</option>)}</select>
          <select value={month} onChange={e => setMonth(e.target.value)}><option value="all">Tous mois</option>{MONTHS.map(m => <option key={m} value={m}>{ML[m]}</option>)}</select>
          <select value={type} onChange={e => setType(e.target.value)}><option value="all">Tous types</option>{types.map(t => <option key={t} value={t}>{ALERT_LABELS[t]?.label || t}</option>)}</select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" style={{ width: 16 }} checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} /> Voir les traitées
          </label>
        </div>
        {!shown.length && <p className="muted">{showDismissed ? 'Aucune alerte traitée.' : 'Aucune alerte active. 🎉'}</p>}
        {shown.map((a, i) => {
          const meta = ALERT_LABELS[a.type] || { label: a.type, color: '#666' }
          return (
            <div className="alert-item" key={i}>
              <div className="bar" style={{ background: meta.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span className="badge" style={{ background: meta.color }}>{meta.label}</span>
                  <span className="pill">{frDate(a.report_date)}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 14 }}>{a.detail}</div>
              </div>
              {showDismissed
                ? <button className="btn sec small" onClick={() => restore(a)}>Rétablir</button>
                : <button className="btn sec small" onClick={() => dismiss(a)}>✓ Traité</button>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
