import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, today } from '../lib/format'
import { ALERT_TONES } from '../lib/tones'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
const AUTONOMIE_TONE = (d) => d == null ? undefined : d < 3 ? 'alarm' : d < 6 ? 'warn' : 'ok'
const POLE_LABELS = { carburant: 'Carburant', gaz_lub: 'Gaz + Lubrifiant', superette: 'Supérette' }
const PUMPS = [['e1', 'E1 — Essence'], ['e2', 'E2 — Essence'], ['e3', 'E3 — Essence'], ['e4', 'E4 — Essence'], ['g1', 'G1 — Gasoil'], ['g2', 'G2 — Gasoil'], ['g3', 'G3 — Gasoil'], ['g4', 'G4 — Gasoil']]

// Une pompe est jugée hors service si ses N derniers relevés 16h renseignés (rows déjà triées
// report_date desc) sont tous identiques — l'index d'une pompe utilisée ne peut que monter.
// Pas assez de relevés (< N) → statut inconnu (pompe neuve, ou station qui ne l'a pas) : on
// n'affirme rien plutôt que de l'annoncer à tort comme hors service.
export function pumpStatus(rows, key, n) {
  const vals = []
  for (const r of rows) {
    if (r[key] != null) vals.push(Number(r[key]))
    if (vals.length >= n) break
  }
  if (vals.length < n) return null
  return vals.every(v => v === vals[0]) ? 'inactive' : 'active'
}

const CHECKLIST = [
  { key: 'matin', label: 'Matin (8h) — stock & ouverture', hint: "Relève le stock en cuve et les compteurs d'ouverture, avec photo." },
  { key: 'apres-midi', label: '16 h — ventes & compteurs', hint: 'Enregistre les ventes de la veille et les 8 relevés compteurs (obligatoire).' },
  { key: 'soir', label: 'Soir — clôture & versement', hint: 'Enregistre les dépenses justifiées et le versement en banque, avec photo.' },
]

export default function Journal() {
  const { stationId } = useStation()
  const nav = useNavigate()
  const [moments, setMoments] = useState(new Set())
  const [forecast, setForecast] = useState(null)
  const [poleTotals, setPoleTotals] = useState({ carburant: 0, gaz_lub: 0, superette: 0 })
  const [pertes, setPertes] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pumpRows, setPumpRows] = useState([])
  const [pompeInactiveApres, setPompeInactiveApres] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!stationId) return; (async () => {
    setLoading(true)
    const day = today()
    const monthStart = day.slice(0, 7) + '-01'
    const monthEnd = day.slice(0, 7) + '-31'
    const [sub, fc, recon, pert, al, po, st, pr] = await Promise.all([
      supabase.from('submissions').select('moment').eq('station_id', stationId).eq('report_date', day),
      supabase.from('v_stock_forecast').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_pole_recon_jour').select('pole_groupe,ecart,nb_cloture').eq('station_id', stationId).gte('report_date', monthStart).lte('report_date', monthEnd),
      supabase.from('v_pertes_mensuelles').select('*').eq('station_id', stationId).eq('mois', day.slice(0, 7)).maybeSingle(),
      supabase.from('v_alerts').select('*').eq('station_id', stationId),
      supabase.from('fuel_orders').select('id', { count: 'exact', head: true }).eq('station_id', stationId).in('statut', ['lancee', 'partielle']),
      supabase.from('settings').select('pompe_inactive_apres').eq('id', 1).maybeSingle(),
      supabase.from('daily_reports').select('report_date,e1,e2,e3,e4,g1,g2,g3,g4').eq('station_id', stationId).order('report_date', { ascending: false }).limit(60),
    ])
    setMoments(new Set((sub.data || []).map(x => x.moment)))
    setForecast(fc.data || null)
    const totals = { carburant: 0, gaz_lub: 0, superette: 0 }
    for (const row of (recon.data || [])) {
      if (N(row.nb_cloture) > 0 && totals[row.pole_groupe] !== undefined) totals[row.pole_groupe] += Math.max(0, N(row.ecart))
    }
    setPoleTotals(totals)
    setPertes(pert.data || null)
    setAlerts((al.data || []).sort((a, b) => (a.gravite === 'haute' ? -1 : 1) - (b.gravite === 'haute' ? -1 : 1)))
    setPendingCount(po.count || 0)
    setPompeInactiveApres(N(st.data?.pompe_inactive_apres) || 5)
    setPumpRows(pr.data || [])
    setLoading(false)
  })() }, [stationId])

  if (loading) return <Panel><p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Chargement…</p></Panel>

  const manqueTotal = poleTotals.carburant + poleTotals.gaz_lub + poleTotals.superette
  const topAlerts = alerts.slice(0, 5)
  const pumps = PUMPS.map(([key, label]) => ({ key, label, status: pumpStatus(pumpRows, key, pompeInactiveApres) }))
  const nbActives = pumps.filter(p => p.status === 'active').length
  const nbInactives = pumps.filter(p => p.status === 'inactive').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <Panel title="Aujourd'hui" meta={frDate(today())}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {CHECKLIST.map(c => {
            const done = moments.has(c.key)
            return (
              <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', borderLeft: 'var(--bw-accent) solid var(--state-' + (done ? 'ok' : 'warn') + ')' }}>
                <Icon name={done ? 'check' : 'triangle-alert'} size={16} color={done ? 'var(--state-ok)' : 'var(--state-warn)'} style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>{c.label}</div>
                  {!done && <div style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{c.hint}</div>}
                </div>
                <Badge tone={done ? 'ok' : 'warn'}>{done ? 'Envoyé' : 'À faire'}</Badge>
              </div>
            )
          })}
          {pendingCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', borderLeft: 'var(--bw-accent) solid var(--state-info)' }}>
              <Icon name="truck" size={16} color="var(--state-info)" />
              <div style={{ flex: 1, font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>{pendingCount} commande{pendingCount > 1 ? 's' : ''} en attente de réception</div>
              <Button size="sm" onClick={() => nav('/saisie')}>Réceptionner</Button>
            </div>
          )}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Autonomie essence" value={forecast?.jours_essence != null ? forecast.jours_essence : '—'} unit={forecast?.jours_essence != null ? 'j' : ''} status={AUTONOMIE_TONE(forecast?.jours_essence)} sub={forecast?.ess_stock != null ? `${Math.round(forecast.ess_stock)} L en cuve` : ''} />
        <Kpi label="Autonomie gasoil" value={forecast?.jours_gasoil != null ? forecast.jours_gasoil : '—'} unit={forecast?.jours_gasoil != null ? 'j' : ''} status={AUTONOMIE_TONE(forecast?.jours_gasoil)} sub={forecast?.gas_stock != null ? `${Math.round(forecast.gas_stock)} L en cuve` : ''} />
        <Kpi label="Manque à verser (mois)" value={fcfa(manqueTotal)} status={manqueTotal > 0 ? 'alarm' : 'ok'} />
        <Kpi label="Pertes carburant (mois)" value={pertes?.perte_na_montant ? fcfa(pertes.perte_na_montant) : fcfa(0)} status={N(pertes?.perte_na_montant) > 0 ? 'alarm' : 'ok'} sub={pertes?.perte_na_litres ? `${Math.round(N(pertes.perte_na_litres)).toLocaleString('fr-FR')} L hors seuil` : ''} />
        <Kpi label="Pompes actives" value={`${nbActives}/${pumps.length}`} status={nbInactives > 0 ? 'alarm' : 'ok'} sub={nbInactives > 0 ? `${nbInactives} hors service` : ''} />
      </div>

      <Panel title="Pompes" meta={`sur les ${pompeInactiveApres} derniers relevés`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--sp-3)' }}>
          {pumps.map(p => (
            <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)' }}>
              <span style={{ font: '400 12px/1.2 var(--font-ui)', color: 'var(--text-body)' }}>{p.label}</span>
              <Badge tone={p.status === 'active' ? 'ok' : p.status === 'inactive' ? 'alarm' : 'idle'}>
                {p.status === 'active' ? 'Active' : p.status === 'inactive' ? 'Hors service' : '—'}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Manque à verser par pôle" meta="ce mois">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {Object.entries(POLE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)' }}>
              <span style={{ font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>{label}</span>
              <span style={{ font: '500 13px/1 var(--font-data)', color: poleTotals[key] > 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(poleTotals[key])}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Alertes actives" meta={`${alerts.length}`} flush>
        {topAlerts.length
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--gutter-panel)' }}>
              {topAlerts.map((a, i) => {
                const meta = ALERT_TONES[a.type] || { label: a.type, tone: 'info' }
                return (
                  <AlertBanner key={i} tone={meta.tone} title={meta.label} timestamp={frDate(a.report_date)}>{a.detail}</AlertBanner>
                )
              })}
              {alerts.length > topAlerts.length && (
                <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>+ {alerts.length - topAlerts.length} autre(s) alerte(s).</p>
              )}
            </div>
          : <PanelEmpty icon="check" label="Aucune alerte active" />}
      </Panel>
    </div>
  )
}
