import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate } from '../lib/format'
import { ALERT_TONES } from '../lib/tones'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { IconButton } from '../ds/octane/components/core/IconButton.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }
const YEAR_TONE = (d) => d == null ? undefined : d < 3 ? 'alarm' : d < 6 ? 'warn' : 'ok'
const YEAR_COLOR = (d) => d == null ? 'var(--text-primary)' : d < 3 ? 'var(--state-alarm)' : d < 6 ? 'var(--state-warn)' : 'var(--state-ok)'

export default function Dashboard() {
  const { stationId, stations, setStationId } = useStation()
  const nav = useNavigate()
  const [months, setMonths] = useState([])   // v_ventes_mensuelles (agrégé, rapide)
  const [alerts, setAlerts] = useState([])   // v_alerts du mois en cours (station active), triées par gravité
  const [stock, setStock] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [reorder, setReorder] = useState([])
  const [orders, setOrders] = useState([])
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [refreshedAt, setRefreshedAt] = useState('')
  const [inited, setInited] = useState(false)
  const [openRecon, setOpenRecon] = useState(false)
  const [overview, setOverview] = useState([])   // vue comparative multi-stations (indép. de la station sélectionnée)

  async function loadStock() {
    if (!stationId) return
    const [ls, sf, ro] = await Promise.all([
      supabase.from('v_latest_stock').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_stock_forecast').select('*').eq('station_id', stationId).maybeSingle(),
      supabase.from('v_reorder').select('*').eq('station_id', stationId),
    ])
    setStock(ls.data || null); setForecast(sf.data || null); setReorder(ro.data || [])
    setRefreshedAt(new Date().toLocaleTimeString('fr-FR'))
  }
  useEffect(() => { if (!stationId) return
    setLoading(true)
    // Le stock (rapide) s'affiche en premier ; les autres blocs se remplissent dès qu'ils arrivent,
    // sans s'attendre les uns les autres. La vue mensuelle (la plus lourde) ne bloque plus le rendu.
    loadStock()
    supabase.from('fuel_orders').select('categorie,statut,quantite_commandee,cuve_avant,cuve_apres,montant').eq('station_id', stationId)
      .then(({ data }) => setOrders(data || []))
    supabase.from('inspections').select('conforme').eq('station_id', stationId)
      .then(({ data }) => setInspections(data || []))
    supabase.from('v_ventes_mensuelles').select('*').eq('station_id', stationId).order('mois')
      .then(({ data }) => { setMonths(data || []); setLoading(false) })
    // les alertes (vue lourde) se chargent après l'affichage, sans bloquer — mois en cours seulement,
    // pour rester une liste actionnable plutôt qu'un historique complet.
    const day = new Date().toISOString().slice(0, 10)
    const monthStart = day.slice(0, 7) + '-01', monthEnd = day.slice(0, 7) + '-31'
    supabase.from('v_alerts').select('*').eq('station_id', stationId).gte('report_date', monthStart).lte('report_date', monthEnd)
      .then(({ data }) => setAlerts((data || []).sort((a, b) => (a.gravite === 'haute' ? -1 : 1) - (b.gravite === 'haute' ? -1 : 1))))
  }, [stationId])
  useEffect(() => {
    if (!stationId) return
    const ch = supabase.channel('stock-' + stationId).on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports', filter: `station_id=eq.${stationId}` }, loadStock).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [stationId])

  // Vue comparative multi-stations : indépendante de la station sélectionnée, pour repérer en un
  // coup d'œil laquelle a besoin d'attention sans avoir à basculer le sélecteur station par station.
  useEffect(() => {
    if (!stations.length) return
    (async () => {
      const day = new Date().toISOString().slice(0, 10)
      const monthStart = day.slice(0, 7) + '-01', monthEnd = day.slice(0, 7) + '-31'
      const [sf, al, vm] = await Promise.all([
        supabase.from('v_stock_forecast').select('*'),
        supabase.from('v_alerts').select('station_id').gte('report_date', monthStart).lte('report_date', monthEnd),
        supabase.from('v_ventes_mensuelles').select('*').eq('mois', day.slice(0, 7)),
      ])
      const byStation = (rows) => { const m = {}; for (const r of (rows || [])) (m[r.station_id] = m[r.station_id] || []).push(r); return m }
      const sfMap = {}; for (const r of (sf.data || [])) sfMap[r.station_id] = r
      const alMap = byStation(al.data)
      const vmMap = {}; for (const r of (vm.data || [])) vmMap[r.station_id] = r
      setOverview(stations.map(s => {
        const f = sfMap[s.id], m = vmMap[s.id]
        const gap = m ? N(m.recettes_especes) - N(m.total_depense) - N(m.total_verse) : null
        return {
          id: s.id, nom: s.nom,
          joursEssence: f?.jours_essence ?? null, joursGasoil: f?.jours_gasoil ?? null,
          cashNonTrace: gap, nbAlertes: (alMap[s.id] || []).length,
        }
      }))
    })()
  }, [stations])

  const years = useMemo(() => [...new Set(months.map(m => m.mois.slice(0, 4)))].sort(), [months])
  useEffect(() => { if (!inited && months.length) { const m = months.map(x => x.mois).sort().at(-1); setYear(m.slice(0, 4)); setMonth(m.slice(5, 7)); setInited(true) } }, [months, inited])

  const fm = months.filter(m => (year === 'all' || m.mois.slice(0, 4) === year) && (month === 'all' || m.mois.slice(5, 7) === month))
  const sum = (k) => fm.reduce((s, m) => s + N(m[k]), 0)

  if (loading && !stock && !months.length) return <Panel><p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Chargement…</p></Panel>
  const L = (v) => loading && !months.length ? '…' : v

  const totBon = sum('ventes_bon'), totCash = sum('recettes_especes'), totVerse = sum('total_verse')
  const caTotal = totBon + totCash
  const pctBon = caTotal ? Math.round(100 * totBon / caTotal) : null
  const pctEsp = caTotal ? Math.round(100 * totCash / caTotal) : null
  const totDep = sum('total_depense'), totMarge = sum('commission_carburant'), totLivr = sum('total_livraisons')
  const gapVerse = totCash - totDep - totVerse

  // Répartition Bon / Espèce du CARBURANT uniquement.
  // ventes_bon = ess_bon+gas_bon (seul le carburant a des bons).
  // espèce carburant = recettes_especes − espèces gaz/supérette/lubrifiant.
  const carbBon = totBon
  const carbEsp = Math.max(0, totCash - sum('ventes_gaz') - sum('ventes_superette') - sum('ventes_lubrifiant'))
  const carbTotal = carbBon + carbEsp
  const pctCarbBon = carbTotal ? Math.round(100 * carbBon / carbTotal) : null
  const pctCarbEsp = carbTotal ? 100 - pctCarbBon : null

  const ordRecues = orders.filter(o => o.statut === 'recue')
  const nConf = inspections.filter(i => i.conforme === true).length, nNonConf = inspections.filter(i => i.conforme === false).length

  const chart = fm.map(m => ({ mois: m.mois.slice(2), 'Ventes bon': Math.round(N(m.ventes_bon)), 'Espèces': Math.round(N(m.recettes_especes)), 'Versé': Math.round(N(m.total_verse)) }))

  const yearOptions = [{ value: 'all', label: 'Toutes années' }, ...years.map(y => ({ value: y, label: y }))]
  const monthOptions = [{ value: 'all', label: 'Tous mois' }, ...MONTHS.map(m => ({ value: m, label: ML[m] }))]

  const reorderColumns = [
    { key: 'produit', header: 'Produit', render: r => <span style={{ textTransform: 'capitalize' }}>{r.produit}</span> },
    { key: 'stock', header: 'Stock', numeric: true, align: 'right', render: r => r.stock != null ? Math.round(r.stock).toLocaleString('fr-FR') + ' L' : '—' },
    { key: 'conso_jour', header: 'Conso/j', numeric: true, align: 'right', render: r => r.conso_jour ? Math.round(r.conso_jour).toLocaleString('fr-FR') + ' L' : '—' },
    { key: 'jours_restant', header: 'Autonomie', numeric: true, align: 'right', render: r => <span style={{ color: YEAR_COLOR(r.jours_restant) }}>{r.jours_restant != null ? `≈ ${r.jours_restant} j` : '—'}</span> },
    { key: 'lead', header: 'Délai livr.', numeric: true, align: 'right', render: r => <>{r.lead != null ? `${r.lead} j` : '—'}{N(r.nb_delai) > 0 ? <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> ({N(r.nb_delai)})</span> : <span style={{ color: 'var(--text-muted)', fontSize: 10 }}> déf.</span>}</> },
    { key: 'commander', header: 'Commander le', render: r => r.commande_en_cours ? <span style={{ color: 'var(--text-muted)' }}>commande en cours</span> : r.commander_maintenant ? <b style={{ color: 'var(--state-alarm)' }}>maintenant</b> : (r.date_commande_conseillee ? frDate(r.date_commande_conseillee) : '—') },
    { key: 'rupture', header: 'Rupture estimée', muted: true, render: r => r.date_rupture_estimee ? frDate(r.date_rupture_estimee) : '—' },
    { key: 'action', header: 'Action', render: r => r.commande_en_cours
      ? <Badge tone="info" title="Une commande est déjà proposée/validée/lancée pour ce produit">Commande en cours</Badge>
      : r.commander_maintenant
        ? <Badge tone="alarm">Commander{r.manque_a_gagner_estime > 0 ? ` (−${Math.round(r.manque_a_gagner_estime).toLocaleString('fr-FR')} F)` : ''}</Badge>
        : <span style={{ color: 'var(--state-ok)' }}>ok</span> },
  ]

  const overviewColumns = [
    { key: 'nom', header: 'Station', render: r => <span style={{ fontWeight: r.id === stationId ? 700 : 400 }}>{r.nom}{r.id === stationId ? ' (active)' : ''}</span> },
    { key: 'ess', header: 'Essence', numeric: true, align: 'right', render: r => <span style={{ color: YEAR_COLOR(r.joursEssence) }}>{r.joursEssence != null ? `≈ ${r.joursEssence} j` : '—'}</span> },
    { key: 'gas', header: 'Gasoil', numeric: true, align: 'right', render: r => <span style={{ color: YEAR_COLOR(r.joursGasoil) }}>{r.joursGasoil != null ? `≈ ${r.joursGasoil} j` : '—'}</span> },
    { key: 'cash', header: 'Cash non tracé (mois)', numeric: true, align: 'right', render: r => r.cashNonTrace != null ? <span style={{ color: r.cashNonTrace > 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(r.cashNonTrace)}</span> : '—' },
    { key: 'al', header: 'Alertes (mois)', numeric: true, align: 'right', render: r => r.nbAlertes > 0 ? <Badge tone="alarm">{r.nbAlertes}</Badge> : <span style={{ color: 'var(--state-ok)' }}>0</span> },
    { key: 'action', header: '', align: 'right', render: r => r.id === stationId ? null : <Button size="sm" onClick={() => setStationId(r.id)}>Voir</Button> },
  ]

  const reconColumns = [
    { key: 'mois', header: 'Mois' },
    { key: 'esp', header: 'Espèces', numeric: true, align: 'right', render: m => fcfa(N(m.recettes_especes)) },
    { key: 'ver', header: 'Versé', numeric: true, align: 'right', render: m => fcfa(N(m.total_verse)) },
    { key: 'ecart', header: 'Écart', numeric: true, align: 'right', render: m => { const ec = N(m.recettes_especes) - N(m.total_verse); return <span style={{ color: ec > 1000 ? 'var(--state-alarm)' : 'var(--text-body)' }}>{fcfa(ec)}</span> } },
    { key: 'couv', header: 'Couv.', numeric: true, align: 'right', render: m => { const esp = N(m.recettes_especes), ver = N(m.total_verse); const cov = esp ? Math.round(100 * ver / esp) : 0; return <span style={{ color: cov >= 90 ? 'var(--state-ok)' : cov >= 60 ? 'var(--state-warn)' : 'var(--state-alarm)' }}>{cov}%</span> } },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {overview.length > 1 && (
        <Panel title="Vue d'ensemble des stations" flush>
          <DataTable columns={overviewColumns} rows={overview} rowStatus={r => r.nbAlertes > 0 || (r.cashNonTrace != null && r.cashNonTrace > 0) ? 'alarm' : undefined} />
        </Panel>
      )}

      {alerts.length > 0 && (
        <Panel title="Alertes — mois en cours" meta={`${alerts.length}`} flush>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--gutter-panel)' }}>
            {alerts.slice(0, 5).map((a, i) => {
              const meta = ALERT_TONES[a.type] || { label: a.type, tone: 'info' }
              return (
                <AlertBanner key={i} tone={meta.tone} title={meta.label} timestamp={frDate(a.report_date)}
                  action={a.report_date && <Button size="sm" onClick={() => nav(`/saisie?date=${a.report_date}`)}>Traiter</Button>}>
                  {a.detail}
                </AlertBanner>
              )
            })}
            {alerts.length > 5 && <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>+ {alerts.length - 5} autre(s) alerte(s) — voir Alertes.</p>}
          </div>
        </Panel>
      )}

      <Panel title="Stock en temps réel & autonomie" status="accent" meta={`maj ${refreshedAt}`} actions={<Button size="sm" onClick={loadStock}>Rafraîchir</Button>}>
        {!stock ? <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Pas encore de stock saisi.</p> : (<>
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>Dernière saisie : {frDate(stock.derniere_date)}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
            <Kpi label="Essence en cuve" value={stock.ess_stock != null ? Math.round(stock.ess_stock) : '—'} unit={stock.ess_stock != null ? 'L' : ''} sub={forecast?.jours_essence != null ? `≈ ${forecast.jours_essence} j` : ''} status={YEAR_TONE(forecast?.jours_essence)} />
            <Kpi label="Gasoil en cuve" value={stock.gas_stock != null ? Math.round(stock.gas_stock) : '—'} unit={stock.gas_stock != null ? 'L' : ''} sub={forecast?.jours_gasoil != null ? `≈ ${forecast.jours_gasoil} j` : ''} status={YEAR_TONE(forecast?.jours_gasoil)} />
            <Kpi label="Bons en cours" value={stock.bons_restant != null ? fcfa(stock.bons_restant) : '—'}
              sub={N(stock.bons_utilises_depuis) > 0 ? `dont ${fcfa(stock.bons_utilises_depuis)} engagés en commandes` : ''}
              status={stock.bons_restant != null && stock.bons_restant < 0 ? 'alarm' : undefined} />
            <Kpi label="Bouteilles gaz" value={[stock.gaz_stock_3, stock.gaz_stock_6, stock.gaz_stock_12, stock.gaz_stock_38].reduce((a, b) => a + N(b), 0)} unit="b." />
          </div>
        </>)}
      </Panel>

      {reorder.length > 0 && (
        <Panel title="Prévision de commande carburant" status={reorder.some(r => r.commander_maintenant) ? 'alarm' : 'ok'} flush>
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
            Quand commander pour ne jamais tomber en rupture (rupture = ventes perdues). Calcul : autonomie − délai de livraison − marge de sécurité. Le <b>délai</b> est calculé automatiquement sur l'historique des commandes (lancement → réception).
          </p>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <DataTable columns={reorderColumns} rows={reorder.map(r => ({ ...r, id: r.produit }))} />
          </div>
        </Panel>
      )}

      <Panel bodyStyle={{ display: 'none' }} actions={<>
        <Select size="sm" value={year} onChange={e => setYear(e.target.value)} options={yearOptions} />
        <Select size="sm" value={month} onChange={e => setMonth(e.target.value)} options={monthOptions} />
        {(year !== 'all' || month !== 'all') && <Button size="sm" onClick={() => { setYear('all'); setMonth('all') }}>Réinitialiser</Button>}
        <Tag>{sum('jours')} jour(s)</Tag>
      </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Ventes à bon" value={L(fcfa(totBon))} sub={pctBon != null ? `${pctBon}% du CA` : ''} />
        <Kpi label="Recettes espèces" value={L(fcfa(totCash))} sub={pctEsp != null ? `${pctEsp}% du CA` : ''} />
        <Kpi label="Versé banque" value={L(fcfa(totVerse))} />
        <Kpi label="Cash non tracé" value={L(fcfa(gapVerse))} status={gapVerse > 0 ? 'alarm' : undefined} sub="recettes − dépenses − versé" />
        <Kpi label="Marge carburant" value={L(fcfa(totMarge))} sub="25 F/L" />
        <Kpi label="Livraisons / achats" value={L(fcfa(totLivr))} />
      </div>

      <Panel title="Ventes carburant — Bon vs Espèce">
        {carbTotal ? (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
            <Kpi label="Carburant à BON (crédit)" value={L(fcfa(carbBon))} sub={pctCarbBon != null ? `${pctCarbBon}% du carburant` : ''} />
            <Kpi label="Carburant en ESPÈCES" value={L(fcfa(carbEsp))} sub={pctCarbEsp != null ? `${pctCarbEsp}% du carburant` : ''} />
            <Kpi label="CA carburant (période)" value={L(fcfa(carbTotal))} />
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 'var(--radius-1)', overflow: 'hidden', marginTop: 'var(--sp-4)' }}>
            <div title={`Bon ${pctCarbBon}%`} style={{ width: `${pctCarbBon || 0}%`, background: 'var(--accent)' }} />
            <div title={`Espèce ${pctCarbEsp}%`} style={{ width: `${pctCarbEsp || 0}%`, background: 'var(--state-ok)' }} />
          </div>
          <div style={{ font: '400 11px/1 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-3)' }}>
            <span style={{ color: 'var(--accent)' }}>■</span> Bon {pctCarbBon}% &nbsp;·&nbsp;
            <span style={{ color: 'var(--state-ok)' }}>■</span> Espèce {pctCarbEsp}% — essence + gasoil uniquement
          </div>
        </>) : <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Pas de ventes carburant sur la période sélectionnée.</p>}
      </Panel>

      <Panel title="Commandes & contrôles ANM">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <Kpi label="Commandes reçues" value={ordRecues.length} sub={`${orders.length} au total`} />
          <Kpi label="Contrôles ANM" value={inspections.length} sub={`${nConf} conformes · ${nNonConf} non conf.`} status={nNonConf > 0 ? 'alarm' : undefined} />
        </div>
      </Panel>

      <Panel title="Évolution mensuelle">
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <XAxis dataKey="mois" fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" tickFormatter={v => (v / 1e6).toFixed(0) + 'M'} />
              <Tooltip formatter={v => fcfa(v)} contentStyle={{ background: 'var(--surface-panel)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-1)', font: '12px var(--font-ui)' }} />
              <Legend wrapperStyle={{ font: '11px var(--font-ui)' }} />
              <Bar dataKey="Ventes bon" fill="var(--accent)" /><Bar dataKey="Espèces" fill="var(--state-info)" /><Bar dataKey="Versé" fill="var(--state-ok)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Réconciliation versements (par mois)" meta={`${fm.length} mois`} flush
        bodyStyle={openRecon ? undefined : { display: 'none' }}
        actions={<IconButton icon="chevron-down" size="sm" title={openRecon ? 'Masquer' : 'Afficher'}
          onClick={() => setOpenRecon(v => !v)} style={{ transform: openRecon ? 'rotate(180deg)' : 'none' }} />}>
        {fm.length
          ? <DataTable columns={reconColumns} rows={fm.map(m => ({ ...m, id: m.mois }))} />
          : <PanelEmpty icon="chart-column" label="Aucune donnée sur la période" />}
      </Panel>
    </div>
  )
}
