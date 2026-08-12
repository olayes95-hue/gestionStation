import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { frDate } from '../lib/format'
import { ALERT_TONES } from '../lib/tones'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'

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

  const shown = alerts.filter(a =>
    (type === 'all' || a.type === type) &&
    (year === 'all' || a.report_date.slice(0, 4) === year) &&
    (month === 'all' || a.report_date.slice(5, 7) === month) &&
    (showDismissed ? dismissed.has(key(a)) : !dismissed.has(key(a))))
  const nbActive = alerts.filter(a => !dismissed.has(key(a))).length

  const yearOptions = [{ value: 'all', label: 'Toutes années' }, ...years.map(y => ({ value: y, label: y }))]
  const monthOptions = [{ value: 'all', label: 'Tous mois' }, ...MONTHS.map(m => ({ value: m, label: ML[m] }))]
  const typeOptions = [{ value: 'all', label: 'Tous types' }, ...types.map(t => ({ value: t, label: ALERT_TONES[t]?.label || t }))]

  return (
    <Panel
      title="Alertes"
      meta={`${nbActive} active(s) · ${dismissed.size} traitée(s)`}
      flush
      actions={<>
        <Select size="sm" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
        <Select size="sm" value={month} onChange={e => setMonth(e.target.value)} options={monthOptions} />
        <Select size="sm" value={type} onChange={e => setType(e.target.value)} options={typeOptions} />
        <Checkbox label="Voir les traitées" checked={showDismissed} onChange={v => setShowDismissed(v)} />
      </>}
    >
      {loading
        ? <div style={{ padding: 'var(--sp-6)', font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)' }}>Chargement…</div>
        : !shown.length
          ? <PanelEmpty icon="bell" label={showDismissed ? 'Aucune alerte traitée' : 'Aucune alerte active'} />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--gutter-panel)' }}>
              {shown.map((a, i) => {
                const meta = ALERT_TONES[a.type] || { label: a.type, tone: 'info' }
                return (
                  <div key={i} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start', padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderLeft: 'var(--bw-accent) solid var(--state-' + meta.tone + ')', borderRadius: 'var(--radius-1)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)', alignItems: 'center' }}>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Tag>{frDate(a.report_date)}</Tag>
                      </div>
                      <div style={{ marginTop: 'var(--sp-3)', font: '400 13px/1.4 var(--font-ui)', color: 'var(--text-body)' }}>{a.detail}</div>
                    </div>
                    {showDismissed
                      ? <Button size="sm" onClick={() => restore(a)}>Rétablir</Button>
                      : <Button size="sm" onClick={() => dismiss(a)}>Traité</Button>}
                  </div>
                )
              })}
            </div>}
    </Panel>
  )
}
