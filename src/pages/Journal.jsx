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
import { GaugeBar } from '../ds/octane/components/data/GaugeBar.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
const AUTONOMIE_TONE = (d) => d == null ? undefined : d < 3 ? 'alarm' : d < 6 ? 'warn' : 'ok'
// Jusqu'à 10 machines par station (stations.nombre_machines, réglable dans Stations & équipe).
const MAX_MACHINES = 10
const machineNums = (n) => Array.from({ length: n }, (_, i) => i + 1)

const CHECKLIST = [
  { key: 'matin', label: 'Matin (8h) — stock & ouverture', hint: "Relève le stock en cuve et les compteurs d'ouverture, avec photo." },
  { key: 'apres-midi', label: '16 h — ventes & compteurs', hint: 'Enregistre les ventes de la veille et les 8 relevés compteurs (obligatoire).' },
  { key: 'soir', label: 'Soir — clôture & versement', hint: 'Enregistre les dépenses justifiées et le versement en banque, avec photo.' },
]

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

export default function Journal() {
  const { stationId, current } = useStation()
  const nav = useNavigate()
  const [moments, setMoments] = useState(new Set())
  const [forecast, setForecast] = useState(null)
  const [manque, setManque] = useState({ carburant: 0, gaz_lub: 0, superette: 0 })
  const [depGeneral, setDepGeneral] = useState(0)
  const [pertes, setPertes] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pumpRows, setPumpRows] = useState([])
  const [pompeInactiveApres, setPompeInactiveApres] = useState(5)
  const [stock, setStock] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!stationId) return; (async () => {
    setLoading(true)
    const day = today()
    const monthStart = day.slice(0, 7) + '-01'
    const monthEnd = day.slice(0, 7) + '-31'
    const [sub, fc, recon, exp, pert, al, po, st, pr, ls] = await Promise.all([
      supabase.from('submissions').select('moment').eq('station_id', stationId).eq('report_date', day),
      supabase.from('v_stock_forecast').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_pole_recon_jour').select('*').eq('station_id', stationId).gte('report_date', monthStart).lte('report_date', monthEnd),
      supabase.from('expenses').select('categorie,montant,non_cash').eq('station_id', stationId).gte('report_date', monthStart).lte('report_date', monthEnd),
      supabase.from('v_pertes_mensuelles').select('*').eq('station_id', stationId).eq('mois', day.slice(0, 7)).maybeSingle(),
      supabase.from('v_alerts').select('*').eq('station_id', stationId).gte('report_date', monthStart).lte('report_date', monthEnd),
      supabase.from('fuel_orders').select('id', { count: 'exact', head: true }).eq('station_id', stationId).in('statut', ['lancee', 'partielle']),
      supabase.from('settings').select('pompe_inactive_apres').eq('id', 1).maybeSingle(),
      supabase.from('daily_reports').select(['report_date', ...machineNums(MAX_MACHINES).flatMap(n => [`e${n}`, `g${n}`])].join(',')).eq('station_id', stationId).order('report_date', { ascending: false }).limit(60),
      supabase.from('v_latest_stock').select('bons_restant,bons_utilises_depuis').eq('station_id', stationId).maybeSingle(),
    ])
    setMoments(new Set((sub.data || []).map(x => x.moment)))
    setForecast(fc.data || null)
    setStock(ls.data || null)

    // Même décomposition que « Cash non tracé » du Tableau de bord admin (recettes − versé,
    // éclatée par pôle), MAIS attribuée période par période (via v_pole_recon_jour) et non plus
    // par simple découpage calendaire : un versement à cheval sur deux mois comptait son montant
    // ENTIER dans le mois de clôture alors que la recette qu'il couvre restait pour partie dans
    // le mois précédent (via report_date) — ça faisait apparaître un manque négatif/trop bas ce
    // mois-ci pendant que les vraies alertes (qui suivent chaque période, pas le mois calendaire)
    // continuaient de signaler un manque réel sur une autre période/pôle. Ici : un jour qui clôture
    // une période compte le cumul réel de CETTE période (recette_cloture − verse, quelle que soit
    // sa durée) ; un jour encore ouvert/couvert par une période en cours ne compte rien (résolu au
    // jour de clôture, où qu'il tombe) ; un jour non couvert par aucune période compte sa recette brute.
    const manqueByPole = { carburant: 0, gaz_lub: 0, superette: 0 }
    for (const g of (recon.data || [])) {
      if (!(g.pole_groupe in manqueByPole)) continue
      if (N(g.nb_cloture) > 0 && g.recette_cloture != null) manqueByPole[g.pole_groupe] += N(g.recette_cloture) - N(g.verse)
      else if (!g.couvert) manqueByPole[g.pole_groupe] += N(g.espece)
    }

    let depSuperette = 0, depGen = 0
    for (const e of (exp.data || [])) {
      if (e.non_cash) continue // prélèvement carburant propriétaire : non-cash, jamais décompté
      if (e.categorie === 'SUPERETTE') depSuperette += N(e.montant)
      else if (e.categorie !== 'CARBURANT') depGen += N(e.montant) // SBEE, AUTRE : charges générales non affectées à un pôle
    }

    setManque({
      carburant: manqueByPole.carburant,
      gaz_lub: manqueByPole.gaz_lub,
      superette: manqueByPole.superette - depSuperette,
    })
    setDepGeneral(depGen)

    setPertes(pert.data || null)
    setAlerts((al.data || []).sort((a, b) => (a.gravite === 'haute' ? -1 : 1) - (b.gravite === 'haute' ? -1 : 1)))
    setPendingCount(po.count || 0)
    setPompeInactiveApres(N(st.data?.pompe_inactive_apres) || 5)
    setPumpRows(pr.data || [])
    setLoading(false)
  })() }, [stationId])

  if (loading) return <Panel><p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Chargement…</p></Panel>

  const manqueTotal = manque.carburant + manque.gaz_lub + manque.superette - depGeneral
  const topAlerts = alerts.slice(0, 5)
  const nombreMachines = Math.min(MAX_MACHINES, Math.max(1, N(current?.nombre_machines) || 4))
  const pumps = machineNums(nombreMachines).map(n => ({
    n, e: `e${n}`, g: `g${n}`,
    eStatus: pumpStatus(pumpRows, `e${n}`, pompeInactiveApres),
    gStatus: pumpStatus(pumpRows, `g${n}`, pompeInactiveApres),
  }))
  const nbActives = pumps.reduce((s, p) => s + (p.eStatus === 'active' ? 1 : 0) + (p.gStatus === 'active' ? 1 : 0), 0)
  const nbInactives = pumps.reduce((s, p) => s + (p.eStatus === 'inactive' ? 1 : 0) + (p.gStatus === 'inactive' ? 1 : 0), 0)
  const capaciteEssence = N(current?.capacite_essence) || 20000
  const capaciteGasoil = N(current?.capacite_gasoil) || 20000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* ===== MÉTRIQUES ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Autonomie essence" value={forecast?.jours_essence != null ? forecast.jours_essence : '—'} unit={forecast?.jours_essence != null ? 'j' : ''} status={AUTONOMIE_TONE(forecast?.jours_essence)} sub={forecast?.ess_stock != null ? `${Math.round(forecast.ess_stock)} L en cuve` : ''} />
        <Kpi label="Autonomie gasoil" value={forecast?.jours_gasoil != null ? forecast.jours_gasoil : '—'} unit={forecast?.jours_gasoil != null ? 'j' : ''} status={AUTONOMIE_TONE(forecast?.jours_gasoil)} sub={forecast?.gas_stock != null ? `${Math.round(forecast.gas_stock)} L en cuve` : ''} />
        <Kpi label="Manque à verser (mois)" value={fcfa(manqueTotal)} status={manqueTotal > 0 ? 'alarm' : 'ok'} />
        <Kpi label="Pertes carburant (mois)" value={pertes?.perte_na_montant ? fcfa(pertes.perte_na_montant) : fcfa(0)} status={N(pertes?.perte_na_montant) > 0 ? 'alarm' : 'ok'} sub={pertes?.perte_na_litres ? `${Math.round(N(pertes.perte_na_litres)).toLocaleString('fr-FR')} L hors seuil` : ''} />
        <Kpi label="Pompes actives" value={`${nbActives}/${pumps.length * 2}`} status={nbInactives > 0 ? 'alarm' : 'ok'} sub={nbInactives > 0 ? `${nbInactives} hors service` : ''} />
        <Kpi label="Bons en cours" value={stock?.bons_restant != null ? fcfa(stock.bons_restant) : '—'}
          sub={N(stock?.bons_utilises_depuis) > 0 ? `dont ${fcfa(stock.bons_utilises_depuis)} engagés en commandes` : ''}
          status={stock?.bons_restant != null && stock.bons_restant < 0 ? 'alarm' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <Panel title="État des cuves" style={{ height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              <GaugeBar value={N(forecast?.ess_stock)} max={capaciteEssence} label="Essence" valueLabel={`${Math.round(N(forecast?.ess_stock)).toLocaleString('fr-FR')} / ${capaciteEssence.toLocaleString('fr-FR')} L`} />
              <GaugeBar value={N(forecast?.gas_stock)} max={capaciteGasoil} label="Gasoil" valueLabel={`${Math.round(N(forecast?.gas_stock)).toLocaleString('fr-FR')} / ${capaciteGasoil.toLocaleString('fr-FR')} L`} />
            </div>
          </Panel>
        </div>
        <div style={{ flex: '2 1 480px' }}>
          <Panel title="Pompes" meta={`sur les ${pompeInactiveApres} derniers relevés`} style={{ height: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
              {pumps.map(m => (
                <div key={m.n} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <Icon name="fuel" size={13} color="var(--text-muted)" />
                    <span style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)' }}>Machine {m.n}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-body)' }}>Essence (E{m.n})</span>
                    <Badge tone={m.eStatus === 'active' ? 'ok' : m.eStatus === 'inactive' ? 'alarm' : 'idle'}>{m.eStatus === 'active' ? 'Active' : m.eStatus === 'inactive' ? 'Hors service' : '—'}</Badge>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-body)' }}>Gasoil (G{m.n})</span>
                    <Badge tone={m.gStatus === 'active' ? 'ok' : m.gStatus === 'inactive' ? 'alarm' : 'idle'}>{m.gStatus === 'active' ? 'Active' : m.gStatus === 'inactive' ? 'Hors service' : '—'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Manque à verser par pôle" meta="ce mois">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <PoleLine label="Carburant" value={manque.carburant} />
          <PoleLine label="Gaz + Lubrifiant" value={manque.gaz_lub} />
          <PoleLine label="Supérette" value={manque.superette} />
          <PoleLine label="Charges générales (SBEE, autre)" value={-depGeneral} muted />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3) var(--sp-4)', borderTop: '1px solid var(--border-default)', marginTop: 'var(--sp-2)' }}>
            <span style={{ font: 'var(--fw-semibold) 13px/1.3 var(--font-ui)', color: 'var(--text-primary)' }}>= Cash non tracé (mois)</span>
            <span style={{ font: '600 13px/1 var(--font-data)', color: manqueTotal > 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(manqueTotal)}</span>
          </div>
        </div>
      </Panel>

      {/* ===== ACTIONS À FAIRE + ALERTES ===== */}
      <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px' }}>
          <Panel title="Aujourd'hui — à faire" meta={frDate(today())} style={{ height: '100%' }}>
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
                    {done ? <Badge tone="ok">Envoyé</Badge> : <Button size="sm" tone="primary" onClick={() => nav(`/saisie?moment=${c.key}`)}>Faire</Button>}
                  </div>
                )
              })}
              {pendingCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', borderLeft: 'var(--bw-accent) solid var(--state-info)' }}>
                  <Icon name="truck" size={16} color="var(--state-info)" />
                  <div style={{ flex: 1, font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>{pendingCount} commande{pendingCount > 1 ? 's' : ''} en attente de réception</div>
                  <Button size="sm" tone="primary" onClick={() => nav('/saisie')}>Réceptionner</Button>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div style={{ flex: '1 1 380px' }}>
          <Panel title="Alertes du mois" meta={`${alerts.length}`} flush style={{ height: '100%' }}>
            {topAlerts.length
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--gutter-panel)' }}>
                  {topAlerts.map((a, i) => {
                    const meta = ALERT_TONES[a.type] || { label: a.type, tone: 'info' }
                    return (
                      <AlertBanner key={i} tone={meta.tone} title={meta.label} timestamp={frDate(a.report_date)}
                        action={a.report_date && <Button size="sm" onClick={() => nav(`/saisie?date=${a.report_date}`)}>Traiter</Button>}>
                        {a.detail}
                      </AlertBanner>
                    )
                  })}
                  {alerts.length > topAlerts.length && (
                    <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>+ {alerts.length - topAlerts.length} autre(s) alerte(s).</p>
                  )}
                </div>
              : <PanelEmpty icon="check" label="Aucune alerte ce mois" />}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function PoleLine({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)' }}>
      <span style={{ font: '400 13px/1.3 var(--font-ui)', color: muted ? 'var(--text-muted)' : 'var(--text-body)' }}>{label}</span>
      <span style={{ font: '500 13px/1 var(--font-data)', color: muted ? 'var(--text-muted)' : value > 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{value < 0 ? '− ' + fcfa(Math.abs(value)) : fcfa(value)}</span>
    </div>
  )
}
